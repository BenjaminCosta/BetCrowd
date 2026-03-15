// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

const firebaseConfig = {
  apiKey: "AIzaSyAq-uVfR4kX_d1rO5O3jI0nMcRSZxus61o",
  authDomain: "betcrowd-6123a.firebaseapp.com",
  projectId: "betcrowd-6123a",
  storageBucket: "betcrowd-6123a.firebasestorage.app",
  messagingSenderId: "844074817118",
  appId: "1:844074817118:web:0c3b43491884df0a0f86cf",
  measurementId: "G-Z2P1TC1C25", // opcional, no se usa acá
};

// Evita reinicializar con hot reload (Expo)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Auth con persistencia real en RN
let authInstance;
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
