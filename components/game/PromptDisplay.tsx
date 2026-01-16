import { GameMode } from '@/config/firestore-schema';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface PromptDisplayProps {
  prompt: string;
  mode: GameMode;
}

const MODE_LABELS: Record<GameMode, string> = {
  sentence: 'Finish the Sentence',
  drop: 'Drop It',
  context: 'No Context',
};

const MODE_COLORS: Record<GameMode, string> = {
  sentence: '#007AFF',
  drop: '#FF2D55',
  context: '#FF9500',
};

export function PromptDisplay({ prompt, mode }: PromptDisplayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Animate entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [prompt]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Mode Badge */}
      <View style={[styles.badge, { backgroundColor: MODE_COLORS[mode] }]}>
        <Text style={styles.badgeText}>{MODE_LABELS[mode]}</Text>
      </View>

      {/* Prompt Text */}
      <Text style={styles.prompt}>{prompt}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  prompt: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 38,
  },
});
