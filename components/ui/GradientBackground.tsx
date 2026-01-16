import React from 'react';
import { ImageBackground, Platform, StyleSheet } from 'react-native';

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: any;
}

export function GradientBackground({ children, style }: GradientBackgroundProps) {
  // Use different images for web/PC vs mobile
  const backgroundImage = Platform.select({
    web: require('@/assets/images/bg_pc.png'),
    default: require('@/assets/images/bg.png'), // iOS, Android
  });

  return (
    <ImageBackground
      source={backgroundImage}
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
