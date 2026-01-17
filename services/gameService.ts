import { db } from '@/config/firebase';
import { GameMode, PlayerScores, Room, Round, Submission } from '@/config/firestore-schema';
import { COLLECTIONS } from '@/constants/config';
import { getUnusedPromptIndex } from '@/constants/prompts';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { updateRoomActivity } from './roomService';

/**
 * Create a new round for the game
 * @param roomCode - The room code
 * @param mode - The game mode for this round
 * @returns The round ID
 */
export async function createRound(roomCode: string, mode: GameMode): Promise<string> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    throw new Error('Room not found');
  }
  
  const room = roomSnap.data() as Room;
  const roundNumber = room.currentRound + 1;
  
  // Get used prompt indexes
  const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
  const roundsSnap = await getDocs(roundsRef);
  const usedIndexes = new Set<number>();
  roundsSnap.docs.forEach((doc) => {
    const roundData = doc.data() as Round;
    usedIndexes.add(roundData.promptIndex);
  });
  
  // Get an unused prompt index
  const promptIndex = getUnusedPromptIndex(mode, usedIndexes);
  if (promptIndex === -1) {
    throw new Error('No more prompts available');
  }
  
  // Create round document
  const roundRef = doc(collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS));
  const roundId = roundRef.id;
  
  const round: Round = {
    promptIndex,
    mode,
    submissions: {},
    reactions: {},
    guesses: {},
    guessesLockedBy: [],
    createdAt: Timestamp.now(),
    revealedAt: null,
    resultsStartedAt: null,
  };
  
  await setDoc(roundRef, round);
  
  // Update room
  const updates: Partial<Room> = {
    currentRound: roundNumber,
    currentMode: mode,
    lastActivity: Timestamp.now(),
  };
  
  // Mark Drop It as used if this is a Drop It round
  if (mode === 'drop') {
    updates.hasUsedDropIt = true;
  }
  
  await updateDoc(roomRef, updates);
  
  return roundId;
}

/**
 * Submit an answer for the current round
 * @param roomCode - The room code
 * @param roundId - The round ID
 * @param playerId - The player's anonymous ID
 * @param content - The submission content (text or image URL)
 * @param isImage - Whether this is an image submission
 */
export async function submitAnswer(
  roomCode: string,
  roundId: string,
  playerId: string,
  content: string,
  isImage: boolean = false
): Promise<void> {
  const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
  
  const submission: Submission = {
    content,
    submittedAt: Timestamp.now(),
    isImage,
  };
  
  await updateDoc(roundRef, {
    [`submissions.${playerId}`]: submission,
  });
  
  await updateRoomActivity(roomCode);
}

/**
 * Check if all players have submitted their answers
 * @param roomCode - The room code
 * @param roundId - The round ID
 * @returns True if all players have submitted
 */
export async function checkAllSubmitted(roomCode: string, roundId: string): Promise<boolean> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
  const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
  
  const [roomSnap, roundSnap] = await Promise.all([
    getDoc(roomRef),
    getDoc(roundRef),
  ]);
  
  if (!roomSnap.exists() || !roundSnap.exists()) {
    return false;
  }
  
  const room = roomSnap.data() as Room;
  const round = roundSnap.data() as Round;
  
  const submissionCount = Object.keys(round.submissions).length;
  return submissionCount === room.players.length;
}

/**
 * Reveal answers for a round
 * @param roomCode - The room code
 * @param roundId - The round ID
 */
export async function revealAnswers(roomCode: string, roundId: string): Promise<void> {
  const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
  
  await updateDoc(roundRef, {
    revealedAt: serverTimestamp(),
  });
  
  await updateRoomActivity(roomCode);
}

/**
 * Add an emoji reaction to a submission
 * @param roomCode - The room code
 * @param roundId - The round ID
 * @param submissionPlayerId - The player ID whose submission is being reacted to
 * @param emoji - The emoji to react with
 */
export async function addReaction(
  roomCode: string,
  roundId: string,
  submissionPlayerId: string,
  emoji: string
): Promise<void> {
  const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
  
  // Increment the emoji count for this submission
  await updateDoc(roundRef, {
    [`reactions.${submissionPlayerId}.${emoji}`]: increment(1),
  });
  
  await updateRoomActivity(roomCode);
}

