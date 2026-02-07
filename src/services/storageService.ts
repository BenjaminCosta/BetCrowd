import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from '../lib/firebase';

// Initialize Firebase Storage
const storage = getStorage();

/**
 * Upload avatar image to Firebase Storage
 * @param uid User ID
 * @param localUri Local file URI from image picker
 * @returns Download URL of uploaded image
 */
export const uploadAvatar = async (uid: string, localUri: string): Promise<string> => {
  try {
    // Fetch the image as a blob
    const response = await fetch(localUri);
    const blob = await response.blob();

    // Create storage reference
    const storageRef = ref(storage, `users/${uid}/avatar.jpg`);

    // Upload the blob
    await uploadBytes(storageRef, blob);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw new Error('No se pudo subir la imagen. Intenta nuevamente.');
  }
};
