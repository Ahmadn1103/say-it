import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AnswerTileProps {
  content: string;
  isImage: boolean;
  isBlurred?: boolean;
  reactions?: { [emoji: string]: number };
  onReact?: (emoji: string) => void;
  onReport?: () => void;
  onGuess?: () => void;
  showGuessButton?: boolean;
  isReported?: boolean;
  showReactions?: boolean; // Whether to show reaction UI (default: true)
}

const REACTION_EMOJIS = ['😭', '👀', '😬', '🤯', '😂'];

export function AnswerTile({
  content,
  isImage,
  isBlurred = false,
  reactions = {},
  onReact,
  onReport,
  onGuess,
  showGuessButton = false,
  isReported = false,
  showReactions: enableReactions = true,
}: AnswerTileProps) {
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);

  const handleReact = (emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReact?.(emoji);
    setReactionPickerOpen(false);
  };

  const handleReport = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onReport?.();
  };

  const handleGuess = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onGuess?.();
  };

  if (isReported) {
    return (
      <View style={[styles.container, styles.reportedContainer]}>
        <Text style={styles.reportedText}>🚫 Content Hidden</Text>
        <Text style={styles.reportedSubtext}>Flagged by multiple users</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Content Area */}
      <View style={styles.contentArea}>
        {isImage ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: content }} style={styles.image} resizeMode="cover" />
            {isBlurred && (
              <BlurView intensity={100} style={StyleSheet.absoluteFill} tint="dark" />
            )}
          </View>
        ) : (
          <Text style={styles.textContent}>{content}</Text>
        )}
      </View>

      {/* Actions Bar - Only show if reactions are enabled */}
      {enableReactions && (
        <View style={styles.actionsBar}>
          {/* React Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setReactionPickerOpen(!reactionPickerOpen)}
          >
            <Text style={styles.actionIcon}>❤️</Text>
          </TouchableOpacity>

          {/* Guess Button (Optional) */}
          {showGuessButton && (
            <TouchableOpacity style={styles.actionButton} onPress={handleGuess}>
              <Text style={styles.actionIcon}>🤔</Text>
            </TouchableOpacity>
          )}

          {/* Report Button */}
          <TouchableOpacity style={styles.actionButton} onPress={handleReport}>
            <Text style={styles.actionIcon}>🚩</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reaction Selector */}
      {enableReactions && reactionPickerOpen && (
        <View style={styles.reactionSelector}>
          {REACTION_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionButton}
              onPress={() => handleReact(emoji)}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {reactions[emoji] ? (
                <Text style={styles.reactionCount}>{reactions[emoji]}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Reaction Summary */}
      {enableReactions && Object.keys(reactions).length > 0 && (
        <View style={styles.reactionSummary}>
          {Object.entries(reactions).map(([emoji, count]) => (
            <View key={emoji} style={styles.reactionItem}>
              <Text style={styles.reactionSummaryEmoji}>{emoji}</Text>
              <Text style={styles.reactionSummaryCount}>{count}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  reportedContainer: {
    backgroundColor: '#2C1C1C',
    borderColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  reportedText: {
    color: '#FF3B30',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  reportedSubtext: {
    color: '#999',
    fontSize: 14,
  },
  contentArea: {
    minHeight: 80,
    justifyContent: 'center',
    marginBottom: 12,
  },
  textContent: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  actionButton: {
    padding: 8,
  },
  actionIcon: {
    fontSize: 24,
  },
  reactionSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    marginTop: 8,
  },
  reactionButton: {
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 32,
  },
  reactionCount: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  reactionSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  reactionSummaryEmoji: {
    fontSize: 18,
  },
  reactionSummaryCount: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
