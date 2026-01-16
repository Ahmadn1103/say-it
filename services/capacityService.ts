import { db } from '@/config/firebase';
import { GlobalCapacity } from '@/config/firestore-schema';
import { COLLECTIONS, GAME_CONFIG } from '@/constants/config';
import { doc, getDoc, increment, onSnapshot, serverTimestamp, Unsubscribe, updateDoc } from 'firebase/firestore';

const CAPACITY_DOC_PATH = `${COLLECTIONS.GLOBAL}/capacity`;

/**
 * Check if the server has capacity for new users
 * Returns true if under the max concurrent user limit
 */
export async function checkCapacity(): Promise<boolean> {
  try {
    const capacityRef = doc(db, CAPACITY_DOC_PATH);
    const capacitySnap = await getDoc(capacityRef);
    
    if (!capacitySnap.exists()) {
      // If document doesn't exist, we're definitely under capacity
      return true;
    }
    
    const data = capacitySnap.data() as GlobalCapacity;
    return data.activeUsers < GAME_CONFIG.MAX_CONCURRENT_USERS;
  } catch (error) {
    console.error('Error checking capacity:', error);
    // Default to allowing users if check fails
    return true;
  }
}

/**
 * Get the current active user count
 */
export async function getActiveUserCount(): Promise<number> {
  try {
    const capacityRef = doc(db, CAPACITY_DOC_PATH);
    const capacitySnap = await getDoc(capacityRef);
    
    if (!capacitySnap.exists()) {
      return 0;
    }
    
    const data = capacitySnap.data() as GlobalCapacity;
    return data.activeUsers;
  } catch (error) {
    console.error('Error getting active user count:', error);
    return 0;
  }
}

/**
 * Increment the active user count when a user joins
 */
export async function incrementUsers(): Promise<void> {
  try {
    const capacityRef = doc(db, CAPACITY_DOC_PATH);
    await updateDoc(capacityRef, {
      activeUsers: increment(1),
      lastUpdated: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error incrementing users:', error);
    // Non-critical error, don't throw
  }
}

/**
 * Decrement the active user count when a user disconnects
 */
export async function decrementUsers(): Promise<void> {
  try {
    const capacityRef = doc(db, CAPACITY_DOC_PATH);
    await updateDoc(capacityRef, {
      activeUsers: increment(-1),
      lastUpdated: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error decrementing users:', error);
    // Non-critical error, don't throw
  }
}

/**
 * Subscribe to capacity changes with real-time updates
 * Returns an unsubscribe function
 * 
 * @param onCapacityChange - Callback that receives the current user count and whether we're at capacity
 */
export function subscribeToCapacity(
  onCapacityChange: (activeUsers: number, isAtCapacity: boolean) => void
): Unsubscribe {
  const capacityRef = doc(db, CAPACITY_DOC_PATH);
  
  return onSnapshot(
    capacityRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onCapacityChange(0, false);
        return;
      }
      
      const data = snapshot.data() as GlobalCapacity;
      const isAtCapacity = data.activeUsers >= GAME_CONFIG.MAX_CONCURRENT_USERS;
      onCapacityChange(data.activeUsers, isAtCapacity);
    },
    (error) => {
      console.error('Error subscribing to capacity:', error);
      onCapacityChange(0, false);
    }
  );
}

/**
 * Check if we're approaching capacity (>90%)
 */
export async function isApproachingCapacity(): Promise<boolean> {
  try {
    const activeUsers = await getActiveUserCount();
    const threshold = GAME_CONFIG.MAX_CONCURRENT_USERS * 0.9;
    return activeUsers >= threshold;
  } catch (error) {
    console.error('Error checking capacity threshold:', error);
    return false;
  }
}
