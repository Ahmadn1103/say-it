import { BannerAd } from '@/components/ads/BannerAd';
import { db } from '@/config/firebase';
import { Room } from '@/config/firestore-schema';
import { COLLECTIONS } from '@/constants/config';
import { generateSummary } from '@/services/gameService';
import { leaveRoom } from '@/services/roomService';
import { getAnonymousId } from '@/utils/anonymousId';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface SummaryData {
  totalRounds: number;
  totalReactions: number;
  mostReactedEmoji: string | null;
  usedDropIt: boolean;
}

export default function SummaryScreen() {
  const params = useLocalSearchParams();
  const roomCode = params.roomCode as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAnonymousId().then(setPlayerId);
  }, []);

  useEffect(() => {
    // Subscribe to room
    const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.data() as Room;
        setRoom(roomData);
      }
    });

    return () => unsubscribe();
  }, [roomCode]);

  useEffect(() => {
    // Generate summary
    const loadSummary = async () => {
      try {
        const data = await generateSummary(roomCode);
        setSummaryData(data);
      } catch (error) {
        console.error('Error generating summary:', error);
        // Set default data on error
        setSummaryData({
          totalRounds: room?.currentRound || 0,
          totalReactions: 0,
          mostReactedEmoji: null,
          usedDropIt: false,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSummary();
  }, [roomCode, room?.currentRound]);

  const handlePlayAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace({
      pathname: '/lobby',
      params: { roomCode, isHost: room?.hostId === playerId ? 'true' : 'false' },
    });
  };

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

  if (!room || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={styles.loadingText}>Generating summary...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Game Over Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🎉 Game Over!</Text>
          <Text style={styles.subtitle}>{room.currentRound} Rounds Complete</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>👥</Text>
            <Text style={styles.statValue}>{room.players.length}</Text>
            <Text style={styles.statLabel}>Players</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🎯</Text>
            <Text style={styles.statValue}>{summaryData?.totalRounds || room.currentRound}</Text>
            <Text style={styles.statLabel}>Rounds</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>❤️</Text>
            <Text style={styles.statValue}>{summaryData?.totalReactions || 0}</Text>
            <Text style={styles.statLabel}>Reactions</Text>
          </View>
          
          {summaryData?.mostReactedEmoji && (
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>{summaryData.mostReactedEmoji}</Text>
              <Text style={styles.statValue}>Top</Text>
              <Text style={styles.statLabel}>Reaction</Text>
            </View>
          )}
        </View>

        {/* Fun Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>🏆 Game Highlights</Text>
          <Text style={styles.summaryText}>
            {room.players.length} players completed {summaryData?.totalRounds || room.currentRound} rounds together!
            {summaryData?.totalReactions ? ` You shared ${summaryData.totalReactions} reactions.` : ''}
            {summaryData?.usedDropIt ? ' You even played Drop It! 📸' : ''}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.playAgainButton} onPress={handlePlayAgain}>
            <Text style={styles.playAgainButtonText}>🔄 Play Again</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveRoom}>
            <Text style={styles.leaveButtonText}>Leave Room</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Thanks for playing Say It! 💜
        </Text>
      </ScrollView>

      {/* Banner Ad */}
      <BannerAd position="bottom" />
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
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 16,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#9ca3af',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
    width: '100%',
    maxWidth: 300,
    justifyContent: 'center',
  },
  statCard: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    minWidth: 100,
    flex: 1,
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#a855f7',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    padding: 24,
    borderRadius: 20,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    width: '100%',
    maxWidth: 500,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#a855f7',
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 26,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    marginBottom: 32,
    width: '100%',
    maxWidth: 500,
  },
  playAgainButton: {
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
  playAgainButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  leaveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 18,
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
  footer: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
