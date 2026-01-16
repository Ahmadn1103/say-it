import * as SecureStore from 'expo-secure-store';
import { nanoid } from 'nanoid';
import { Platform } from 'react-native';

const ANONYMOUS_ID_KEY = 'anonymous_player_id';

// In-memory cache to avoid regenerating IDs within the same session
let cachedId: string | null = null;

/**
 * Get or create an anonymous device-specific ID
 * This ID is persistent across app sessions but never tied to real identity
 */
export async function getAnonymousId(): Promise<string> {
  // Return cached ID if available (prevents regeneration within same session)
  if (cachedId) {
    return cachedId;
  }

  try {
    if (Platform.OS === 'web') {
      // Use localStorage for web
      const existingId = localStorage.getItem(ANONYMOUS_ID_KEY);
      
      if (existingId) {
        cachedId = existingId;
        return existingId;
      }
      
      // Generate new ID if none exists
      const newId = `anon_${nanoid(16)}`;
      localStorage.setItem(ANONYMOUS_ID_KEY, newId);
      cachedId = newId;
      
      return newId;
    } else {
      // Use SecureStore for native (iOS/Android)
      const existingId = await SecureStore.getItemAsync(ANONYMOUS_ID_KEY);
      
      if (existingId) {
        cachedId = existingId;
        return existingId;
      }
      
      // Generate new ID if none exists
      const newId = `anon_${nanoid(16)}`;
      await SecureStore.setItemAsync(ANONYMOUS_ID_KEY, newId);
      cachedId = newId;
      
      return newId;
    }
  } catch (error) {
    console.error('Error managing anonymous ID:', error);
    // Fallback to session-cached ID if storage fails
    if (!cachedId) {
      cachedId = `temp_${nanoid(16)}`;
    }
    return cachedId;
  }
}

/**
 * Clear the stored anonymous ID (for testing/debugging)
 */
export async function clearAnonymousId(): Promise<void> {
  try {
    cachedId = null;
    
    if (Platform.OS === 'web') {
      localStorage.removeItem(ANONYMOUS_ID_KEY);
    } else {
      await SecureStore.deleteItemAsync(ANONYMOUS_ID_KEY);
    }
  } catch (error) {
    console.error('Error clearing anonymous ID:', error);
  }
}
