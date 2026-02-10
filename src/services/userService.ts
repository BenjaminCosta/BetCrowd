import { 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  runTransaction 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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
 * Get user profile from Firestore
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
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
        photoURL: data.photoURL || profile.photoURL,
      });
    }
  } catch (error) {
    console.error('Error updating full profile:', error);
    throw error;
  }
};
