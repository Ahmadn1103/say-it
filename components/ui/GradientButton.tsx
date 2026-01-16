import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientButtonProps {
  children: React.ReactNode;
  style?: any;
}

export function GradientButton({ children, style }: GradientButtonProps) {
  return (
    <LinearGradient
      colors={['#a855f7', '#7c3aed']}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={[styles.gradient, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
