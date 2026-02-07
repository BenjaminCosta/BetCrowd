// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

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
export const auth =
  (globalThis as any).__FIREBASE_AUTH__ ??
  initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });

// evita reinicializar en hot reload
(globalThis as any).__FIREBASE_AUTH__ = auth;

export const db = getFirestore(app);
