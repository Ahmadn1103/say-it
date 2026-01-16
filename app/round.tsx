import { PromptDisplay } from '@/components/game/PromptDisplay';
import { db } from '@/config/firebase';
import { GameMode, Room, Round } from '@/config/firestore-schema';
import { COLLECTIONS, GAME_CONFIG } from '@/constants/config';
import { getPrompt, getPromptsForMode } from '@/constants/prompts';
import { checkAllSubmitted, revealAnswers, submitAnswer } from '@/services/gameService';
import { compressImage, pickImageFromLibrary, uploadToStorage } from '@/services/imageService';
import { endGame } from '@/services/roomService';
import { getAnonymousId } from '@/utils/anonymousId';
import { containsProfanity } from '@/utils/profanityFilter';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function RoundScreen() {
  const params = useLocalSearchParams();
  const roomCode = params.roomCode as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [currentRoundId, setCurrentRoundId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [answer, setAnswer] = useState('');
  const [imageUri, setImageUri] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const [countdown, setCountdown] = useState(15);
  const [usedPromptIndexes, setUsedPromptIndexes] = useState<Set<number>>(new Set());
  const [isHost, setIsHost] = useState(false);
  const hasAutoSkippedRef = useRef(false);

  useEffect(() => {
    getAnonymousId().then(setPlayerId);
  }, []);

  useEffect(() => {
    // Subscribe to room updates
    const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        Alert.alert('Room Ended', 'This room no longer exists');
        router.replace('/');
        return;
      }

      const roomData = snapshot.data() as Room;
      setRoom(roomData);
      setIsHost(roomData.hostId === playerId);

      if (roomData.status === 'ended') {
        router.replace({
          pathname: '/summary',
          params: { roomCode },
        });
      }
    });

    return () => unsubscribe();
  }, [roomCode, playerId]);

  useEffect(() => {
    if (!room) return;

    // Subscribe to current round (order by createdAt to get the latest round)
    const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
    const q = query(roundsRef, orderBy('createdAt', 'desc'), limit(1));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) return;

      const roundDoc = snapshot.docs[0];
      const roundData = roundDoc.data() as Round;
      
      // Check if this is a new round (reset states)
      if (roundDoc.id !== currentRoundId) {
        setCurrentRoundId(roundDoc.id);
        setCurrentRound(roundData);
        setHasSubmitted(false);
        setAnswer('');
        setImageUri('');
        setCountdown(15);
        hasAutoSkippedRef.current = false;
        
        // Check if player already submitted in this round
        if (playerId && roundData.submissions[playerId]) {
          setHasSubmitted(true);
        }
      } else {
        setCurrentRound(roundData);
        
        // Check if player has submitted
        if (playerId && roundData.submissions[playerId]) {
          setHasSubmitted(true);
        }
      }

      // Calculate waiting count
      const submittedCount = Object.keys(roundData.submissions).length;
      setWaitingCount(room.players.length - submittedCount);

      // Check if all submitted and round is revealed
      if (roundData.revealedAt) {
        router.replace({
          pathname: '/reveal',
          params: { roomCode, roundId: roundDoc.id },
        });
      }
    });

    return () => unsubscribe();
  }, [room, roomCode, playerId, currentRoundId]);

  // Subscribe to all rounds to track used prompt indexes
  useEffect(() => {
    if (!room) return;

    const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
    const unsubscribe = onSnapshot(roundsRef, (snapshot) => {
      const usedIndexes = new Set<number>();
      snapshot.docs.forEach((doc) => {
        const roundData = doc.data() as Round;
        usedIndexes.add(roundData.promptIndex);
      });
      setUsedPromptIndexes(usedIndexes);
    });

    return () => unsubscribe();
  }, [room, roomCode]);

  // Countdown timer
  useEffect(() => {
    if (!room || !currentRound || hasSubmitted || hasAutoSkippedRef.current) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [room, currentRound, hasSubmitted, currentRoundId]);

  // Auto-skip when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && !hasSubmitted && !hasAutoSkippedRef.current && currentRound && playerId) {
      hasAutoSkippedRef.current = true;
      handleAutoSkip();
    }
  }, [countdown, hasSubmitted, currentRound, playerId]);

  // Auto-skip function
  const handleAutoSkip = useCallback(async () => {
    if (!currentRound || !playerId || !room || !currentRoundId) return;

    try {
      setIsSubmitting(true);
      
      // Submit "⏱️ Time's up!" as the answer
      await submitAnswer(roomCode, currentRoundId, playerId, '⏱️ Time\'s up!', false);
      
      setHasSubmitted(true);

      // Check if all submitted and trigger reveal
      const allSubmitted = await checkAllSubmitted(roomCode, currentRoundId);
      if (allSubmitted) {
        await revealAnswers(roomCode, currentRoundId);
      }
    } catch (error) {
      console.error('Error auto-skipping:', error);
      hasAutoSkippedRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }, [currentRound, playerId, room, roomCode, currentRoundId]);

  // Check if all prompts are used and end game (host only)
  const checkAndEndGameIfNoPrompts = useCallback(async () => {
    if (!room || !isHost || !currentRound) return false;

    const totalPrompts = getPromptsForMode(currentRound.mode).length;
    if (usedPromptIndexes.size >= totalPrompts) {
      // All prompts used, end the game
      try {
        await endGame(roomCode);
        return true;
      } catch (error) {
        console.error('Error ending game:', error);
      }
    }
    return false;
  }, [room, isHost, currentRound, usedPromptIndexes, roomCode]);

  const validateInput = (mode: GameMode, input: string): string | null => {
    if (!input.trim()) {
      return 'Please enter your answer';
    }

    if (mode === 'sentence') {
      if (input.length > GAME_CONFIG.MODE1_MAX_CHARS) {
        return `Maximum ${GAME_CONFIG.MODE1_MAX_CHARS} characters`;
      }
      if (containsProfanity(input)) {
        return 'Please rephrase your answer';
      }
    }

    if (mode === 'context') {
      // Check if single word or single emoji
      const trimmed = input.trim();
      const words = trimmed.split(/\s+/);
      
      // Allow single emoji or single word
      const emojiRegex = /^[\p{Emoji_Presentation}\p{Emoji}\uFE0F]+$/u;
      if (words.length > 1 || (words.length === 1 && !emojiRegex.test(trimmed) && trimmed.length > 30)) {
        return 'One word or one emoji only';
      }
    }

    return null;
  };

  const handlePickImage = async () => {
    try {
      const uri = await pickImageFromLibrary();
      if (uri) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setImageUri(uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSubmit = async () => {
    if (!currentRound || !playerId || !room) return;

    const mode = currentRound.mode;

    try {
      setIsSubmitting(true);

      let content = answer;

      // Validate and process based on mode
      if (mode === 'drop') {
        if (!imageUri) {
          Alert.alert('No Image', 'Please select an image');
          return;
        }

        // Compress and upload image
        const compressedUri = await compressImage(imageUri);
        const imageUrl = await uploadToStorage(roomCode, compressedUri);
        content = imageUrl;
      } else {
        const validationError = validateInput(mode, answer);
        if (validationError) {
          Alert.alert('Invalid Input', validationError);
          return;
        }
      }

      // Submit answer
      const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
      const q = query(roundsRef, orderBy('createdAt', 'desc'), limit(1));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const roundId = snapshot.docs[0].id;
        await submitAnswer(roomCode, roundId, playerId, content, mode === 'drop');
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setHasSubmitted(true);

        // Check if all submitted and trigger reveal
        const allSubmitted = await checkAllSubmitted(roomCode, roundId);
        if (allSubmitted) {
          await revealAnswers(roomCode, roundId);
          // Navigation will happen via the round listener when revealedAt is set
        }
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      Alert.alert('Error', 'Failed to submit answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!currentRound || !playerId || !room) return;

    try {
      setIsSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Submit a skip marker
      const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
      const q = query(roundsRef, orderBy('createdAt', 'desc'), limit(1));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const roundId = snapshot.docs[0].id;
        // Submit "⏭️ Skipped" as the answer
        await submitAnswer(roomCode, roundId, playerId, '⏭️ Skipped', false);
        
        setHasSubmitted(true);

        // Check if all submitted and trigger reveal
        const allSubmitted = await checkAllSubmitted(roomCode, roundId);
        if (allSubmitted) {
          await revealAnswers(roomCode, roundId);
        }
      }
    } catch (error) {
      console.error('Error skipping:', error);
      Alert.alert('Error', 'Failed to skip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaveGame = () => {
    if (Platform.OS === 'web') {
      // Use window.confirm for web
      const confirmed = window.confirm('Are you sure you want to leave? You can join a new game from the home screen.');
      if (confirmed) {
        router.replace('/');
      }
    } else {
      // Use Alert.alert for native
      Alert.alert(
        'Leave Game',
        'Are you sure you want to leave? You can join a new game from the home screen.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.replace('/');
            },
          },
        ]
      );
    }
  };

  if (!room || !currentRound) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading round...</Text>
      </View>
    );
  }

  const prompt = getPrompt(currentRound.mode, currentRound.promptIndex);

  // Calculate prompts progress
  const totalPrompts = getPromptsForMode(currentRound.mode).length;
  const currentPromptNumber = usedPromptIndexes.size;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Timer */}
        {!hasSubmitted && (
          <View style={styles.timerContainer}>
            <View style={[styles.timerCircle, countdown <= 5 && styles.timerCircleWarning]}>
              <Text style={[styles.timerText, countdown <= 5 && styles.timerTextWarning]}>{countdown}</Text>
            </View>
            <Text style={styles.promptProgress}>
              Prompt {currentPromptNumber} of {totalPrompts}
            </Text>
          </View>
        )}

        <View style={styles.content}>
          {/* Prompt Display */}
          <PromptDisplay prompt={prompt} mode={currentRound.mode} />

        {!hasSubmitted ? (
          <>
            {/* Input Area */}
            <View style={styles.inputContainer}>
              {currentRound.mode === 'drop' ? (
                <View style={styles.imagePickerContainer}>
                  {imageUri ? (
                    <View style={styles.imagePreview}>
                      <Image source={{ uri: imageUri }} style={styles.previewImage} />
                      <TouchableOpacity style={styles.changeButton} onPress={handlePickImage}>
                        <Text style={styles.changeButtonText}>Change Image</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.pickButton} onPress={handlePickImage}>
                      <Text style={styles.pickButtonIcon}>📸</Text>
                      <Text style={styles.pickButtonText}>Select Image</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TextInput
                  style={styles.textInput}
                  placeholder={currentRound.mode === 'context' ? 'One word or emoji...' : 'Type your answer...'}
                  placeholderTextColor="#666"
                  value={answer}
                  onChangeText={setAnswer}
                  multiline={currentRound.mode === 'sentence'}
                  maxLength={currentRound.mode === 'sentence' ? GAME_CONFIG.MODE1_MAX_CHARS : undefined}
                  autoFocus
                />
              )}

              {currentRound.mode === 'sentence' && (
                <Text style={styles.charCount}>
                  {answer.length} / {GAME_CONFIG.MODE1_MAX_CHARS}
                </Text>
              )}
            </View>

            {/* Button Row */}
            <View style={styles.buttonRow}>
              {/* Skip Button */}
              <TouchableOpacity
                style={[styles.skipButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleSkip}
                disabled={isSubmitting}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingIcon}>👀</Text>
            <Text style={styles.waitingText}>
              Waiting on {waitingCount} {waitingCount === 1 ? 'player' : 'players'}
            </Text>
            <ActivityIndicator size="large" color="#a855f7" style={{ marginTop: 20 }} />
            
            {/* Leave Game Button */}
            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGame}>
              <Text style={styles.leaveButtonText}>Leave Game</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Add missing import
import { getDocs } from 'firebase/firestore';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  timerContainer: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 8,
  },
  timerCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 3,
    borderColor: '#a855f7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  timerCircleWarning: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: '#FF3B30',
    shadowColor: '#FF3B30',
  },
  timerText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#a855f7',
  },
  timerTextWarning: {
    color: '#FF3B30',
  },
  promptProgress: {
    marginTop: 8,
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  inputContainer: {
    marginVertical: 24,
  },
  textInput: {
    backgroundColor: '#1C1C1E',
    padding: 20,
    borderRadius: 16,
    fontSize: 18,
    color: '#FFFFFF',
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 2,
    borderColor: '#2C2C2E',
  },
  charCount: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'right',
  },
  imagePickerContainer: {
    alignItems: 'center',
  },
  pickButton: {
    backgroundColor: '#1C1C1E',
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2C2C2E',
    borderStyle: 'dashed',
    width: '100%',
    minHeight: 300,
  },
  pickButtonIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  pickButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  imagePreview: {
    width: '100%',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    backgroundColor: '#1C1C1E',
  },
  changeButton: {
    marginTop: 16,
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  changeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
  },
  skipButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  skipButtonText: {
    color: '#9ca3af',
    fontSize: 18,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#a855f7',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  waitingIcon: {
    fontSize: 72,
    marginBottom: 24,
  },
  waitingText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  leaveButton: {
    marginTop: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  leaveButtonText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
  },
});
