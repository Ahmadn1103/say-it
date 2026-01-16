import { GameMode } from '@/config/firestore-schema';

/**
 * Game prompts by mode
 */

// Mode 1: Finish the Sentence (60 char limit)
export const SENTENCE_PROMPTS = [
  "I act confident but actually ___",
  "People think I'm chill but ___",
  "I disappear when ___",
  "I say 'I'm fine' when ___",
  "I get defensive when ___",
  "Something I pretend not to care about is ___",
  "I avoid talking about ___",
  "I secretly want ___",
  "I shut down when ___",
  "I'm scared people will notice ___",
] as const;

// Mode 2: Drop It (image submission)
export const DROP_IT_PROMPTS = [
  "Drop your home screen",
  "Drop your lock screen",
  "Drop the last photo you took",
  "Drop the last meme you saved",
  "Drop a song you're currently overplaying",
  "Drop a song that matches your mood",
  "Drop a screenshot that explains your week",
  "Drop your most used app",
  "Drop something that feels very 'you'",
] as const;

// Mode 3: No Context (single word/emoji only)
export const CONTEXT_PROMPTS = [
  "How are you actually doing?",
  "Your current mood",
  "What's draining you?",
  "What are you avoiding?",
  "Your energy level this week",
  "How life feels right now",
  "Your stress level",
  "What you need more of",
  "Your mindset lately",
] as const;

/**
 * Get prompts for a specific game mode
 */
export function getPromptsForMode(mode: GameMode): readonly string[] {
  switch (mode) {
    case 'sentence':
      return SENTENCE_PROMPTS;
    case 'drop':
      return DROP_IT_PROMPTS;
    case 'context':
      return CONTEXT_PROMPTS;
    default:
      return SENTENCE_PROMPTS;
  }
}

/**
 * Get a random prompt index for a mode
 */
export function getRandomPromptIndex(mode: GameMode): number {
  const prompts = getPromptsForMode(mode);
  return Math.floor(Math.random() * prompts.length);
}

/**
 * Get an unused prompt index for a mode
 * @param mode - The game mode
 * @param usedIndexes - Set of already used prompt indexes
 * @returns An unused prompt index, or -1 if all prompts are used
 */
export function getUnusedPromptIndex(mode: GameMode, usedIndexes: Set<number>): number {
  const prompts = getPromptsForMode(mode);
  const availableIndexes: number[] = [];
  
  for (let i = 0; i < prompts.length; i++) {
    if (!usedIndexes.has(i)) {
      availableIndexes.push(i);
    }
  }
  
  if (availableIndexes.length === 0) {
    return -1; // All prompts used
  }
  
  // Return a random unused index
  return availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
}

/**
 * Get a specific prompt by mode and index
 */
export function getPrompt(mode: GameMode, index: number): string {
  const prompts = getPromptsForMode(mode);
  return prompts[index] || prompts[0];
}
