import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const ONBOARDING_SEEN_KEY = '@betcrowd/onboarding_seen';

export const hasSeenOnboarding = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)) === 'true';
  } catch {
    return false;
  }
};

export const markOnboardingAsSeen = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
  } catch {
    // Best-effort persistence. Failing to save should not block the user.
  }
};

/**
 * Check if the user has completed the post-registration welcome flow.
 * Reads `hasCompletedOnboarding` from Firestore /users/{uid}.
 * Missing field is treated as false (new users, or pre-feature users).
 */
export const hasCompletedWelcome = async (uid: string): Promise<boolean> => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.data()?.hasCompletedOnboarding === true;
  } catch {
    return false;
  }
};

/**
 * Mark the post-registration welcome flow as completed for a user.
 * Sets hasCompletedOnboarding: true on /users/{uid} in Firestore.
 */
export const markWelcomeCompleted = async (uid: string): Promise<void> => {
  try {
    await setDoc(doc(db, 'users', uid), { hasCompletedOnboarding: true }, { merge: true });
  } catch {
    // Best-effort. If it fails, user may see welcome again on next login.
  }
};
