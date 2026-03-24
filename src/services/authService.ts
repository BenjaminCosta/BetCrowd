import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { exchangeCodeAsync, AuthRequest, makeRedirectUri, Prompt } from 'expo-auth-session';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from '../lib/firebase';
import { upsertPublicProfile } from './publicProfileService';

export interface SignUpData {
  email: string;
  password: string;
  displayName?: string;
  username?: string;
}

const googleDiscovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

const nativeGoogleRedirectUri = 'com.betcrowd.mobile:/oauthredirect';

const getOptionalEnv = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value : undefined;
};

const getGoogleClientId = (): string => {
  if (Platform.OS === 'ios') {
    return (
      getOptionalEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID') ??
      getOptionalEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') ??
      ''
    );
  }

  if (Platform.OS === 'android') {
    return (
      getOptionalEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID') ??
      getOptionalEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') ??
      ''
    );
  }

  return getOptionalEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') ?? '';
};

const getGoogleWebClientId = (): string => getOptionalEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') ?? '';

const makeNonce = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

let googleSigninConfigured = false;

const getAndroidGoogleSigninModule = () => {
  const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin');
  return { GoogleSignin, statusCodes };
};

const ensureAndroidGoogleSigninConfigured = () => {
  if (googleSigninConfigured) return;

  const webClientId = getGoogleWebClientId();

  if (!webClientId) {
    const error: any = new Error('Falta configurar EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID para Android');
    error.code = 'auth/google-misconfigured';
    throw error;
  }

  const { GoogleSignin } = getAndroidGoogleSigninModule();

  GoogleSignin.configure({
    webClientId,
    scopes: ['email', 'profile'],
  });

  googleSigninConfigured = true;
};

const signInWithGoogleAndroid = async () => {
  ensureAndroidGoogleSigninConfigured();
  const { GoogleSignin, statusCodes } = getAndroidGoogleSigninModule();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const result = await GoogleSignin.signIn();

    if (result.type === 'cancelled') {
      const error: any = new Error('Inicio de sesión con Google cancelado');
      error.code = 'auth/cancelled-by-user';
      throw error;
    }

    const idToken = result.data?.idToken;

    if (!idToken) {
      const error: any = new Error('Google no devolvió un token válido');
      error.code = 'auth/google-missing-id-token';
      throw error;
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);

    return userCredential.user;
  } catch (error: any) {
    const errorCode = error?.code;
    const errorMessage = typeof error?.message === 'string' ? error.message : '';

    if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
      error.code = 'auth/cancelled-by-user';
    } else if (errorCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      error.code = 'auth/google-play-services-not-available';
    } else if (errorCode === statusCodes.IN_PROGRESS) {
      error.code = 'auth/google-sign-in-in-progress';
    } else if (
      errorCode === 'DEVELOPER_ERROR' ||
      errorCode === 10 ||
      errorMessage.includes('DEVELOPER_ERROR') ||
      errorMessage.includes('12500') ||
      errorMessage.includes('10')
    ) {
      error.code = 'auth/google-misconfigured';
    }

    throw error;
  }
};

const signInWithGoogleIos = async () => {
  const clientId = getGoogleClientId();

  if (!clientId) {
    const error: any = new Error('Falta configurar el client ID de Google para esta plataforma');
    error.code = 'auth/google-misconfigured';
    throw error;
  }

  const redirectUri = makeRedirectUri({
    native: nativeGoogleRedirectUri,
  });

  if (redirectUri.startsWith('exp://')) {
    const error: any = new Error('Google Sign-In requiere una development build y no funciona desde Expo Go');
    error.code = 'auth/google-dev-build-required';
    throw error;
  }

  const request = new AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    prompt: Prompt.SelectAccount,
    extraParams: {
      nonce: makeNonce(),
    },
  });

  const result = await request.promptAsync(googleDiscovery);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    const error: any = new Error('Inicio de sesión con Google cancelado');
    error.code = 'auth/cancelled-by-user';
    throw error;
  }

  if (result.type !== 'success') {
    const error: any = new Error('No se pudo completar el inicio de sesión con Google');
    error.code = result.type === 'error' ? result.error?.code ?? 'auth/google-sign-in-failed' : 'auth/google-sign-in-failed';
    throw error;
  }

  const code = result.params.code;

  if (!code) {
    const error: any = new Error('Google no devolvió un código de autorización válido');
    error.code = 'auth/google-missing-auth-code';
    throw error;
  }

  if (!request.codeVerifier) {
    const error: any = new Error('Falta el code_verifier para completar el flujo PKCE');
    error.code = 'auth/google-sign-in-failed';
    throw error;
  }

  const tokenResponse = await exchangeCodeAsync(
    {
      clientId,
      code,
      redirectUri,
      extraParams: {
        code_verifier: request.codeVerifier,
      },
    },
    googleDiscovery
  );

  const idToken = tokenResponse.idToken;

  if (!idToken) {
    const error: any = new Error('Google no devolvió un token válido');
    error.code = 'auth/google-missing-id-token';
    throw error;
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);

  return userCredential.user;
};

