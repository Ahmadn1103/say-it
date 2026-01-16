import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

interface BannerAdProps {
  position?: 'top' | 'bottom';
}

// Dynamically import the module to handle when it's not available
let GoogleBannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;

try {
  const ads = require('react-native-google-mobile-ads');
  GoogleBannerAd = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
  TestIds = ads.TestIds;
} catch (error) {
  console.log('Google Mobile Ads not available - ads will be disabled');
}

// TODO: Replace with actual AdMob unit IDs from AdMob console
const AD_UNIT_IDS = {
  ios: __DEV__ ? (TestIds?.BANNER || '') : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  android: __DEV__ ? (TestIds?.BANNER || '') : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
};

export function BannerAd({ position = 'bottom' }: BannerAdProps) {
  // If ads module not available, return null
  if (!GoogleBannerAd) {
    return null;
  }

  const adUnitId = Platform.select({
    ios: AD_UNIT_IDS.ios,
    android: AD_UNIT_IDS.android,
    default: TestIds?.BANNER || '',
  });

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
