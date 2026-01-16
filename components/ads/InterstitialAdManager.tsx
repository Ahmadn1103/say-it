import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Dynamically import the module to handle when it's not available
let InterstitialAd: any = null;
let AdEventType: any = null;
let TestIds: any = null;

try {
  const ads = require('react-native-google-mobile-ads');
  InterstitialAd = ads.InterstitialAd;
  AdEventType = ads.AdEventType;
  TestIds = ads.TestIds;
} catch (error) {
  console.log('Google Mobile Ads not available - interstitial ads will be disabled');
}

// TODO: Replace with actual AdMob unit IDs from AdMob console
const AD_UNIT_IDS = {
  ios: __DEV__ ? (TestIds?.INTERSTITIAL || '') : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  android: __DEV__ ? (TestIds?.INTERSTITIAL || '') : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
};

const adUnitId = Platform.select({
  ios: AD_UNIT_IDS.ios,
  android: AD_UNIT_IDS.android,
  default: TestIds?.INTERSTITIAL || '',
});

// Create the interstitial ad instance (only if module is available)
let interstitial: any = null;
if (InterstitialAd && adUnitId) {
  try {
    interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });
  } catch (error) {
    console.log('Failed to create interstitial ad:', error);
  }
}

export function useInterstitialAd() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    // If ads not available, skip setup
    if (!interstitial || !AdEventType) {
      return;
    }

    // Set up event listeners
    const unsubscribeLoaded = interstitial.addAdEventListener(
      AdEventType.LOADED,
      () => {
        setIsLoaded(true);
        console.log('Interstitial ad loaded');
      }
    );

    const unsubscribeClosed = interstitial.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        setIsShowing(false);
        setIsLoaded(false);
        // Preload next ad
        interstitial.load();
      }
    );

    const unsubscribeError = interstitial.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.error('Interstitial ad error:', error);
        setIsLoaded(false);
        setIsShowing(false);
      }
    );

    // Load the ad
    interstitial.load();

    // Cleanup
    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  const showAd = async (): Promise<boolean> => {
    if (!interstitial) {
      console.log('Interstitial ads not available');
      return false;
    }

    if (!isLoaded) {
      console.log('Interstitial ad not ready yet');
      return false;
    }

    try {
      setIsShowing(true);
      await interstitial.show();
      return true;
    } catch (error) {
      console.error('Error showing interstitial ad:', error);
      setIsShowing(false);
      return false;
    }
  };

  return {
    showAd,
    isLoaded,
    isShowing,
  };
}
