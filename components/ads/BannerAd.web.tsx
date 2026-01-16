import React from 'react';
import { View } from 'react-native';

interface BannerAdProps {
  position?: 'top' | 'bottom';
}

// Web version - ads not supported on web
export function BannerAd({ position = 'bottom' }: BannerAdProps) {
  // Return null or an empty view since ads don't work on web
  return null;
}
