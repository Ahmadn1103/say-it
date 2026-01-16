// Create a dummy filter class as fallback
class DummyFilter {
  isProfane() { return false; }
  clean(text: string) { return text; }
  addWords() {}
  removeWords() {}
}

// Initialize the profanity filter with safe fallback
let filter: any;
try {
  // Try to load the bad-words package
  const BadWords = require('bad-words');
  
  // Handle different export formats
  let FilterClass = BadWords;
  if (typeof BadWords === 'object' && BadWords.default) {
    FilterClass = BadWords.default;
  }
  
  // Try to instantiate the filter
  if (typeof FilterClass === 'function') {
    filter = new FilterClass();
  } else {
    console.warn('bad-words: FilterClass is not a constructor, using dummy filter');
    filter = new DummyFilter();
  }
} catch (error) {
  console.warn('Failed to initialize profanity filter, using dummy filter:', error);
  filter = new DummyFilter();
}

/**
 * Add custom words to the filter list
 * Extend this array with any additional words specific to your app
 */
const CUSTOM_PROFANITY: string[] = [
  // Add custom words here as needed
];

// Add custom words to the filter
if (CUSTOM_PROFANITY.length > 0) {
  filter.addWords(...CUSTOM_PROFANITY);
}

/**
 * Check if text contains profanity
 * @param text - The text to check
 * @returns True if profanity is detected
 */
export function containsProfanity(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  try {
    return filter.isProfane(text);
  } catch (error) {
    console.error('Error checking profanity:', error);
    // Default to allowing text if check fails
    return false;
  }
}

/**
 * Filter profanity from text (replaces with asterisks)
 * @param text - The text to filter
 * @returns The filtered text
 */
export function filterText(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  try {
    return filter.clean(text);
  } catch (error) {
    console.error('Error filtering text:', error);
    return text;
  }
}

/**
 * Validate text before submission
 * @param text - The text to validate
 * @param maxLength - Maximum allowed length (optional)
 * @returns Object with isValid flag and optional error message
 */
export function validateSubmission(
  text: string,
  maxLength?: number
): { isValid: boolean; error?: string } {
  // Check if text is empty
  if (!text || text.trim().length === 0) {
    return {
      isValid: false,
      error: 'Please enter some text',
    };
  }
  
  // Check length if specified
  if (maxLength && text.length > maxLength) {
    return {
      isValid: false,
      error: `Text must be ${maxLength} characters or less`,
    };
  }
  
  // Check for profanity
  if (containsProfanity(text)) {
    return {
      isValid: false,
      error: 'Please rephrase your answer',
    };
  }
  
  return { isValid: true };
}

/**
 * Validate that input is a single word (for "No Context" mode)
 * @param text - The text to validate
 * @returns Object with isValid flag and optional error message
 */
export function validateSingleWord(text: string): { isValid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return {
      isValid: false,
      error: 'Please enter a word or emoji',
    };
  }
  
  // Check if it's a single emoji
  const emojiRegex = /^[\p{Emoji}\p{Emoji_Component}]+$/u;
  if (emojiRegex.test(text.trim())) {
    return { isValid: true };
  }
  
  // Check if it's a single word (no spaces)
  const trimmed = text.trim();
  if (trimmed.includes(' ')) {
    return {
      isValid: false,
      error: 'Only one word or emoji allowed',
    };
  }
  
  // Check for profanity
  if (containsProfanity(trimmed)) {
    return {
      isValid: false,
      error: 'Please use a different word',
    };
  }
  
  return { isValid: true };
}

/**
 * Get a list of profane words found in text (for debugging/testing)
 * @param text - The text to analyze
 * @returns Array of detected profane words
 */
export function getProfaneWords(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const words = text.toLowerCase().split(/\s+/);
  return words.filter(word => {
    try {
      return filter.isProfane(word);
    } catch {
      return false;
    }
  });
}

/**
 * Add words to the custom profanity list at runtime
 * @param words - Array of words to add
 */
export function addCustomProfanity(words: string[]): void {
  if (words && words.length > 0) {
    filter.addWords(...words);
  }
}

/**
 * Remove words from the profanity filter
 * Useful for allowing certain words that might be false positives
 * @param words - Array of words to remove from the filter
 */
export function removeFromFilter(words: string[]): void {
  if (words && words.length > 0) {
    filter.removeWords(...words);
  }
}

export default {
  containsProfanity,
  filterText,
  validateSubmission,
  validateSingleWord,
  getProfaneWords,
  addCustomProfanity,
  removeFromFilter,
};
