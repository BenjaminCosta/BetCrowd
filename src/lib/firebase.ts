// src/lib/firebase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Custom AsyncStorage-based persistence for React Native.
// Firebase v12 removed getReactNativePersistence. Internally it calls
// _getInstance(persistence) which asserts typeof persistence === 'function',
// so we must pass a CLASS CONSTRUCTOR, not a plain object.
class AsyncStoragePersistence {
  static type: 'LOCAL' = 'LOCAL';
  type = 'LOCAL' as const;

  async _isAvailable(): Promise<boolean> {
    try {
      await AsyncStorage.setItem('__fb_avail__', '1');
      await AsyncStorage.removeItem('__fb_avail__');
      return true;
    } catch { return false; }
  }

  async _set(key: string, value: unknown): Promise<void> {
    try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* silent */ }
  }

  async _get(key: string): Promise<unknown> {
    try {
      const item = await AsyncStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch { return null; }
  }

  async _remove(key: string): Promise<void> {
    try { await AsyncStorage.removeItem(key); } catch { /* silent */ }
  }

  _addListener(_key: string, _listener: unknown): void {}
  _removeListener(_key: string, _listener: unknown): void {}
}

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const firebaseConfig = {
  apiKey: getRequiredEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: getRequiredEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: getRequiredEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: getRequiredEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getRequiredEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getRequiredEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
};

// Evita reinicializar con hot reload (Expo)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Auth con persistencia real en RN
let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: AsyncStoragePersistence as any, // class constructor, not instance
  });
} catch (error: any) {
  // Si ya está inicializado (hot reload), obtener la instancia existente
  if (error.code === 'auth/already-initialized') {
    authInstance = getAuth(app);
  } else {
    throw error;
  }
}

export const auth = authInstance;

// evita reinicializar en hot reload
(globalThis as any).__FIREBASE_AUTH__ = auth;

export const db = getFirestore(app);
export const storage = getStorage(app);