/**
 * Add a guess for who submitted a particular answer
 * @param roomCode - The room code
 * @param roundId - The round ID
 * @param guessingPlayerId - The player making the guess
 * @param submissionPlayerId - The player ID of the submission being guessed
 * @param guessedPlayerId - The player ID they're guessing
 */
export async function addGuess(
  roomCode: string,
  roundId: string,
  guessingPlayerId: string,
  submissionPlayerId: string,
  guessedPlayerId: string
): Promise<void> {
  const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
  
  await updateDoc(roundRef, {
    [`guesses.${guessingPlayerId}.${submissionPlayerId}`]: guessedPlayerId,
  });
  
  await updateRoomActivity(roomCode);
}

/**
 * Lock a player's guesses for the round
 * @param roomCode - The room code
 * @param roundId - The round ID
 * @param playerId - The player locking their guesses
 */
export async function lockGuesses(
  roomCode: string,
  roundId: string,
  playerId: string
): Promise<void> {
  const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
  
  // Use arrayUnion for atomic update (handles concurrent updates)
  await updateDoc(roundRef, {
    guessesLockedBy: arrayUnion(playerId),
  });
  
  await updateRoomActivity(roomCode);
}

/**
 * Start the results phase with a server timestamp
 * @param roomCode - The room code
 * @param roundId - The round ID
 */
export async function startResultsPhase(
  roomCode: string,
  roundId: string
): Promise<void> {
  const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
  
  await updateDoc(roundRef, {
    resultsStartedAt: serverTimestamp(),
  });
  
  await updateRoomActivity(roomCode);
}

/**
 * Check if all players have locked in their guesses
 * @param roomCode - The room code
 * @param roundId - The round ID
 * @returns True if all players have locked their guesses
 */
export async function checkAllGuessesLocked(
  roomCode: string,
  roundId: string
): Promise<boolean> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
  const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
  
  const [roomSnap, roundSnap] = await Promise.all([
    getDoc(roomRef),
    getDoc(roundRef),
  ]);
  
  if (!roomSnap.exists() || !roundSnap.exists()) {
    return false;
  }
  
  const room = roomSnap.data() as Room;
  const round = roundSnap.data() as Round;
  
  const lockedCount = round.guessesLockedBy?.length || 0;
  return lockedCount === room.players.length;
}

/**
 * Calculate round scores - how many correct guesses each player made
 * @param roomCode - The room code
 * @param roundId - The round ID
 * @returns Object mapping playerId to their correct guess count for this round
 */
export async function calculateRoundScores(
  roomCode: string,
  roundId: string
): Promise<PlayerScores> {
  const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
  const roundSnap = await getDoc(roundRef);
  
  if (!roundSnap.exists()) {
    throw new Error('Round not found');
  }
  
  const round = roundSnap.data() as Round;
  const roundScores: PlayerScores = {};
  
  // For each player who made guesses
  Object.entries(round.guesses || {}).forEach(([guessingPlayerId, playerGuesses]) => {
    let correctCount = 0;
    
    // Check each of their guesses
    Object.entries(playerGuesses).forEach(([submissionPlayerId, guessedPlayerId]) => {
      // A guess is correct if they guessed the actual submitter
      if (guessedPlayerId === submissionPlayerId) {
        correctCount++;
      }
    });
    
    roundScores[guessingPlayerId] = correctCount;
  });
  
  return roundScores;
}

/**
 * Update cumulative scores in the room
 * @param roomCode - The room code
 * @param roundScores - The scores from the current round
 */
export async function updateRoomScores(
  roomCode: string,
  roundScores: PlayerScores
): Promise<void> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
  
  // Build update object to increment each player's score
  const updates: { [key: string]: ReturnType<typeof increment> } = {};
  
  Object.entries(roundScores).forEach(([playerId, score]) => {
    updates[`scores.${playerId}`] = increment(score);
  });
  
  if (Object.keys(updates).length > 0) {
    await updateDoc(roomRef, updates);
  }
  
  await updateRoomActivity(roomCode);
}

