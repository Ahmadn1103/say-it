import { Timestamp } from 'firebase/firestore';

// Game modes
export type GameMode = 'sentence' | 'drop' | 'context';

// Room status
export type RoomStatus = 'waiting' | 'playing' | 'ended';

/**
 * Global capacity tracking
 * Collection: /global/capacity
 */
export interface GlobalCapacity {
  activeUsers: number;
  lastUpdated: Timestamp;
}

/**
 * Player scores tracking
 * Key: playerId, Value: cumulative correct guesses
 */
export type PlayerScores = {
  [playerId: string]: number;
};

/**
 * Player names tracking
 * Key: playerId, Value: display name
 */
export type PlayerNames = {
  [playerId: string]: string;
};

/**
 * Room document
 * Collection: /rooms/{roomCode}
 */
export interface Room {
  code: string;                 // 6-char uppercase
  hostId: string;                // Anonymous device ID
  players: string[];             // Array of anonymous player IDs
  playerNames: PlayerNames;      // Map of playerId to display name
  maxPlayers: number;            // Default: 12
  minPlayers: number;            // Default: 2
  status: RoomStatus;
  currentMode: GameMode | null;
  currentRound: number;
  hasUsedDropIt: boolean;        // Can only use Drop It once per game
  scores: PlayerScores;          // Cumulative correct guesses per player
  createdAt: Timestamp;
  lastActivity: Timestamp;
}

/**
 * Submission data for a round
 */
export interface Submission {
  content: string;               // Text or image URL
  submittedAt: Timestamp;
  isImage: boolean;
}

/**
 * Reaction counts per submission
 * Key: emoji, Value: count
 */
export type ReactionCounts = {
  [emoji: string]: number;
};

/**
 * Reactions per submission
 * Key: playerId (submitter), Value: emoji counts
 */
export type Reactions = {
  [playerId: string]: ReactionCounts;
};

/**
 * Guesses made by a single player
 * Key: submissionPlayerId (who they're guessing about), Value: guessedPlayerId (their guess)
 */
export type PlayerGuesses = {
  [submissionPlayerId: string]: string;
};

/**
 * All guesses for a round
 * Key: guessingPlayerId, Value: their guesses for each submission
 */
export type Guesses = {
  [guessingPlayerId: string]: PlayerGuesses;
};

/**
 * All submissions for a round
 * Key: playerId, Value: their submission
 */
export type Submissions = {
  [playerId: string]: Submission;
};

/**
 * Round document
 * Collection: /rooms/{roomCode}/rounds/{roundId}
 */
export interface Round {
  promptIndex: number;
  mode: GameMode;
  submissions: Submissions;
  reactions: Reactions;
  guesses: Guesses;              // Track who guessed what
  guessesLockedBy: string[];     // Array of player IDs who have locked in their guesses
  createdAt: Timestamp;          // When this round was created
  revealedAt: Timestamp | null;  // When answers were revealed (guessing phase starts)
  resultsStartedAt: Timestamp | null; // When results phase started
}

/**
 * Report document
 * Collection: /reports/{reportId}
 */
export interface Report {
  roomCode: string;
  roundId: string;
  submissionIndex: number;
  reportedBy: string;            // Anonymous player ID
  reportedAt: Timestamp;
  content: string;               // Snapshot of reported content
  reportCount: number;
}

/**
 * Helper type for creating new documents (without auto-generated fields)
 */
export type NewRoom = Omit<Room, 'createdAt' | 'lastActivity'> & {
  createdAt?: Timestamp;
  lastActivity?: Timestamp;
};

export type NewRound = Omit<Round, 'revealedAt'> & {
  revealedAt?: Timestamp | null;
};

export type NewReport = Omit<Report, 'reportedAt'> & {
  reportedAt?: Timestamp;
};
