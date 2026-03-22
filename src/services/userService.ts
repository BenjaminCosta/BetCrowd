import { 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  runTransaction 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { upsertPublicProfile } from './publicProfileService';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  username?: string;
  fullName?: string;
  phone?: string;
  bio?: string;
  photoURL?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface UpdateProfileData {
  fullName?: string;
  username?: string;
  phone?: string;
  bio?: string;
  photoURL?: string;
}

/**
 * Get user profile from Firestore.
 * Results are cached in-memory for 5 minutes so TopBar and ProfileScreen
 * don't each make a separate read for the same document.
 */
const _userProfileCache = new Map<string, { profile: UserProfile | null; ts: number }>();
const USER_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Invalidate a uid's entry (e.g. after a profile update) */
export const invalidateUserProfileCache = (uid: string) => {
  _userProfileCache.delete(uid);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const cached = _userProfileCache.get(uid);
  if (cached && Date.now() - cached.ts < USER_PROFILE_CACHE_TTL_MS) {
    return cached.profile;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const profile = userDoc.exists() ? (userDoc.data() as UserProfile) : null;
    _userProfileCache.set(uid, { profile, ts: Date.now() });
    return profile;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

/**
 * Validate username format
 */
export const validateUsername = (username: string): { valid: boolean; error?: string } => {
  if (!username || username.trim().length === 0) {
    return { valid: false, error: 'El nombre de usuario es requerido' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: 'Mínimo 3 caracteres' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Máximo 20 caracteres' };
  }

  // Check for lowercase, letters, numbers, underscore, dot only
  const validPattern = /^[a-z0-9_.]+$/;
  if (!validPattern.test(trimmed)) {
    return { valid: false, error: 'Solo minúsculas, números, _ y .' };
  }

  // Check for spaces
  if (/\s/.test(trimmed)) {
    return { valid: false, error: 'No se permiten espacios' };
  }

  return { valid: true };
};

/**
 * Update username with transaction to ensure uniqueness
 */
export const updateUsernameTransaction = async (
  uid: string,
  oldUsername: string | undefined,
  newUsername: string
): Promise<void> => {
  const newUsernameLower = newUsername.toLowerCase().trim();
  
  // Validate format
  const validation = validateUsername(newUsernameLower);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // If username hasn't changed, skip
  if (oldUsername && oldUsername.toLowerCase() === newUsernameLower) {
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      const usernameDocRef = doc(db, 'usernames', newUsernameLower);
      const usernameDoc = await transaction.get(usernameDocRef);

      // Check if username is taken by another user
      if (usernameDoc.exists()) {
        const data = usernameDoc.data();
        if (data.uid !== uid) {
          throw new Error('Este nombre de usuario ya está en uso');
        }
      }

      // Set new username claim
      transaction.set(usernameDocRef, { uid });

      // Delete old username claim if it exists
      if (oldUsername) {
        const oldUsernameDocRef = doc(db, 'usernames', oldUsername.toLowerCase());
        transaction.delete(oldUsernameDocRef);
      }

      // Update user document
      const userDocRef = doc(db, 'users', uid);
      transaction.update(userDocRef, {
        username: newUsernameLower,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error: any) {
    console.error('Error updating username:', error);
    throw error;
  }
};

/**
 * Update user profile (excluding username which needs transaction)
 */
export const updateUserProfile = async (
  uid: string,
  data: UpdateProfileData
): Promise<void> => {
  try {
    const userDocRef = doc(db, 'users', uid);
    const updateData: any = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    // Remove username from this update (handle separately)
    delete updateData.username;

    await updateDoc(userDocRef, updateData);
    invalidateUserProfileCache(uid);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

/**
 * Full profile update with username transaction
 */
export const updateFullProfile = async (
  uid: string,
  oldUsername: string | undefined,
  data: UpdateProfileData
): Promise<void> => {
  try {
    // Handle username separately if it changed
    if (data.username && data.username !== oldUsername) {
      await updateUsernameTransaction(uid, oldUsername, data.username);
      invalidateUserProfileCache(uid);
    }

    // Update other fields
    const updateData = { ...data };
    delete updateData.username; // Already handled

    if (Object.keys(updateData).length > 0) {
      await updateUserProfile(uid, updateData);
    }

    // Update public profile if username exists
    const profile = await getUserProfile(uid);
    if (profile && profile.username) {
      await upsertPublicProfile(uid, {
        username: profile.username,
        displayName: data.fullName || profile.displayName || profile.username,
        email: profile.email,
        photoURL: data.photoURL || profile.photoURL,
      });
    }
  } catch (error) {
    console.error('Error updating full profile:', error);
    throw error;
  }
};

/**
 * Bootstrap / migration helper — called once on login (fire-and-forget).
 * Ensures the current user has:
 *   1. A valid /users/{uid} document with all fields needed by the app.
 *   2. A /publicProfiles/{uid} document so they appear in search.
 * Never throws — any failure is logged and silently ignored so login is never blocked.
 */
export const ensureUserProfile = async (uid: string): Promise<void> => {
  // Guard: auth.currentUser is used for display/email defaults.
  // Always call with auth.currentUser.uid to avoid writing another user's data.
  if (auth.currentUser?.uid !== uid) return;
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const authUser = auth.currentUser;

    const authDisplayName = authUser?.displayName || 'Usuario';
    const authPhotoURL = authUser?.photoURL ?? null;
    const authEmail = authUser?.email || '';

    let displayName = authDisplayName;
    let username: string | null = null;

    if (!userSnap.exists()) {
      // Create missing user document
      await setDoc(userRef, {
        uid,
        email: authEmail,
        displayName: authDisplayName,
        username: null,
        photoURL: authPhotoURL,
        displayNameLower: authDisplayName.toLowerCase(),
        usernameLower: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      const data = userSnap.data() as any;
      displayName = data.displayName || data.fullName || authDisplayName;
      username = data.username ?? null;

      // Patch any missing fields needed by search / UI
      const patch: Record<string, any> = {};
      if (!data.displayNameLower)
        patch.displayNameLower = displayName.toLowerCase();
      if (data.usernameLower === undefined)
        patch.usernameLower = (username || '').toLowerCase();
      if (!data.updatedAt)
        patch.updatedAt = serverTimestamp();

      if (Object.keys(patch).length > 0) {
        await updateDoc(userRef, patch);
      }
    }

    // Ensure publicProfiles doc exists so this user is discoverable in search
    if (username) {
      const pubRef = doc(db, 'publicProfiles', uid);
      const pubSnap = await getDoc(pubRef);

      if (!pubSnap.exists()) {
        await setDoc(pubRef, {
          uid,
          username,
          usernameLower: username.toLowerCase(),
          displayName,
          email: authEmail,
          photoURL: authPhotoURL || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const pubData = pubSnap.data() as any;
        const pubPatch: Record<string, any> = {};
        if (!pubData.usernameLower)
          pubPatch.usernameLower = username.toLowerCase();
        if (!pubData.displayName)
          pubPatch.displayName = displayName;
        if (Object.keys(pubPatch).length > 0) {
          pubPatch.updatedAt = serverTimestamp();
          await setDoc(pubRef, pubPatch, { merge: true });
        }
      }
    }
  } catch (error) {
    // Never block login — non-fatal
    console.warn('[ensureUserProfile] Non-blocking migration error:', error);
  }
};
