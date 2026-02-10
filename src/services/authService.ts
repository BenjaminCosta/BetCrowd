import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { upsertPublicProfile } from './publicProfileService';

export interface SignUpData {
  email: string;
  password: string;
  displayName?: string;
  username?: string;
}

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
        const q = query(usersRef, where('username', '==', emailOrUsername.toLowerCase().trim()));
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

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw error;
  }
};

export const getFirebaseErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
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
