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

/**
 * Get public profile by UID
 */
export const getPublicProfile = async (uid: string): Promise<PublicProfile | null> => {
  try {
    const publicProfileDoc = await getDoc(doc(db, 'publicProfiles', uid));
    if (publicProfileDoc.exists()) {
      return publicProfileDoc.data() as PublicProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting public profile:', error);
    throw error;
  }
};
