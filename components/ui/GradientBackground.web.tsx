import React from 'react';
import { StyleSheet, ImageBackground } from 'react-native';

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: any;
}

export function GradientBackground({ children, style }: GradientBackgroundProps) {
  return (
    <ImageBackground
      source={require('@/assets/images/bg_pc.png')}
      style={[styles.background, style]}
      resizeMode="cover"
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#000000', // Fallback color while image loads
  },
});