export const signUp = async ({ email, password, displayName, username }: SignUpData) => {
  try {
    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update display name if provided
    if (displayName) {
      await updateProfile(user, { displayName });
    }

    // Create Firestore user document with username
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName || null,
      username: username ? username.toLowerCase().trim() : null,
      createdAt: serverTimestamp(),
    });

    // Create public profile if username is provided
    if (username) {
      await upsertPublicProfile(user.uid, {
        username: username.toLowerCase().trim(),
        displayName: displayName || username,
        email: user.email || email,
        photoURL: user.photoURL || undefined,
      });
    }

    return user;
  } catch (error: any) {
    throw error;
  }
};

export const signIn = async (emailOrUsername: string, password: string) => {
  try {
    let email = emailOrUsername;
    
    // If it doesn't look like an email (no @), treat it as username
    if (!emailOrUsername.includes('@')) {
      try {
        // Search for user with this username
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', emailOrUsername.toLowerCase().trim()), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          const error: any = new Error('Usuario no encontrado');
          error.code = 'auth/user-not-found';
          throw error;
        }
        
        // Get email from user document
        const userData = querySnapshot.docs[0].data();
        email = userData.email;
      } catch (error: any) {
        // If there's an error searching for username, throw user-not-found
        if (error.code) throw error;
        const newError: any = new Error('Usuario no encontrado');
        newError.code = 'auth/user-not-found';
        throw newError;
      }
    }
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw error;
  }
};

export const signInWithGoogle = async () => {
  if (Platform.OS === 'android') {
    return signInWithGoogleAndroid();
  }

  return signInWithGoogleIos();
};

export const signOutUser = async () => {
  if (Platform.OS === 'android' && getGoogleWebClientId()) {
    try {
      ensureAndroidGoogleSigninConfigured();
      const { GoogleSignin } = getAndroidGoogleSigninModule();
      await GoogleSignin.signOut();
    } catch {
      // Best-effort — Firebase sign-out must still run
    }
  }

  await signOut(auth);
};

export const getFirebaseErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/cancelled-by-user':
      return 'Cancelaste el inicio de sesión con Google';
    case 'auth/google-misconfigured':
      return 'Google Sign-In no está configurado correctamente en la app';
    case 'auth/google-dev-build-required':
      return 'Google Sign-In requiere abrir la app en una development build, no en Expo Go';
    case 'auth/google-play-services-not-available':
      return 'Google Play Services no está disponible en este dispositivo';
    case 'auth/google-sign-in-in-progress':
      return 'Ya hay un inicio de sesión con Google en progreso';
    case 'auth/google-missing-auth-code':
      return 'Google no devolvió un código de autorización válido';
    case 'auth/google-missing-id-token':
      return 'Google no devolvió un token de acceso válido';
    case 'auth/popup-closed-by-user':
      return 'Cerraste el flujo de Google antes de completarlo';
    case 'auth/invalid-email':
      return 'El formato del email no es válido';
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada';
    case 'auth/user-not-found':
      return 'No existe una cuenta con este email o usuario';
    case 'auth/wrong-password':
      return 'Contraseña incorrecta';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con este email';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres';
    case 'auth/operation-not-allowed':
      return 'Operación no permitida';
    case 'auth/invalid-credential':
      return 'Credenciales inválidas';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intenta más tarde';
    case 'auth/network-request-failed':
      return 'Error de conexión. Verifica tu internet';
    default:
      return 'Ocurrió un error. Intenta nuevamente';
  }
};
