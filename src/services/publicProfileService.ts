import { 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from './userService';

export interface PublicProfile {
  uid: string;
  username: string;
  usernameLower: string;
  displayName: string;
  email: string;
  photoURL?: string;
  createdAt: any;
  updatedAt: any;
}

/**
 * Create or update public profile for a user
 * This should be called on:
 * - User signup
 * - Profile updates (especially username/displayName/photoURL)
 * - Login if public profile is missing
 */
export const upsertPublicProfile = async (
  uid: string,
  data: {
    username: string;
    displayName: string;
    email: string;
    photoURL?: string;
  }
): Promise<void> => {
  try {
    const publicProfileRef = doc(db, 'publicProfiles', uid);
    const existing = await getDoc(publicProfileRef);
    
    const publicProfileData: Partial<PublicProfile> = {
      uid,
      username: data.username,
      usernameLower: data.username.toLowerCase(),
      displayName: data.displayName,
      email: data.email,
      photoURL: data.photoURL || '',
      updatedAt: serverTimestamp(),
    };

    if (!existing.exists()) {
      publicProfileData.createdAt = serverTimestamp();
    }

    await setDoc(publicProfileRef, publicProfileData, { merge: true });
    invalidatePublicProfileCache(uid);
  } catch (error) {
    console.error('Error upserting public profile:', error);
    throw error;
  }
};

/**
 * Helper to create public profile from UserProfile
 */
export const upsertPublicProfileFromUser = async (
  userProfile: UserProfile
): Promise<void> => {
  if (!userProfile.username) {
    console.warn('Cannot create public profile without username');
    return;
  }

  await upsertPublicProfile(userProfile.uid, {
    username: userProfile.username,
    displayName: userProfile.displayName || userProfile.fullName || userProfile.username,
    email: userProfile.email,
    photoURL: userProfile.photoURL,
  });
};

// ─── In-memory cache ──────────────────────────────────────────────────────────
// Module-level map survives re-renders. TTL prevents stale data across sessions.
const _profileCache = new Map<string, { profile: PublicProfile | null; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Invalidate a specific uid from the cache (e.g. after a profile update) */
export const invalidatePublicProfileCache = (uid: string) => {
  _profileCache.delete(uid);
};

/**
 * Get public profile by UID.
 * Results are cached in-memory for 5 minutes to avoid repeated Firestore reads
 * when the same uid is requested multiple times (e.g. on friends list refreshes).
 */
export const getPublicProfile = async (uid: string): Promise<PublicProfile | null> => {
  const cached = _profileCache.get(uid);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.profile;
  }

  try {
    const publicProfileDoc = await getDoc(doc(db, 'publicProfiles', uid));
    const profile = publicProfileDoc.exists()
      ? (publicProfileDoc.data() as PublicProfile)
      : null;
    _profileCache.set(uid, { profile, ts: Date.now() });
    return profile;
  } catch (error) {
    // Non-throwing — callers must handle null gracefully
    console.warn('[getPublicProfile] Could not load profile for', uid, error);
    return null;
  }
};
