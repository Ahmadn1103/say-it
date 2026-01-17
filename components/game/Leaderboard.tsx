import { PlayerNames, PlayerScores } from '@/config/firestore-schema';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface LeaderboardProps {
  scores: PlayerScores;
  players: string[];
  playerNames: PlayerNames;
  currentPlayerId: string;
  showTitle?: boolean;
  compact?: boolean;
}

interface RankedPlayer {
  playerId: string;
  score: number;
  rank: number;
  displayName: string;
  isCurrentPlayer: boolean;
}

/**
 * Leaderboard component showing player rankings by score
 */
export function Leaderboard({
  scores,
  players,
  playerNames,
  currentPlayerId,
  showTitle = true,
  compact = false,
}: LeaderboardProps) {
  // Create ranked list of players
  const rankedPlayers: RankedPlayer[] = players
    .map((playerId, index) => ({
      playerId,
      score: scores[playerId] || 0,
      rank: 0, // Will be set after sorting
      displayName: playerId === currentPlayerId ? 'You' : (playerNames[playerId] || `Player ${index + 1}`),
      isCurrentPlayer: playerId === currentPlayerId,
    }))
    .sort((a, b) => b.score - a.score);

  // Assign ranks (handle ties)
  let currentRank = 1;
  rankedPlayers.forEach((player, index) => {
    if (index > 0 && player.score < rankedPlayers[index - 1].score) {
      currentRank = index + 1;
    }
    player.rank = currentRank;
  });

  // Get medal emoji for top 3
  const getMedal = (rank: number): string => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return '';
    }
  };

  // Get row background color based on rank
  const getRowStyle = (rank: number, isCurrentPlayer: boolean) => {
    const styles: any[] = [leaderboardStyles.row];
    
    if (compact) {
      styles.push(leaderboardStyles.rowCompact);
    }
    
    if (isCurrentPlayer) {
      styles.push(leaderboardStyles.rowCurrentPlayer);
    }
    
    if (rank === 1) {
      styles.push(leaderboardStyles.rowFirst);
    }
    
    return styles;
  };

  if (compact) {
    // Compact version - just show top 3
    const topThree = rankedPlayers.slice(0, 3);
    
    return (
      <View style={leaderboardStyles.compactContainer}>
        {showTitle && (
          <Text style={leaderboardStyles.compactTitle}>Leaderboard</Text>
        )}
        <View style={leaderboardStyles.compactList}>
          {topThree.map((player) => (
            <View key={player.playerId} style={leaderboardStyles.compactItem}>
              <Text style={leaderboardStyles.compactMedal}>
                {getMedal(player.rank)}
              </Text>
              <Text
                style={[
                  leaderboardStyles.compactName,
                  player.isCurrentPlayer && leaderboardStyles.compactNameYou,
                ]}
                numberOfLines={1}
              >
                {player.displayName}
              </Text>
              <Text style={leaderboardStyles.compactScore}>{player.score}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={leaderboardStyles.container}>
      {showTitle && (
        <View style={leaderboardStyles.header}>
          <Text style={leaderboardStyles.title}>Leaderboard</Text>
        </View>
      )}
      <View style={leaderboardStyles.list}>
        {rankedPlayers.map((player) => (
          <View key={player.playerId} style={getRowStyle(player.rank, player.isCurrentPlayer)}>
            <View style={leaderboardStyles.rankContainer}>
              {player.rank <= 3 ? (
                <Text style={leaderboardStyles.medal}>{getMedal(player.rank)}</Text>
              ) : (
                <Text style={leaderboardStyles.rankNumber}>{player.rank}</Text>
              )}
            </View>
            <Text
              style={[
                leaderboardStyles.name,
                player.isCurrentPlayer && leaderboardStyles.nameYou,
              ]}
              numberOfLines={1}
            >
              {player.displayName}
            </Text>
            <Text style={leaderboardStyles.score}>{player.score} pts</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const leaderboardStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  list: {
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  rowCompact: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rowCurrentPlayer: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  rowFirst: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
  },
  medal: {
    fontSize: 20,
  },
  rankNumber: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '600',
  },
  name: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: 12,
  },
  nameYou: {
    color: '#c4b5fd',
    fontWeight: '700',
  },
  score: {
    fontSize: 16,
    color: '#a855f7',
    fontWeight: '700',
  },
  // Compact styles
  compactContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compactList: {
    gap: 6,
  },
  compactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  compactMedal: {
    fontSize: 16,
    width: 24,
  },
  compactName: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  compactNameYou: {
    color: '#c4b5fd',
    fontWeight: '700',
  },
  compactScore: {
    fontSize: 14,
    color: '#a855f7',
    fontWeight: '700',
  },
});
