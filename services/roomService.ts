import { db } from '@/config/firebase';
import { GameMode, Room, Round } from '@/config/firestore-schema';
import { COLLECTIONS, GAME_CONFIG } from '@/constants/config';
import { getRandomPromptIndex } from '@/constants/prompts';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { customAlphabet } from 'nanoid';

// Generate 6-character uppercase room codes
const generateCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

/**
 * Generate a unique 6-character room code
 */
export async function generateRoomCode(): Promise<string> {
  const maxAttempts = 10;
  
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateCode();
    const roomRef = doc(db, COLLECTIONS.ROOMS, code);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      return code;
    }
  }
  
  throw new Error('Failed to generate unique room code');
}

/**
 * Create a new game room
 * @param hostId - The anonymous ID of the player creating the room
 * @returns The created room object
 */
export async function createRoom(hostId: string): Promise<Room> {
  const code = await generateRoomCode();
  const roomRef = doc(db, COLLECTIONS.ROOMS, code);
  
  const room: Room = {
    code,
    hostId,
    players: [hostId],
    maxPlayers: GAME_CONFIG.MAX_PLAYERS,
    minPlayers: GAME_CONFIG.MIN_PLAYERS,
    status: 'waiting',
    currentMode: null,
    currentRound: 0,
    hasUsedDropIt: false,
    createdAt: Timestamp.now(),
    lastActivity: Timestamp.now(),
  };
  
  await setDoc(roomRef, room);
  return room;
}

/**
 * Join an existing room
 * @param code - The room code to join
 * @param playerId - The anonymous ID of the player joining
 * @throws Error if room doesn't exist, is full, or game already started
 */
export async function joinRoom(code: string, playerId: string): Promise<Room> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, code.toUpperCase());
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    throw new Error('Room not found');
  }
  
  const room = roomSnap.data() as Room;
  
  // Check if player is already in the room
  if (room.players.includes(playerId)) {
    return room;
  }
  
  // Check if room is full
  if (room.players.length >= room.maxPlayers) {
    throw new Error('Room is full');
  }
  
  // Check if game has already started
  if (room.status === 'playing') {
    throw new Error('Game has already started');
  }
  
  // Add player to room
  await updateDoc(roomRef, {
    players: arrayUnion(playerId),
    lastActivity: serverTimestamp(),
  });
  
  // Fetch and return updated room
  const updatedSnap = await getDoc(roomRef);
  return updatedSnap.data() as Room;
}

/**
 * Leave a room
 * @param code - The room code
 * @param playerId - The anonymous ID of the player leaving
 */
export async function leaveRoom(code: string, playerId: string): Promise<void> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, code);
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    return;
  }
  
  const room = roomSnap.data() as Room;
  
  // Remove player from room
  await updateDoc(roomRef, {
    players: arrayRemove(playerId),
    lastActivity: serverTimestamp(),
  });
  
  // If the host left and there are other players, assign new host
  if (room.hostId === playerId && room.players.length > 1) {
    const remainingPlayers = room.players.filter(id => id !== playerId);
    if (remainingPlayers.length > 0) {
      await updateDoc(roomRef, {
        hostId: remainingPlayers[0],
      });
    }
  }
}

/**
 * Start the game in a room
 * @param code - The room code
 * @param mode - The initial game mode
 * @throws Error if not enough players
 */
export async function startGame(code: string, mode: GameMode): Promise<void> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, code);
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    throw new Error('Room not found');
  }
  
  const room = roomSnap.data() as Room;
  
  // Check minimum players
  if (room.players.length < room.minPlayers) {
    throw new Error(`Need at least ${room.minPlayers} players to start`);
  }
  
  // Delete all old rounds from previous games (for Play Again functionality)
  const roundsRef = collection(db, COLLECTIONS.ROOMS, code, COLLECTIONS.ROUNDS);
  const existingRounds = await getDocs(roundsRef);
  const deletePromises = existingRounds.docs.map((roundDoc) => 
    deleteDoc(doc(db, COLLECTIONS.ROOMS, code, COLLECTIONS.ROUNDS, roundDoc.id))
  );
  await Promise.all(deletePromises);
  console.log(`Deleted ${existingRounds.size} old rounds for room ${code}`);
  
  // Reset room state for new game
  const updates: Partial<Room> = {
    status: 'playing',
    currentMode: mode,
    currentRound: 1,
    hasUsedDropIt: mode === 'drop', // Reset and set based on starting mode
    lastActivity: Timestamp.now(),
  };
  
  await updateDoc(roomRef, updates);
  
  // Create the first round document
  const roundRef = doc(collection(db, COLLECTIONS.ROOMS, code, COLLECTIONS.ROUNDS));
  const round: Round = {
    promptIndex: getRandomPromptIndex(mode),
    mode,
    submissions: {},
    reactions: {},
    createdAt: Timestamp.now(),
    revealedAt: null,
  };
  
  await setDoc(roundRef, round);
}

/**
 * End the game in a room
 * @param code - The room code
 */
export async function endGame(code: string): Promise<void> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, code);
  
  await updateDoc(roomRef, {
    status: 'ended',
    lastActivity: serverTimestamp(),
  });
}

/**
 * Reset room to waiting state (for Play Again functionality)
 * @param code - The room code
 */
export async function resetRoom(code: string): Promise<void> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, code);
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    throw new Error('Room not found');
  }
  
  await updateDoc(roomRef, {
    status: 'waiting',
    currentMode: null,
    currentRound: 0,
    lastActivity: serverTimestamp(),
  });
}

/**
 * Get a room by code
 * @param code - The room code
 * @returns The room object or null if not found
 */
export async function getRoom(code: string): Promise<Room | null> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, code.toUpperCase());
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    return null;
  }
  
  return roomSnap.data() as Room;
}

/**
 * Update the last activity timestamp for a room
 * @param code - The room code
 */
export async function updateRoomActivity(code: string): Promise<void> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, code);
  
  try {
    await updateDoc(roomRef, {
      lastActivity: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating room activity:', error);
  }
}

/**
 * Check if a player is the host of a room
 * @param code - The room code
 * @param playerId - The player ID to check
 */
export async function isHost(code: string, playerId: string): Promise<boolean> {
  const room = await getRoom(code);
  return room?.hostId === playerId;
}

/**
 * Mark Drop It as used for a room
 * @param code - The room code
 */
export async function markDropItUsed(code: string): Promise<void> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, code);
  
  await updateDoc(roomRef, {
    hasUsedDropIt: true,
  });
}
