import * as SecureStore from 'expo-secure-store';
import { nanoid } from 'nanoid';
import { Platform } from 'react-native';

const ANONYMOUS_ID_KEY = 'anonymous_player_id';
const PLAYER_NAME_KEY = 'player_display_name';

// In-memory cache to avoid regenerating IDs within the same session
let cachedId: string | null = null;
let cachedName: string | null = null;

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

/**
 * Get the stored player name
 * @returns The stored name or null if not set
 */
export async function getPlayerName(): Promise<string | null> {
  if (cachedName) {
    return cachedName;
  }

  try {
    if (Platform.OS === 'web') {
      const name = localStorage.getItem(PLAYER_NAME_KEY);
      if (name) {
        cachedName = name;
      }
      return name;
    } else {
      const name = await SecureStore.getItemAsync(PLAYER_NAME_KEY);
      if (name) {
        cachedName = name;
      }
      return name;
    }
  } catch (error) {
    console.error('Error getting player name:', error);
    return cachedName;
  }
}

/**
 * Save the player's display name
 * @param name - The name to save
 */
export async function setPlayerName(name: string): Promise<void> {
  const trimmedName = name.trim();
  cachedName = trimmedName;

  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(PLAYER_NAME_KEY, trimmedName);
    } else {
      await SecureStore.setItemAsync(PLAYER_NAME_KEY, trimmedName);
    }
  } catch (error) {
    console.error('Error saving player name:', error);
  }
}

/**
 * Clear the stored player name
 */
export async function clearPlayerName(): Promise<void> {
  try {
    cachedName = null;
    
    if (Platform.OS === 'web') {
      localStorage.removeItem(PLAYER_NAME_KEY);
    } else {
      await SecureStore.deleteItemAsync(PLAYER_NAME_KEY);
    }
  } catch (error) {
    console.error('Error clearing player name:', error);
  }
}
