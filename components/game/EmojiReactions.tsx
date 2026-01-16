import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

interface EmojiReactionsProps {
  reactions: { [emoji: string]: number };
  onReact: (emoji: string) => void;
  disabled?: boolean;
}

const REACTION_EMOJIS = ['😭', '👀', '😬', '🤯', '😂'];

export function EmojiReactions({ reactions, onReact, disabled = false }: EmojiReactionsProps) {
  const handlePress = (emoji: string) => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onReact(emoji);
    }
  };

  return (
    <View style={styles.container}>
      {REACTION_EMOJIS.map((emoji) => {
        const count = reactions[emoji] || 0;
        const hasReactions = count > 0;

        return (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactionButton,
              hasReactions && styles.reactionButtonActive,
              disabled && styles.reactionButtonDisabled,
            ]}
            onPress={() => handlePress(emoji)}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{emoji}</Text>
            {hasReactions && <Text style={styles.count}>{count}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  reactionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: '#2C2C2E',
  },
  reactionButtonActive: {
    backgroundColor: '#007AFF',
  },
  reactionButtonDisabled: {
    opacity: 0.5,
  },
  emoji: {
    fontSize: 28,
  },
  count: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});
