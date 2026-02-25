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
    // XMLHttpRequest is required in React Native — fetch().blob() causes storage/unknown
    const blob = await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response as Blob);
      xhr.onerror = () => reject(new Error('Network request failed'));
      xhr.responseType = 'blob';
      xhr.open('GET', localUri, true);
      xhr.send(null);
    });

    // Derive extension from the local URI (strip query params, lowercase)
    const uriWithoutQuery = localUri.split('?')[0];
    const extMatch = uriWithoutQuery.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';
    const avatarPath = ext ? `users/${uid}/avatar.${ext}` : `users/${uid}/avatar`;

    // Create storage reference
    const storageRef = ref(storage, avatarPath);

    // Upload the blob with explicit MIME type so Storage sets correct cache headers
    const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    await uploadBytes(storageRef, blob, { contentType: mimeType });

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw new Error('No se pudo subir la imagen. Intenta nuevamente.');
  }
};
