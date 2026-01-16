/**
 * Game configuration constants
 */
export const GAME_CONFIG = {
  // Capacity limits
  MAX_CONCURRENT_USERS: 5000,
  
  // Player limits
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 12,
  RECOMMENDED_PLAYERS: '6-10',
  
  // Game mode constraints
  MODE1_MAX_CHARS: 60,           // Finish the Sentence max characters
  DROP_IT_MAX_SIZE_KB: 500,      // Drop It max image size
  DROP_IT_TIMEOUT_MINUTES: 15,   // Auto-delete Drop It images after this time
  
  // Monetization
  AD_FREQUENCY_ROUNDS: 3,        // Show interstitial ad every N rounds
  
  // Moderation
  AUTO_HIDE_REPORT_THRESHOLD: 3, // Auto-hide content after N reports
  
  // Room cleanup
  ROOM_INACTIVITY_HOURS: 24,     // Delete rooms inactive for this long
} as const;

/**
 * Firebase collection paths
 */
export const COLLECTIONS = {
  GLOBAL: 'global',
  ROOMS: 'rooms',
  ROUNDS: 'rounds',
  REPORTS: 'reports',
} as const;

/**
 * Firebase Storage paths
 */
export const STORAGE_PATHS = {
  DROP_IT: 'drop-it',
} as const;
