import { PlayerCounter } from '@/components/game/PlayerCounter';
import { RoomCode } from '@/components/game/RoomCode';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { GradientButton } from '@/components/ui/GradientButton';
import { db } from '@/config/firebase';
import { GameMode, Room } from '@/config/firestore-schema';
import { COLLECTIONS, GAME_CONFIG } from '@/constants/config';
import { leaveRoom, resetRoom, startGame } from '@/services/roomService';
import { getAnonymousId } from '@/utils/anonymousId';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const MODE_OPTIONS: { mode: GameMode; label: string; description: string; icon: string }[] = [
  {
    mode: 'sentence',
    label: 'Finish the Sentence',
    description: 'Complete the prompt (60 char max)',
    icon: '✍️',
  },
  // TODO: Add back when I have a better roadmap for these games
  // {
  //   mode: 'drop',
  //   label: 'Drop It',
  //   description: 'Upload an image (one per game)',
  //   icon: '📸',
  // },
  // {
  //   mode: 'context',
  //   label: 'No Context',
  //   description: 'One word or emoji only',
  //   icon: '🔥',
  // },
];

export default function LobbyScreen() {
  const params = useLocalSearchParams();
  const roomCode = params.roomCode as string;
  const isHost = params.isHost === 'true';

  const [room, setRoom] = useState<Room | null>(null);
  const [selectedMode, setSelectedMode] = useState<GameMode>('sentence');
  const [isStarting, setIsStarting] = useState(false);
  const [playerId, setPlayerId] = useState<string>('');
  const [hasResetRoom, setHasResetRoom] = useState(false);

  useEffect(() => {
    // Get player ID
    getAnonymousId().then(setPlayerId);

    // Subscribe to room updates
    const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
    const unsubscribe = onSnapshot(
      roomRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          Alert.alert('Room Ended', 'This room no longer exists');
          router.replace('/');
          return;
        }

        const roomData = snapshot.data() as Room;
        setRoom(roomData);

        // If room is ended (coming back from Play Again), reset it to waiting
        if (roomData.status === 'ended' && !hasResetRoom && isHost) {
          setHasResetRoom(true);
          try {
            console.log('Resetting room for Play Again...');
            await resetRoom(roomCode);
          } catch (error) {
            console.error('Error resetting room:', error);
          }
        }

        // If game has started, navigate to round screen
        if (roomData.status === 'playing') {
          router.replace({
            pathname: '/round',
            params: { roomCode },
          });
        }
      },
      (error) => {
        console.error('Error subscribing to room:', error);
        Alert.alert('Error', 'Lost connection to room');
      }
    );

    return () => {
      unsubscribe();
    };
  }, [roomCode, hasResetRoom, isHost]);

  const handleLeaveRoom = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (playerId) {
        await leaveRoom(roomCode, playerId);
      }
      // TODO: This should be handled by Cloud Functions (Firestore rules prevent client writes)
      // await decrementUsers();

      router.replace('/');
    } catch (error) {
      console.error('Error leaving room:', error);
      router.replace('/');
    }
  };

  const handleStartGame = async () => {
    if (!room || room.players.length < GAME_CONFIG.MIN_PLAYERS) {
      Alert.alert('Not Enough Players', `Need at least ${GAME_CONFIG.MIN_PLAYERS} players to start`);
      return;
    }

    try {
      setIsStarting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      await startGame(roomCode, selectedMode);
      
      // Navigation will happen via the room status listener
    } catch (error) {
      console.error('Error starting game:', error);
      Alert.alert('Error', 'Failed to start game. Please try again.');
      setIsStarting(false);
    }
  };

  const canStartGame = room && room.players.length >= GAME_CONFIG.MIN_PLAYERS;
  const canUseDropIt = !room?.hasUsedDropIt;

  if (!room) {
    return (
      <GradientBackground style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={styles.loadingText}>Loading room...</Text>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Room Code */}
        <RoomCode code={roomCode} />

        {/* Player Counter */}
        <PlayerCounter
          currentPlayers={room.players.length}
          maxPlayers={GAME_CONFIG.MAX_PLAYERS}
          showRecommended
        />

        {/* Player List */}
        <View style={styles.playerList}>
          <Text style={styles.sectionTitle}>Players</Text>
          <View style={styles.playerGrid}>
            {room.players.map((id, index) => {
              const playerName = room.playerNames?.[id] || `Player ${index + 1}`;
              const isCurrentPlayer = id === playerId;
              const isHostPlayer = id === room.hostId;
              return (
                <View key={id} style={[styles.playerCard, isCurrentPlayer && styles.playerCardYou]}>
                  <Text style={styles.playerEmoji}>{isHostPlayer ? '👑' : '😎'}</Text>
                  <Text 
                    style={[styles.playerName, isCurrentPlayer && styles.playerNameYou]}
                    numberOfLines={1}
                  >
                    {isCurrentPlayer ? 'You' : playerName}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Mode Selection (Host Only) */}
        {isHost && (
          <View style={styles.modeSelection}>
            <Text style={styles.sectionTitle}>Select Game Mode</Text>
            {MODE_OPTIONS.map((option) => {
              const isDropItDisabled = option.mode === 'drop' && !canUseDropIt;
              const isSelected = selectedMode === option.mode;

              return (
                <TouchableOpacity
                  key={option.mode}
                  style={[
                    styles.modeButton,
                    isSelected && styles.modeButtonSelected,
                    isDropItDisabled && styles.modeButtonDisabled,
                  ]}
                  onPress={() => {
                    if (!isDropItDisabled) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedMode(option.mode);
                    }
                  }}
                  disabled={isDropItDisabled}
                >
                  <Text style={styles.modeIcon}>{option.icon}</Text>
                  <View style={styles.modeInfo}>
                    <Text style={[styles.modeLabel, isSelected && styles.modeLabelSelected]}>
                      {option.label}
                    </Text>
                    <Text style={styles.modeDescription}>
                      {isDropItDisabled ? 'Already used this game' : option.description}
                    </Text>
                  </View>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Waiting Message (Non-Host) */}
        {!isHost && (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>Waiting for host to start game...</Text>
            <ActivityIndicator size="small" color="#666" style={{ marginTop: 12 }} />
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {isHost && (
            <TouchableOpacity
              style={[
                styles.button,
                styles.startButton,
                (!canStartGame || isStarting) && styles.buttonDisabled,
              ]}
              onPress={handleStartGame}
              disabled={!canStartGame || isStarting}
            >
              <GradientButton>
                {isStarting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.startButtonText}>Start Game</Text>
                )}
              </GradientButton>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.leaveButton]}
            onPress={handleLeaveRoom}
            disabled={isStarting}
          >
            <Text style={styles.leaveButtonText}>Leave Room</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Banner Ad - Temporarily disabled for testing */}
      {/* <BannerAd position="bottom" /> */}
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 16,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 16,
  },
  playerList: {
    marginTop: 32,
  },
  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  playerCard: {
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    minWidth: 90,
  },
  playerCardYou: {
    borderColor: 'rgba(168, 85, 247, 0.5)',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  playerEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  playerName: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 80,
  },
  playerNameYou: {
    color: '#c4b5fd',
    fontWeight: '700',
  },
  modeSelection: {
    marginTop: 32,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modeButtonSelected: {
    borderColor: '#a855f7',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  modeButtonDisabled: {
    opacity: 0.4,
  },
  modeIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  modeInfo: {
    flex: 1,
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modeLabelSelected: {
    color: '#FFFFFF',
  },
  modeDescription: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  checkmark: {
    fontSize: 24,
    color: '#c4b5fd',
  },
  waitingContainer: {
    marginTop: 48,
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  waitingText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  actions: {
    marginTop: 32,
    gap: 12,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  startButton: {
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  leaveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveButtonText: {
    color: '#FF3B30',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
