import { useInterstitialAd } from '@/components/ads/InterstitialAdManager';
import { AnswerTile } from '@/components/game/AnswerTile';
import { GuessResult } from '@/components/game/GuessResult';
import { Leaderboard } from '@/components/game/Leaderboard';
import { PlayerSelector } from '@/components/game/PlayerSelector';
import { ReportModal } from '@/components/modals/ReportModal';
import { db } from '@/config/firebase';
import { PlayerScores, Room, Round } from '@/config/firestore-schema';
import { COLLECTIONS, GAME_CONFIG } from '@/constants/config';
import { getPromptsForMode } from '@/constants/prompts';
import {
  addGuess,
  addReaction,
  calculateRoundScores,
  checkAllGuessesLocked,
  lockGuesses,
  nextRound,
  startResultsPhase,
  updateRoomScores,
} from '@/services/gameService';
import { endGame } from '@/services/roomService';
import { getAnonymousId } from '@/utils/anonymousId';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Phase = 'guessing' | 'results';

const GUESSING_TIME = 30; // seconds for guessing phase
const RESULTS_TIME = 15; // seconds for results phase before next round

export default function RevealScreen() {
  const params = useLocalSearchParams();
  const roomCode = params.roomCode as string;
  const roundId = params.roundId as string;

  // Core state
  const [room, setRoom] = useState<Room | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [isHost, setIsHost] = useState(false);

  // Phase state
  const [phase, setPhase] = useState<Phase>('guessing');
  const [countdown, setCountdown] = useState(GUESSING_TIME);

  // Submissions (shuffled for display)
  const [submissions, setSubmissions] = useState<
    Array<{ content: string; isImage: boolean; index: number; playerId: string }>
  >([]);
  const shuffleKeyRef = useRef<string>('');

  // Guessing state
  const [localGuesses, setLocalGuesses] = useState<{ [submissionPlayerId: string]: string }>({});
  const [hasLockedGuesses, setHasLockedGuesses] = useState(false);
  const [roundScores, setRoundScores] = useState<PlayerScores>({});

  // Reporting
  const [reportingIndex, setReportingIndex] = useState<number | null>(null);
  const [reportedIndexes, setReportedIndexes] = useState<Set<number>>(new Set());

  // Navigation refs
  const [roundCount, setRoundCount] = useState(0);
  const [usedPromptIndexes, setUsedPromptIndexes] = useState<Set<number>>(new Set());
  const hasNavigatedRef = useRef(false);
  const hasCalculatedScoresRef = useRef(false);

  const { showAd, isLoaded: adLoaded } = useInterstitialAd();

  // Get player ID on mount
  useEffect(() => {
    getAnonymousId().then(setPlayerId);
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && round) {
        // App came to foreground - force a re-check of phase
        console.log('App came to foreground, forcing phase re-check');
        
        // The phase check effect will automatically run and correct any issues
        // Just need to trigger a state update to force re-evaluation
        setCountdown((prev) => prev);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [round]);

  // Subscribe to room updates
  useEffect(() => {
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

      if (roomData.status === 'ended') {
        router.replace({
          pathname: '/summary',
          params: { roomCode },
        });
      }
    });

    return () => unsubscribe();
  }, [roomCode, playerId]);

  // Subscribe to round updates
  useEffect(() => {
    const roundRef = doc(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS, roundId);
    const unsubscribe = onSnapshot(roundRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const roundData = snapshot.data() as Round;
      setRound(roundData);

      // Only shuffle submissions once per round
      if (shuffleKeyRef.current !== roundId) {
        shuffleKeyRef.current = roundId;
        const submissionsArray = Object.entries(roundData.submissions).map(
          ([pId, submission], index) => ({
            content: submission.content,
            isImage: submission.isImage,
            index,
            playerId: pId,
          })
        );
        // Deterministic shuffle based on round ID
        const shuffled = submissionsArray.sort((a, b) => {
          const hashA = `${roundId}-${a.playerId}`.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const hashB = `${roundId}-${b.playerId}`.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          return hashA - hashB;
        });
        setSubmissions(shuffled);
      }

      // Check if this player has already locked guesses
      if (roundData.guessesLockedBy?.includes(playerId)) {
        setHasLockedGuesses(true);
      }

      // Load existing guesses for this player
      if (roundData.guesses?.[playerId]) {
        setLocalGuesses(roundData.guesses[playerId]);
      }

      // Force phase check based on resultsStartedAt (for app resume scenarios)
      if (roundData.resultsStartedAt && phase === 'guessing') {
        console.log('Detected resultsStartedAt while in guessing phase, should transition');
      }
    });

    return () => unsubscribe();
  }, [roomCode, roundId, playerId, phase]);

  // Count rounds and track used prompts
  useEffect(() => {
    const getRoundCount = async () => {
      const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
      const snapshot = await getDocs(roundsRef);
      setRoundCount(snapshot.size);

      const usedIndexes = new Set<number>();
      snapshot.docs.forEach((docSnap) => {
        const roundData = docSnap.data() as Round;
        usedIndexes.add(roundData.promptIndex);
      });
      setUsedPromptIndexes(usedIndexes);
    };
    getRoundCount();
  }, [roomCode]);

  // Listen for new rounds (non-host auto-navigation)
  useEffect(() => {
    if (hasNavigatedRef.current) return;

    const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
    const unsubscribe = onSnapshot(roundsRef, (snapshot) => {
      const newRound = snapshot.docs.find((docSnap) => {
        const data = docSnap.data() as Round;
        return !data.revealedAt && docSnap.id !== roundId;
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

  // Check if all guesses are locked and transition to results (host + backup)
  useEffect(() => {
    const checkAndTransition = async () => {
      if (phase !== 'guessing' || !room || !round) return;
      if (hasCalculatedScoresRef.current) return; // Already calculated
      if (round.resultsStartedAt) return; // Already transitioned

      // Check if timer has expired
      const now = Date.now();
      const revealTime = round.revealedAt?.toMillis();
      const timerExpired = revealTime && (now - revealTime) >= GUESSING_TIME * 1000;

      const allLocked = await checkAllGuessesLocked(roomCode, roundId);
      
      // Host should transition if all locked OR if timer expired
      if (isHost && (allLocked || timerExpired)) {
        console.log(`Host transitioning to results: allLocked=${allLocked}, timerExpired=${timerExpired}`);
        hasCalculatedScoresRef.current = true;
        
        const scores = await calculateRoundScores(roomCode, roundId);
        setRoundScores(scores);
        await updateRoomScores(roomCode, scores);
        await startResultsPhase(roomCode, roundId);
        return;
      }
      
      // Backup: If timer expired by 5+ seconds and host hasn't transitioned, any client can do it
      const timerExpiredBy = revealTime ? Math.floor((now - revealTime) / 1000) - GUESSING_TIME : 0;
      if (!isHost && timerExpiredBy >= 5 && !round.resultsStartedAt) {
        console.log(`Timer expired by ${timerExpiredBy}s, non-host triggering backup transition`);
        hasCalculatedScoresRef.current = true;
        
        const scores = await calculateRoundScores(roomCode, roundId);
        setRoundScores(scores);
        await updateRoomScores(roomCode, scores);
        await startResultsPhase(roomCode, roundId);
      }
    };

    // Check periodically
    const interval = setInterval(checkAndTransition, 1000);
    return () => clearInterval(interval);
  }, [phase, room, round, roomCode, roundId, isHost]);

  // Listen for results phase start and check if we should be in results (all clients)
  useEffect(() => {
    if (!round) return;

    const checkPhase = async () => {
      const now = Date.now();
      
      // Check if resultsStartedAt exists - definitive signal for results phase
      if (round.resultsStartedAt && phase === 'guessing') {
        console.log('resultsStartedAt detected, transitioning to results');
        
        if (!hasCalculatedScoresRef.current) {
          hasCalculatedScoresRef.current = true;
          const scores = await calculateRoundScores(roomCode, roundId);
          setRoundScores(scores);
        }
        
        setPhase('results');
        return;
      }
      
      // If we're in guessing phase, check if time has expired
      if (phase === 'guessing' && round.revealedAt && !round.resultsStartedAt) {
        const revealTime = round.revealedAt.toMillis();
        const elapsedMs = now - revealTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        
        // If timer expired and we're the host, trigger transition
        if (elapsedSeconds >= GUESSING_TIME && isHost && !hasCalculatedScoresRef.current) {
          console.log('Timer expired, host triggering results phase');
          hasCalculatedScoresRef.current = true;
          
          const scores = await calculateRoundScores(roomCode, roundId);
          setRoundScores(scores);
          await updateRoomScores(roomCode, scores);
          await startResultsPhase(roomCode, roundId);
        }
      }
    };

    checkPhase();
  }, [round, phase, roomCode, roundId, isHost]);

  // Countdown timer - synchronized to server timestamps
  useEffect(() => {
    if (!room || !round || hasNavigatedRef.current) return;

    const calculateTimeRemaining = () => {
      const now = Date.now();
      
      // Determine actual phase based on server data (may differ from state)
      const actualPhase = round.resultsStartedAt ? 'results' : 'guessing';
      
      // If phase state doesn't match actual phase, use actual phase for calculation
      const currentPhase = actualPhase;
      
      if (currentPhase === 'guessing') {
        if (!round.revealedAt) return GUESSING_TIME;
        
        // Calculate elapsed time since reveal using server timestamp
        const revealTime = round.revealedAt.toMillis();
        const elapsedMs = now - revealTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const remaining = Math.max(0, GUESSING_TIME - elapsedSeconds);
        
        return remaining;
      } else {
        // Results phase - use resultsStartedAt for synchronization
        if (!round.resultsStartedAt) return RESULTS_TIME;
        
        const resultsStartTime = round.resultsStartedAt.toMillis();
        const elapsedMs = now - resultsStartTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const remaining = Math.max(0, RESULTS_TIME - elapsedSeconds);
        
        return remaining;
      }
    };

    // Update immediately
    const initialRemaining = calculateTimeRemaining();
    setCountdown(initialRemaining);

    // Then update every second
    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setCountdown(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [room, round, phase]);

  // Handle countdown reaching 0
  useEffect(() => {
    if (countdown !== 0) return;

    if (phase === 'guessing') {
      // Auto-lock guesses when guessing timer expires
      if (!hasLockedGuesses) {
        handleLockGuesses();
      }
    } else if (phase === 'results' && isHost && !hasNavigatedRef.current) {
      // Auto-advance to next round when results timer expires (host only)
      hasNavigatedRef.current = true;
      handleNextRoundAuto();
    }
  }, [countdown, phase, isHost, hasLockedGuesses]);

  // Handle guess selection
  const handleGuessChange = async (submissionPlayerId: string, guessedPlayerId: string) => {
    if (hasLockedGuesses) return;

    setLocalGuesses((prev) => ({
      ...prev,
      [submissionPlayerId]: guessedPlayerId,
    }));

    try {
      await addGuess(roomCode, roundId, playerId, submissionPlayerId, guessedPlayerId);
    } catch (error) {
      console.error('Error saving guess:', error);
    }
  };

  // Handle locking guesses
  const handleLockGuesses = async () => {
    if (hasLockedGuesses || !playerId) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await lockGuesses(roomCode, roundId, playerId);
      setHasLockedGuesses(true);
    } catch (error) {
      console.error('Error locking guesses:', error);
    }
  };

  // Count how many guesses the player made
  const guessCount = useMemo(() => {
    if (!room) return { made: 0, total: 0 };
    const othersCount = room.players.length - 1;
    const madeCount = Object.keys(localGuesses).length;
    return { made: madeCount, total: othersCount };
  }, [localGuesses, room]);

  // Calculate correct guesses for current player
  const correctGuessCount = useMemo(() => {
    if (!round || phase !== 'results') return 0;
    let correct = 0;
    Object.entries(localGuesses).forEach(([submissionPlayerId, guessedPlayerId]) => {
      if (guessedPlayerId === submissionPlayerId) {
        correct++;
      }
    });
    return correct;
  }, [localGuesses, round, phase]);

  // Handle reactions
  const handleReact = async (submissionPlayerId: string, emoji: string) => {
    if (!playerId) return;
    try {
      await addReaction(roomCode, roundId, submissionPlayerId, emoji);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  // Handle reports
  const handleReport = async (index: number, reason: string) => {
    try {
      const submission = submissions[index];
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

  // Handle next round (auto or manual)
  const handleNextRoundAuto = useCallback(async () => {
    if (!room) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
      const snapshot = await getDocs(roundsRef);
      const currentUsedIndexes = new Set<number>();
      snapshot.docs.forEach((docSnap) => {
        const roundData = docSnap.data() as Round;
        currentUsedIndexes.add(roundData.promptIndex);
      });

      const totalPrompts = getPromptsForMode(room.currentMode!).length;
      if (currentUsedIndexes.size >= totalPrompts) {
        await endGame(roomCode);
        return;
      }

      if (roundCount > 0 && roundCount % GAME_CONFIG.AD_FREQUENCY_ROUNDS === 0 && adLoaded) {
        await showAd();
      }

      await nextRound(roomCode, room.currentMode!);
      router.replace({ pathname: '/round', params: { roomCode } });
    } catch (error) {
      console.error('Error starting next round:', error);
      hasNavigatedRef.current = false;
    }
  }, [room, roomCode, roundCount, adLoaded, showAd]);

  const handleNextRound = async () => {
    if (!isHost || !room || hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      const roundsRef = collection(db, COLLECTIONS.ROOMS, roomCode, COLLECTIONS.ROUNDS);
      const snapshot = await getDocs(roundsRef);
      const currentUsedIndexes = new Set<number>();
      snapshot.docs.forEach((docSnap) => {
        const roundData = docSnap.data() as Round;
        currentUsedIndexes.add(roundData.promptIndex);
      });

      const totalPrompts = getPromptsForMode(room.currentMode!).length;
      if (currentUsedIndexes.size >= totalPrompts) {
        await endGame(roomCode);
        return;
      }

      if (roundCount > 0 && roundCount % GAME_CONFIG.AD_FREQUENCY_ROUNDS === 0 && adLoaded) {
        await showAd();
      }

      await nextRound(roomCode, room.currentMode!);
      router.replace({ pathname: '/round', params: { roomCode } });
    } catch (error) {
      console.error('Error starting next round:', error);
      hasNavigatedRef.current = false;
      Alert.alert('Error', 'Failed to start next round');
    }
  };

  const handleLeaveGame = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to leave?');
      if (confirmed) router.replace('/');
    } else {
      Alert.alert('Leave Game', 'Are you sure you want to leave?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.replace('/');
          },
        },
      ]);
    }
  };

  const handleEndGame = async () => {
    if (!isHost) return;

    const doEndGame = async () => {
      try {
        await endGame(roomCode);
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
      if (window.confirm('This will end the game for all players. Are you sure?')) {
        await doEndGame();
      }
    } else {
      Alert.alert('End Game', 'This will end the game for all players. Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Game', style: 'destructive', onPress: doEndGame },
      ]);
    }
  };

  // Loading state
  if (!room || !round) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Get waiting count for guesses
  const waitingGuessCount = room.players.length - (round.guessesLockedBy?.length || 0);

  return (
    <View style={styles.container}>
      {/* Header with timer */}
      <View style={styles.header}>
        <View style={[styles.timerCircle, countdown <= 5 && styles.timerCircleWarning]}>
          <Text style={[styles.timerText, countdown <= 5 && styles.timerTextWarning]}>
            {countdown}
          </Text>
        </View>
        <Text style={styles.phaseLabel}>
          {phase === 'guessing' ? 'Guess Who Said It!' : 'Results'}
        </Text>
        {phase === 'results' && (
          <Text style={styles.scoreText}>
            You got {correctGuessCount}/{guessCount.total} correct!
          </Text>
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Submissions */}
        <View style={styles.submissionsContainer}>
          {submissions.map((submission) => {
            const isOwnSubmission = submission.playerId === playerId;

            return (
              <View key={submission.playerId} style={styles.submissionCard}>
                <AnswerTile
                  content={submission.content}
                  isImage={submission.isImage}
                  isBlurred={false}
                  reactions={phase === 'results' ? round.reactions?.[submission.playerId] || {} : {}}
                  onReact={phase === 'results' ? (emoji) => handleReact(submission.playerId, emoji) : undefined}
                  onReport={() => setReportingIndex(submission.index)}
                  isReported={reportedIndexes.has(submission.index)}
                  showReactions={phase === 'results'}
                />

                {phase === 'guessing' ? (
                  <PlayerSelector
                    players={room.players}
                    playerNames={room.playerNames || {}}
                    currentPlayerId={playerId}
                    selectedPlayerId={localGuesses[submission.playerId] || null}
                    onSelect={(guessedId) => handleGuessChange(submission.playerId, guessedId)}
                    disabled={hasLockedGuesses}
                    submissionPlayerId={submission.playerId}
                  />
                ) : (
                  <GuessResult
                    guessedPlayerId={localGuesses[submission.playerId] || null}
                    actualPlayerId={submission.playerId}
                    players={room.players}
                    playerNames={room.playerNames || {}}
                    currentPlayerId={playerId}
                    isOwnSubmission={isOwnSubmission}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Guessing phase controls */}
        {phase === 'guessing' && (
          <View style={styles.controlsContainer}>
            {!hasLockedGuesses ? (
              <>
                <Text style={styles.guessProgress}>
                  Guesses made: {guessCount.made}/{guessCount.total}
                </Text>
                <TouchableOpacity
                  style={[styles.lockButton, guessCount.made === 0 && styles.buttonDisabled]}
                  onPress={handleLockGuesses}
                  disabled={guessCount.made === 0}
                >
                  <Text style={styles.lockButtonText}>Lock In My Guesses</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.waitingIndicator}>
                <ActivityIndicator size="small" color="#a855f7" />
                <Text style={styles.waitingText}>
                  Waiting for {waitingGuessCount} player{waitingGuessCount !== 1 ? 's' : ''}...
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Results phase controls */}
        {phase === 'results' && (
          <View style={styles.controlsContainer}>
            {/* Leaderboard */}
            <Leaderboard
              scores={room.scores || {}}
              players={room.players}
              playerNames={room.playerNames || {}}
              currentPlayerId={playerId}
              showTitle
            />

            {/* Host controls */}
            {isHost && (
              <TouchableOpacity style={styles.nextButton} onPress={handleNextRound}>
                <Text style={styles.nextButtonText}>Next Round</Text>
              </TouchableOpacity>
            )}

            <View style={styles.waitingIndicator}>
              <Text style={styles.waitingText}>
                {isHost ? `Auto-advancing in ${countdown}s...` : `Next round in ${countdown}s...`}
              </Text>
            </View>

            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGame}>
              <Text style={styles.leaveButtonText}>Leave Game</Text>
            </TouchableOpacity>

            {isHost && (
              <TouchableOpacity style={styles.endButton} onPress={handleEndGame}>
                <Text style={styles.endButtonText}>End Game for All</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
  header: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 16,
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
    fontSize: 28,
    fontWeight: '800',
    color: '#a855f7',
  },
  timerTextWarning: {
    color: '#FF3B30',
  },
  phaseLabel: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scoreText: {
    marginTop: 4,
    fontSize: 16,
    color: '#34C759',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  submissionsContainer: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    gap: 20,
  },
  submissionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  controlsContainer: {
    marginTop: 24,
    gap: 12,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  guessProgress: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 4,
  },
  lockButton: {
    backgroundColor: '#a855f7',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  lockButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  waitingIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    padding: 16,
    borderRadius: 16,
    gap: 10,
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  waitingText: {
    color: '#a855f7',
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: '#a855f7',
    padding: 18,
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
    fontSize: 18,
    fontWeight: '700',
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
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: '700',
  },
});
