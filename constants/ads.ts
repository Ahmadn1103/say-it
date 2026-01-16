/**
 * Google AdMob Configuration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create an AdMob account at https://admob.google.com/
 * 2. Add your iOS and Android apps
 * 3. Create ad units for each ad type (Banner, Interstitial, Rewarded)
 * 4. Replace the placeholder IDs below with your actual IDs
 * 5. Update app.json with your App IDs (see comments below)
 * 
 * APP IDS (for app.json):
 * - iOS App ID: ca-app-pub-YOUR_PUBLISHER_ID~YOUR_IOS_APP_ID
 * - Android App ID: ca-app-pub-YOUR_PUBLISHER_ID~YOUR_ANDROID_APP_ID
 */

// =============================================================================
// REPLACE THESE WITH YOUR ACTUAL ADMOB IDS
// =============================================================================

export const ADMOB_IDS = {
  // App IDs (also need to be set in app.json)
  appId: {
    ios: 'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
    android: 'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
  },
  
  // Banner Ad Unit IDs
  banner: {
    ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    android: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  },
  
  // Interstitial Ad Unit IDs
  interstitial: {
    ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    android: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  },
  
  // Rewarded Ad Unit IDs
  rewarded: {
    ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    android: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  },
};

// =============================================================================
// TEST IDS (used automatically in development mode)
// These are Google's official test IDs - safe to use for testing
// =============================================================================

export const TEST_IDS = {
  appId: {
    ios: 'ca-app-pub-3940256099942544~1458002511',
    android: 'ca-app-pub-3940256099942544~3347511713',
  },
  banner: {
    ios: 'ca-app-pub-3940256099942544/2934735716',
    android: 'ca-app-pub-3940256099942544/6300978111',
  },
  interstitial: {
    ios: 'ca-app-pub-3940256099942544/4411468910',
    android: 'ca-app-pub-3940256099942544/1033173712',
  },
  rewarded: {
    ios: 'ca-app-pub-3940256099942544/1712485313',
    android: 'ca-app-pub-3940256099942544/5224354917',
  },
};

// =============================================================================
// AD SETTINGS
// =============================================================================

export const AD_SETTINGS = {
  // Show interstitial ad every N rounds
  interstitialFrequency: 3,
  
  // Request non-personalized ads (for GDPR compliance)
  requestNonPersonalizedAdsOnly: false,
};
