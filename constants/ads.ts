/**
 * Google AdMob Configuration (iOS Only)
 * 
 * SETUP INSTRUCTIONS FOR iOS:
 * 1. Create an AdMob account at https://admob.google.com/
 * 2. Add your iOS app
 * 3. Create ad units for each ad type (Banner, Interstitial)
 * 4. Replace the placeholder IDs below with your actual IDs
 * 5. Update app.json with your iOS App ID
 * 
 * APP ID (for app.json):
 * - iOS App ID: ca-app-pub-YOUR_PUBLISHER_ID~YOUR_IOS_APP_ID
 * 
 * WEB ADS:
 * - Web uses Google AdSense instead of AdMob
 * - Set up AdSense at https://adsense.google.com/
 * - See BannerAd.web.tsx for web ad implementation
 */

// =============================================================================
// REPLACE THESE WITH YOUR ACTUAL ADMOB IDS (iOS ONLY)
// =============================================================================

export const ADMOB_IDS = {
  // iOS App ID (also needs to be set in app.json)
  appId: {
    ios: 'ca-app-pub-3372982708744613~4273860221',
  },
  
  // Banner Ad Unit ID
  banner: {
    ios: 'ca-app-pub-3372982708744613/5231912197',
  },
  
  // Interstitial Ad Unit ID
  interstitial: {
    ios: 'ca-app-pub-3372982708744613/5749775188',
  },
  
  // Rewarded Ad Unit ID (optional - not configured)
  rewarded: {
    ios: '', // Create a Rewarded ad unit if needed
  },
};

// =============================================================================
// TEST IDS (used automatically in development mode)
// These are Google's official test IDs - safe to use for testing
// =============================================================================

export const TEST_IDS = {
  appId: {
    ios: 'ca-app-pub-3940256099942544~1458002511',
  },
  banner: {
    ios: 'ca-app-pub-3940256099942544/2934735716',
  },
  interstitial: {
    ios: 'ca-app-pub-3940256099942544/4411468910',
  },
  rewarded: {
    ios: 'ca-app-pub-3940256099942544/1712485313',
  },
};

// =============================================================================
// GOOGLE ADSENSE CONFIGURATION (WEB ONLY)
// =============================================================================

export const ADSENSE_CONFIG = {
  // Your AdSense Publisher ID (format: ca-pub-XXXXXXXXXXXXXXXX)
  publisherId: 'ca-pub-XXXXXXXXXXXXXXXX', // Replace with your AdSense Publisher ID
  
  // Ad Slot IDs for different ad units
  slots: {
    banner: 'XXXXXXXXXX', // Replace with your Banner Ad Slot ID
  },
};

// =============================================================================
// AD SETTINGS
// =============================================================================

export const AD_SETTINGS = {
  // Show interstitial ad every N rounds
  interstitialFrequency: 5,
  
  // Request non-personalized ads (for GDPR compliance)
  requestNonPersonalizedAdsOnly: false,
};
