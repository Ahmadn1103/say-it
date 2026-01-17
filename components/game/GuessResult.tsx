import { PlayerNames } from '@/config/firestore-schema';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface GuessResultProps {
  guessedPlayerId: string | null;
  actualPlayerId: string;
  players: string[];
  playerNames: PlayerNames;
  currentPlayerId: string;
  isOwnSubmission: boolean;
}

/**
 * Shows the result of a guess - whether correct or incorrect
 */
export function GuessResult({
  guessedPlayerId,
  actualPlayerId,
  players,
  playerNames,
  currentPlayerId,
  isOwnSubmission,
}: GuessResultProps) {
  // Get player display name
  const getPlayerLabel = (playerId: string): string => {
    if (playerId === currentPlayerId) {
      return 'You';
    }
    return playerNames[playerId] || `Player ${players.indexOf(playerId) + 1}`;
  };

  // Check if guess was correct
  const isCorrect = guessedPlayerId === actualPlayerId;
  const actualLabel = getPlayerLabel(actualPlayerId);

  // If this is the current player's own submission, show different message
  if (isOwnSubmission) {
    return (
      <View style={styles.ownContainer}>
        <Text style={styles.ownLabel}>This was your answer</Text>
      </View>
    );
  }

  // If no guess was made
  if (!guessedPlayerId) {
    return (
      <View style={styles.noGuessContainer}>
        <Text style={styles.noGuessText}>No guess made</Text>
        <View style={styles.actualRow}>
          <Text style={styles.actualLabel}>Actually:</Text>
          <Text style={styles.actualValue}>{actualLabel}</Text>
        </View>
      </View>
    );
  }

  const guessedLabel = getPlayerLabel(guessedPlayerId);

  return (
    <View style={[styles.container, isCorrect ? styles.containerCorrect : styles.containerIncorrect]}>
      <View style={styles.resultRow}>
        <Text style={styles.resultIcon}>{isCorrect ? '✅' : '❌'}</Text>
        <View style={styles.resultInfo}>
          <View style={styles.guessRow}>
            <Text style={styles.label}>You guessed:</Text>
            <Text style={[styles.value, isCorrect && styles.valueCorrect]}>
              {guessedLabel}
            </Text>
          </View>
          {!isCorrect && (
            <View style={styles.actualRow}>
              <Text style={styles.actualLabel}>Actually:</Text>
              <Text style={styles.actualValue}>{actualLabel}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 2,
  },
  containerCorrect: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  containerIncorrect: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  resultIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  resultInfo: {
    flex: 1,
  },
  guessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 14,
    color: '#9ca3af',
    marginRight: 6,
  },
  value: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  valueCorrect: {
    color: '#34C759',
  },
  actualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  actualLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginRight: 6,
  },
  actualValue: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '600',
  },
  ownContainer: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 2,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  ownLabel: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
    textAlign: 'center',
  },
  noGuessContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  noGuessText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
