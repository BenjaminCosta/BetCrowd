import { 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updatePassword 
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

/**
 * Validate password change data
 */
export const validatePasswordChange = (data: ChangePasswordData): { valid: boolean; error?: string } => {
  if (!data.currentPassword) {
    return { valid: false, error: 'Ingresa tu contraseña actual' };
  }

  if (!data.newPassword) {
    return { valid: false, error: 'Ingresa una nueva contraseña' };
  }

  if (data.newPassword.length < 8) {
    return { valid: false, error: 'La nueva contraseña debe tener al menos 8 caracteres' };
  }

  if (data.newPassword !== data.confirmNewPassword) {
    return { valid: false, error: 'Las contraseñas no coinciden' };
  }

  if (data.currentPassword === data.newPassword) {
    return { valid: false, error: 'La nueva contraseña debe ser diferente a la actual' };
  }

  return { valid: true };
};

/**
 * Get user-friendly error message for Firebase password errors
 */
export const getPasswordErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Contraseña actual incorrecta';
    case 'auth/requires-recent-login':
      return 'Por seguridad, debes cerrar sesión y volver a iniciarla antes de cambiar tu contraseña';
    case 'auth/weak-password':
      return 'La contraseña es muy débil. Usa al menos 8 caracteres';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intenta más tarde';
    case 'auth/network-request-failed':
      return 'Error de conexión. Verifica tu internet';
    default:
      return 'Error al cambiar la contraseña. Intenta nuevamente';
  }
};

/**
 * Change user password with reauthentication
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  try {
    const user = auth.currentUser;

    if (!user || !user.email) {
      throw new Error('Usuario no autenticado');
    }

    // Reauthenticate user
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Update password
    await updatePassword(user, newPassword);
  } catch (error: any) {
    console.error('Error changing password:', error);
    throw error;
  }
};
