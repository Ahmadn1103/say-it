import * as SecureStore from 'expo-secure-store';
import { nanoid } from 'nanoid';

const ANONYMOUS_ID_KEY = 'anonymous_player_id';

/**
 * Get or create an anonymous device-specific ID
 * This ID is persistent across app sessions but never tied to real identity
 */
export async function getAnonymousId(): Promise<string> {
  try {
    // Try to retrieve existing ID
    const existingId = await SecureStore.getItemAsync(ANONYMOUS_ID_KEY);
    
    if (existingId) {
      return existingId;
    }
    
    // Generate new ID if none exists
    const newId = `anon_${nanoid(16)}`;
    await SecureStore.setItemAsync(ANONYMOUS_ID_KEY, newId);
    
    return newId;
  } catch (error) {
    console.error('Error managing anonymous ID:', error);
    // Fallback to session-only ID if secure storage fails
    return `temp_${nanoid(16)}`;
  }
}

/**
 * Clear the stored anonymous ID (for testing/debugging)
 */
export async function clearAnonymousId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ANONYMOUS_ID_KEY);
  } catch (error) {
    console.error('Error clearing anonymous ID:', error);
  }
}
