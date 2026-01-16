import { useInterstitialAd } from '@/components/ads/InterstitialAdManager';
import { AnswerTile } from '@/components/game/AnswerTile';
import { ReportModal } from '@/components/modals/ReportModal';
import { db } from '@/config/firebase';
import { Room, Round } from '@/config/firestore-schema';
import { COLLECTIONS, GAME_CONFIG } from '@/constants/config';
import { getPromptsForMode } from '@/constants/prompts';
import { addReaction, nextRound } from '@/services/gameService';
import { endGame } from '@/services/roomService';
import { getAnonymousId } from '@/utils/anonymousId';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function RevealScreen() {
  const params = useLocalSearchParams();
  const roomCode = params.roomCode as string;
  const roundId = params.roundId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [submissions, setSubmissions] = useState<Array<{ content: string; isImage: boolean; index: number; playerId: string }>>([]);
  const [isHost, setIsHost] = useState(false);
  const [reportingIndex, setReportingIndex] = useState<number | null>(null);
  const [reportedIndexes, setReportedIndexes] = useState<Set<number>>(new Set());
  const [roundCount, setRoundCount] = useState(0);
  const [countdown, setCountdown] = useState(15);
  const [usedPromptIndexes, setUsedPromptIndexes] = useState<Set<number>>(new Set());
  const hasNavigatedRef = useRef(false);

  const { showAd, isLoaded: adLoaded } = useInterstitialAd();

  useEffect(() => {
    getAnonymousId().then(setPlayerId);
  }, []);

  useEffect(() => {
    // Subscribe to room
    const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
    const unsubscribe = onSnapshot(roomRef, async (snapshot) => {
      if (!snapshot.exists()) {
        Alert.alert('Room Ended', 'This room no longer exists');
        router.replace('/');
        return;
      }

      const roomData = snapshot.data() as Room;
      setRoom(roomData);
      setIsHost(roomData.hostId === playerId);

      // Check if game ended
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
    // Subscribe to round
    const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
    const unsubscribe = onSnapshot(roundRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const roundData = snapshot.data() as Round;
      setRound(roundData);

      // Convert submissions to array and shuffle
      const submissionsArray = Object.entries(roundData.submissions).map(
        ([playerId, submission], index) => ({
          content: submission.content,
          isImage: submission.isImage,
          index,
          playerId,
        })
      );

      // Shuffle to prevent position-based guessing
      const shuffled = submissionsArray.sort(() => Math.random() - 0.5);
      setSubmissions(shuffled);
    });

    return () => unsubscribe();
  }, [roomCode, roundId]);

  useEffect(() => {
    // Count rounds for ad display and track used prompts
    const getRoundCount = async () => {
      const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
      const snapshot = await getDocs(roundsRef);
      setRoundCount(snapshot.size);
      
      // Track used prompt indexes
      const usedIndexes = new Set<number>();
      snapshot.docs.forEach((doc) => {
        const roundData = doc.data() as Round;
        usedIndexes.add(roundData.promptIndex);
      });
      setUsedPromptIndexes(usedIndexes);
    };
    getRoundCount();
  }, [roomCode]);

  // Listen for new rounds (for non-host players to auto-navigate)
  useEffect(() => {
    if (hasNavigatedRef.current) return;

    const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
    const unsubscribe = onSnapshot(roundsRef, (snapshot) => {
      // Check if there's a new round (not revealed yet)
      const newRound = snapshot.docs.find((doc) => {
        const data = doc.data() as Round;
        return !data.revealedAt && doc.id !== roundId;
      });

      if (newRound && !hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        router.replace({
          pathname: '/round',
          params: { roomCode },
        });
      }
    });

    return () => unsubscribe();
  }, [roomCode, roundId]);

  // Define handleNextRoundAuto before the effects that use it
  const handleNextRoundAuto = useCallback(async () => {
    if (!room) {
      console.log('handleNextRoundAuto: No room, skipping');
      return;
    }

    try {
      console.log('handleNextRoundAuto: Starting next round...');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Refresh used prompt indexes before checking
      const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
      const snapshot = await getDocs(roundsRef);
      const currentUsedIndexes = new Set<number>();
      snapshot.docs.forEach((docSnap) => {
        const roundData = docSnap.data() as Round;
        currentUsedIndexes.add(roundData.promptIndex);
      });

      // Check if all prompts have been used
      const totalPrompts = getPromptsForMode(room.currentMode!).length;
      console.log(`handleNextRoundAuto: Used ${currentUsedIndexes.size} of ${totalPrompts} prompts`);
      
      if (currentUsedIndexes.size >= totalPrompts) {
        // No more prompts, end the game
        console.log('handleNextRoundAuto: No more prompts, ending game');
        await endGame(roomCode);
        // Navigation will happen via room status listener
        return;
      }

      // Show ad every 3 rounds
      if (roundCount > 0 && roundCount % GAME_CONFIG.AD_FREQUENCY_ROUNDS === 0 && adLoaded) {
        await showAd();
      }

      // Start next round with same mode
      console.log('handleNextRoundAuto: Calling nextRound...');
      await nextRound(roomCode, room.currentMode!);

      // Navigate to round screen
      console.log('handleNextRoundAuto: Navigating to round screen');
      router.replace({
        pathname: '/round',
        params: { roomCode },
      });
    } catch (error) {
      console.error('Error starting next round:', error);
      hasNavigatedRef.current = false; // Allow retry
    }
  }, [room, roomCode, roundCount, adLoaded, showAd]);

  // Countdown timer - auto advance after 15 seconds
  useEffect(() => {
    if (!room || !round || hasNavigatedRef.current) return;

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
  }, [room, round]);

  // Auto-advance when countdown reaches 0 (host triggers for everyone)
  useEffect(() => {
    if (countdown === 0 && isHost && !hasNavigatedRef.current && room) {
      console.log('Auto-advancing to next round...');
      hasNavigatedRef.current = true;
      handleNextRoundAuto();
    }
  }, [countdown, isHost, room, handleNextRoundAuto]);

  const handleReact = async (submissionPlayerId: string, emoji: string) => {
    if (!playerId) return;

    try {
      await addReaction(roomCode, roundId, submissionPlayerId, emoji);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleReport = async (index: number, reason: string) => {
    try {
      const submission = submissions[index];
      
      // Add to reports collection
      const reportsRef = collection(db, COLLECTIONS.REPORTS);
      await addDoc(reportsRef, {
        roomCode,
        roundId,
        submissionIndex: index,
        reportedBy: playerId,
        content: submission.content,
        reportCount: 1,
        reportedAt: serverTimestamp(),
      });

      setReportedIndexes((prev) => new Set(prev).add(index));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error reporting content:', error);
      throw error;
    }
  };

  const handleNextRound = async () => {
    if (!isHost || !room) return;
    if (hasNavigatedRef.current) return; // Prevent double-tap

    hasNavigatedRef.current = true;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Refresh used prompt indexes before checking
      const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
      const snapshot = await getDocs(roundsRef);
      const currentUsedIndexes = new Set<number>();
      snapshot.docs.forEach((docSnap) => {
        const roundData = docSnap.data() as Round;
        currentUsedIndexes.add(roundData.promptIndex);
      });

      // Check if all prompts have been used
      const totalPrompts = getPromptsForMode(room.currentMode!).length;
      if (currentUsedIndexes.size >= totalPrompts) {
        // No more prompts, end the game
        await endGame(roomCode);
        // Navigation will happen via room status listener
        return;
      }

      // Show ad every 3 rounds
      if (roundCount > 0 && roundCount % GAME_CONFIG.AD_FREQUENCY_ROUNDS === 0 && adLoaded) {
        await showAd();
      }

      // Start next round with same mode
      await nextRound(roomCode, room.currentMode!);

      // Navigate to round screen
      router.replace({
        pathname: '/round',
        params: { roomCode },
      });
    } catch (error) {
      console.error('Error starting next round:', error);
      hasNavigatedRef.current = false; // Allow retry
      Alert.alert('Error', 'Failed to start next round');
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

  const handleEndGame = async () => {
    if (!isHost) return;

    const doEndGame = async () => {
      try {
        await endGame(roomCode);
        // Navigation will happen via room status listener
      } catch (error) {
        console.error('Error ending game:', error);
        if (Platform.OS === 'web') {
          window.alert('Failed to end game');
        } else {
          Alert.alert('Error', 'Failed to end game');
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('This will end the game for all players. Are you sure?');
      if (confirmed) {
        await doEndGame();
      }
    } else {
      Alert.alert(
        'End Game',
        'This will end the game for all players. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End Game',
            style: 'destructive',
            onPress: doEndGame,
          },
        ]
      );
    }
  };

  if (!room || !round) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading results...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Countdown Timer */}
      <View style={styles.timerContainer}>
        <View style={styles.timerCircle}>
          <Text style={styles.timerText}>{countdown}</Text>
        </View>
        <Text style={styles.timerLabel}>Next round in</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>What Everyone Said</Text>

        {/* Submissions - Centered */}
        <View style={styles.submissionsContainer}>
          {submissions.map((submission) => (
            <AnswerTile
              key={submission.index}
              content={submission.content}
              isImage={submission.isImage}
              isBlurred={false}
              reactions={round.reactions?.[submission.playerId] || {}}
              onReact={(emoji) => handleReact(submission.playerId, emoji)}
              onReport={() => setReportingIndex(submission.index)}
              isReported={reportedIndexes.has(submission.index)}
            />
          ))}
        </View>

        {/* Controls - Show for all players */}
        <View style={styles.controlsContainer}>
          {/* Host: Skip Timer / Next Round Button */}
          {isHost && (
            <TouchableOpacity style={styles.nextButton} onPress={handleNextRound}>
              <Text style={styles.nextButtonText}>⏭️ Skip Timer - Next Round</Text>
            </TouchableOpacity>
          )}

          {/* Countdown indicator for everyone */}
          <View style={styles.waitingIndicator}>
            <Text style={styles.waitingText}>
              {isHost ? `Auto-advancing in ${countdown}s...` : `Next round starting in ${countdown}s...`}
            </Text>
          </View>

          {/* Leave Game - Available to all players */}
          <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGame}>
            <Text style={styles.leaveButtonText}>Leave Game</Text>
          </TouchableOpacity>

          {/* Host: End Game for everyone */}
          {isHost && (
            <TouchableOpacity style={styles.endButton} onPress={handleEndGame}>
              <Text style={styles.endButtonText}>End Game for All</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Report Modal */}
      <ReportModal
        visible={reportingIndex !== null}
        onClose={() => setReportingIndex(null)}
        onSubmit={async (reason) => {
          if (reportingIndex !== null) {
            await handleReport(reportingIndex, reason);
            setReportingIndex(null);
          }
        }}
      />
    </View>
  );
}

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
  timerContainer: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 16,
  },
  timerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 3,
    borderColor: '#a855f7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  timerText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#a855f7',
  },
  timerLabel: {
    marginTop: 8,
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  submissionsContainer: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    gap: 16,
  },
  controlsContainer: {
    marginTop: 32,
    gap: 12,
    width: '100%',
    maxWidth: 500,
  },
  nextButton: {
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
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  waitingIndicator: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  leaveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  leaveButtonText: {
    color: '#9ca3af',
    fontSize: 18,
    fontWeight: '600',
  },
  endButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  endButtonText: {
    color: '#FF3B30',
    fontSize: 18,
    fontWeight: '700',
  },
  waitingText: {
    color: '#a855f7',
    fontSize: 16,
    fontWeight: '500',
  },
});
