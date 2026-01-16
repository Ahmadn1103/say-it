import { ADMOB_IDS, TEST_IDS } from '@/constants/ads';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

interface BannerAdProps {
  position?: 'top' | 'bottom';
}

// Dynamically import the module to handle when it's not available (iOS only)
let GoogleBannerAd: any = null;
let BannerAdSize: any = null;

if (Platform.OS === 'ios') {
  try {
    const ads = require('react-native-google-mobile-ads');
    GoogleBannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
  } catch (error) {
    console.log('Google Mobile Ads not available - ads will be disabled');
  }
}

// Use test IDs in development, production IDs in release (iOS only)
const getAdUnitId = () => {
  if (__DEV__) {
    return TEST_IDS.banner.ios;
  }
  return ADMOB_IDS.banner.ios;
};

export function BannerAd({ position = 'bottom' }: BannerAdProps) {
  // Only show ads on iOS - web has its own implementation
  if (Platform.OS !== 'ios' || !GoogleBannerAd) {
    return null;
  }

  const adUnitId = getAdUnitId();

  return (
    <View style={[styles.container, position === 'top' ? styles.top : styles.bottom]}>
      <GoogleBannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  top: {
    paddingTop: 0,
  },
  bottom: {
    paddingBottom: 0,
  },
});
