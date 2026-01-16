import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Dynamically import the module to handle when it's not available
let RewardedAd: any = null;
let RewardedAdEventType: any = null;
let AdEventType: any = null;
let TestIds: any = null;

try {
  const ads = require('react-native-google-mobile-ads');
  RewardedAd = ads.RewardedAd;
  RewardedAdEventType = ads.RewardedAdEventType;
  AdEventType = ads.AdEventType;
  TestIds = ads.TestIds;
} catch (error) {
  console.log('Google Mobile Ads not available - rewarded ads will be disabled');
}

// TODO: Replace with actual AdMob unit IDs from AdMob console
const AD_UNIT_IDS = {
  ios: __DEV__ ? (TestIds?.REWARDED || '') : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  android: __DEV__ ? (TestIds?.REWARDED || '') : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
};

const adUnitId = Platform.select({
  ios: AD_UNIT_IDS.ios,
  android: AD_UNIT_IDS.android,
  default: TestIds?.REWARDED || '',
});

// Create the rewarded ad instance (only if module is available)
let rewardedAd: any = null;
if (RewardedAd && adUnitId) {
  try {
    rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });
  } catch (error) {
    console.log('Failed to create rewarded ad:', error);
  }
}

export function useRewardedAd() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isShowing, setIsShowing] = useState(false);
  const [reward, setReward] = useState<{ type: string; amount: number } | null>(null);

  useEffect(() => {
    // If ads not available, skip setup
    if (!rewardedAd || !RewardedAdEventType || !AdEventType) {
      return;
    }

    // Set up event listeners
    const unsubscribeLoaded = rewardedAd.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        setIsLoaded(true);
        console.log('Rewarded ad loaded');
      }
    );

    const unsubscribeEarned = rewardedAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      (reward) => {
        console.log('User earned reward:', reward);
        setReward(reward);
      }
    );

    const unsubscribeClosed = rewardedAd.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        setIsShowing(false);
        setIsLoaded(false);
        // Preload next ad
        rewardedAd.load();
      }
    );

    const unsubscribeError = rewardedAd.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.error('Rewarded ad error:', error);
        setIsLoaded(false);
        setIsShowing(false);
      }
    );

    // Load the ad
    rewardedAd.load();

    // Cleanup
    return () => {
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  const showAd = async (): Promise<boolean> => {
    if (!rewardedAd) {
      console.log('Rewarded ads not available');
      return false;
    }

    if (!isLoaded) {
      console.log('Rewarded ad not ready yet');
      return false;
    }

    try {
      setIsShowing(true);
      await rewardedAd.show();
      return true;
    } catch (error) {
      console.error('Error showing rewarded ad:', error);
      setIsShowing(false);
      return false;
    }
  };

  const clearReward = () => {
    setReward(null);
  };

  return {
    showAd,
    isLoaded,
    isShowing,
    reward,
    clearReward,
  };
}
