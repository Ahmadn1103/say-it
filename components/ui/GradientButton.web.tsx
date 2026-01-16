import React from 'react';
import { StyleSheet, View } from 'react-native';

interface GradientButtonProps {
  children: React.ReactNode;
  style?: any;
}

export function GradientButton({ children, style }: GradientButtonProps) {
  return (
    <View style={[styles.gradient, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
  },
});
