import { GAME_CONFIG } from '@/constants/config';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface PlayerCounterProps {
  currentPlayers: number;
  maxPlayers?: number;
  showRecommended?: boolean;
}

export function PlayerCounter({
  currentPlayers,
  maxPlayers = GAME_CONFIG.MAX_PLAYERS,
  showRecommended = false,
}: PlayerCounterProps) {
  // Determine color based on player count
  const getColor = () => {
    if (currentPlayers < GAME_CONFIG.MIN_PLAYERS) return '#FF3B30'; // Red
    if (currentPlayers >= 3 && currentPlayers <= 5) return '#FF9500'; // Yellow
    if (currentPlayers >= 6 && currentPlayers <= 10) return '#34C759'; // Green
    if (currentPlayers >= 11) return '#FF9500'; // Orange (too many)
    return '#999';
  };

  const getMessage = () => {
    if (currentPlayers < GAME_CONFIG.MIN_PLAYERS) {
      return 'Need at least 3 players';
    }
    if (showRecommended && currentPlayers >= 3 && currentPlayers < 6) {
      return `Best with ${GAME_CONFIG.RECOMMENDED_PLAYERS} players`;
    }
    if (currentPlayers >= 11) {
      return 'Almost full!';
    }
    return null;
  };

  const color = getColor();
  const message = getMessage();

  return (
    <View style={styles.container}>
      <View style={styles.counterContainer}>
        <Text style={[styles.count, { color }]}>
          {currentPlayers}
        </Text>
        <Text style={styles.separator}>/</Text>
        <Text style={styles.maxCount}>{maxPlayers}</Text>
      </View>
      <Text style={styles.label}>Players</Text>
      {message && <Text style={[styles.message, { color }]}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  count: {
    fontSize: 48,
    fontWeight: '700',
  },
  separator: {
    fontSize: 32,
    color: '#666',
    marginHorizontal: 4,
  },
  maxCount: {
    fontSize: 32,
    color: '#666',
    fontWeight: '600',
  },
  label: {
    fontSize: 16,
    color: '#999',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  message: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
});