/**
 * Get the number of players who haven't locked guesses yet
 * @param roomCode - The room code
 * @param roundId - The round ID
 * @returns The count of players who haven't locked guesses
 */
export async function getWaitingGuessCount(
  roomCode: string,
  roundId: string
): Promise<number> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
  const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
  
  const [roomSnap, roundSnap] = await Promise.all([
    getDoc(roomRef),
    getDoc(roundRef),
  ]);
  
  if (!roomSnap.exists() || !roundSnap.exists()) {
    return 0;
  }
  
  const room = roomSnap.data() as Room;
  const round = roundSnap.data() as Round;
  
  const lockedCount = round.guessesLockedBy?.length || 0;
  return room.players.length - lockedCount;
}

/**
 * Start the next round
 * @param roomCode - The room code
 * @param mode - The game mode for the next round
 * @returns The new round ID
 */
export async function nextRound(roomCode: string, mode: GameMode): Promise<string> {
  // Check if Drop It can be used
  const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    throw new Error('Room not found');
  }
  
  const room = roomSnap.data() as Room;
  
  if (mode === 'drop' && room.hasUsedDropIt) {
    throw new Error('Drop It mode has already been used in this game');
  }
  
  return await createRound(roomCode, mode);
}

/**
 * Get a round by ID
 * @param roomCode - The room code
 * @param roundId - The round ID
 * @returns The round object or null if not found
 */
export async function getRound(roomCode: string, roundId: string): Promise<Round | null> {
  const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
  const roundSnap = await getDoc(roundRef);
  
  if (!roundSnap.exists()) {
    return null;
  }
  
  return roundSnap.data() as Round;
}

/**
 * Get all rounds for a room
 * @param roomCode - The room code
 * @returns Array of rounds with their IDs
 */
export async function getAllRounds(roomCode: string): Promise<Array<Round & { id: string }>> {
  const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
  const roundsQuery = query(roundsRef, orderBy('revealedAt', 'desc'));
  const roundsSnap = await getDocs(roundsQuery);
  
  return roundsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as Round,
  }));
}

/**
 * Get the number of players who haven't submitted yet
 * @param roomCode - The room code
 * @param roundId - The round ID
 * @returns The count of players who haven't submitted
 */
export async function getWaitingPlayerCount(roomCode: string, roundId: string): Promise<number> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
  const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
  
  const [roomSnap, roundSnap] = await Promise.all([
    getDoc(roomRef),
    getDoc(roundRef),
  ]);
  
  if (!roomSnap.exists() || !roundSnap.exists()) {
    return 0;
  }
  
  const room = roomSnap.data() as Room;
  const round = roundSnap.data() as Round;
  
  const submissionCount = Object.keys(round.submissions).length;
  return room.players.length - submissionCount;
}

/**
 * Generate an end-game summary
 * @param roomCode - The room code
 * @returns A summary object with game statistics
 */
export async function generateSummary(roomCode: string): Promise<{
  totalRounds: number;
  totalReactions: number;
  mostReactedEmoji: string | null;
  usedDropIt: boolean;
}> {
  const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    throw new Error('Room not found');
  }
  
  const room = roomSnap.data() as Room;
  const rounds = await getAllRounds(roomCode);
  
  let totalReactions = 0;
  const emojiCounts: { [emoji: string]: number } = {};
  
  // Aggregate reactions across all rounds
  rounds.forEach(round => {
    Object.values(round.reactions || {}).forEach(submissionReactions => {
      Object.entries(submissionReactions).forEach(([emoji, count]) => {
        totalReactions += count;
        emojiCounts[emoji] = (emojiCounts[emoji] || 0) + count;
      });
    });
  });
  
  // Find most reacted emoji
  let mostReactedEmoji: string | null = null;
  let maxCount = 0;
  Object.entries(emojiCounts).forEach(([emoji, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostReactedEmoji = emoji;
    }
  });
  
  return {
    totalRounds: rounds.length,
    totalReactions,
    mostReactedEmoji,
    usedDropIt: room.hasUsedDropIt,
  };
}
