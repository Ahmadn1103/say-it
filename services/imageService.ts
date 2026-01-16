import { storage } from '@/config/firebase';
import { GAME_CONFIG, STORAGE_PATHS } from '@/constants/config';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Request media library permissions
 */
export async function requestMediaLibraryPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Pick an image from the device's library
 * @returns The image URI or null if cancelled
 */
export async function pickImageFromLibrary(): Promise<string | null> {
  const hasPermission = await requestMediaLibraryPermissions();
  
  if (!hasPermission) {
    throw new Error('Media library permission denied');
  }
  
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.assets[0].uri;
}

/**
 * Take a photo with the device's camera
 * @returns The image URI or null if cancelled
 */
export async function takePhoto(): Promise<string | null> {
  const hasPermission = await requestCameraPermissions();
  
  if (!hasPermission) {
    throw new Error('Camera permission denied');
  }
  
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.assets[0].uri;
}

/**
 * Compress and resize an image to meet size requirements
 * @param uri - The image URI
 * @param maxSizeKB - Maximum size in kilobytes (default: 500KB)
 * @returns The compressed image URI
 */
export async function compressImage(
  uri: string,
  maxSizeKB: number = GAME_CONFIG.DROP_IT_MAX_SIZE_KB
): Promise<string> {
  const maxSizeBytes = maxSizeKB * 1024;
  
  // Start with moderate compression
  let compress = 0.7;
  let width = 1024;
  let result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width } }],
    { compress, format: ImageManipulator.SaveFormat.JPEG }
  );
  
  // Check file size (estimate based on base64 or fetch)
  const response = await fetch(result.uri);
  const blob = await response.blob();
  let fileSize = blob.size;
  
  // Iteratively reduce quality/size if needed
  while (fileSize > maxSizeBytes && compress > 0.1) {
    compress -= 0.1;
    width = Math.floor(width * 0.9);
    
    result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width } }],
      { compress, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    const newResponse = await fetch(result.uri);
    const newBlob = await newResponse.blob();
    fileSize = newBlob.size;
  }
  
  if (fileSize > maxSizeBytes) {
    throw new Error(`Image too large. Maximum size is ${maxSizeKB}KB`);
  }
  
  return result.uri;
}

/**
 * Apply a blur effect to an image (for pre-reveal display)
 * @param uri - The image URI
 * @param blurAmount - Blur intensity (0-100)
 * @returns The blurred image URI
 */
export async function blurImage(uri: string, blurAmount: number = 50): Promise<string> {
  // Note: expo-image-manipulator doesn't support blur natively
  // This is a placeholder - in production, you might use a different library
  // or handle blur with CSS/styling on the Image component
  console.warn('Blur not implemented - use CSS blur filter on Image component');
  return uri;
}

/**
 * Upload an image to Firebase Storage
 * @param roomCode - The room code (used in storage path)
 * @param imageUri - The local image URI
 * @returns The download URL of the uploaded image
 */
export async function uploadToStorage(roomCode: string, imageUri: string): Promise<string> {
  try {
    // Compress image before upload
    const compressedUri = await compressImage(imageUri);
    
    // Convert to blob
    const response = await fetch(compressedUri);
    const blob = await response.blob();
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}.jpg`;
    const storagePath = `${STORAGE_PATHS.DROP_IT}/${roomCode}/${filename}`;
    
    // Upload to Firebase Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob);
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image');
  }
}

/**
 * Delete an image from Firebase Storage
 * @param imageUrl - The full download URL or storage path
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    // Extract the storage path from the URL if it's a full URL
    let storagePath: string;
    
    if (imageUrl.includes('firebasestorage.googleapis.com')) {
      // Parse the storage path from the download URL
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
      if (pathMatch) {
        storagePath = decodeURIComponent(pathMatch[1]);
      } else {
        throw new Error('Invalid storage URL');
      }
    } else {
      // Assume it's already a storage path
      storagePath = imageUrl;
    }
    
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    // Don't throw - deletion failures are non-critical
  }
}

/**
 * Delete all images for a room
 * @param roomCode - The room code
 */
export async function deleteRoomImages(roomCode: string): Promise<void> {
  try {
    const folderPath = `${STORAGE_PATHS.DROP_IT}/${roomCode}`;
    const folderRef = ref(storage, folderPath);
    
    // Note: Firebase Storage doesn't have a direct "delete folder" method
    // In production, this should be handled by a Cloud Function
    // For now, we'll just log it
    console.log(`Should delete all images in folder: ${folderPath}`);
    console.warn('Room image deletion should be handled by Cloud Functions');
  } catch (error) {
    console.error('Error deleting room images:', error);
  }
}

/**
 * Get an image blob from a URI (helper for uploads)
 * @param uri - The image URI
 * @returns The blob
 */
export async function getBlobFromUri(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return await response.blob();
}

/**
 * Validate image size before upload
 * @param uri - The image URI
 * @param maxSizeKB - Maximum size in kilobytes
 * @returns True if image is within size limit
 */
export async function validateImageSize(uri: string, maxSizeKB: number = GAME_CONFIG.DROP_IT_MAX_SIZE_KB): Promise<boolean> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const sizeKB = blob.size / 1024;
    return sizeKB <= maxSizeKB;
  } catch (error) {
    console.error('Error validating image size:', error);
    return false;
  }
}
