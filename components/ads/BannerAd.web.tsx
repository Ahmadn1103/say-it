import { ADSENSE_CONFIG } from '@/constants/ads';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

interface BannerAdProps {
  position?: 'top' | 'bottom';
}

/**
 * Web Banner Ad using Google AdSense
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a Google AdSense account at https://adsense.google.com/
 * 2. Add your website and get verified
 * 3. Create an ad unit and get your Publisher ID and Slot ID
 * 4. Update constants/ads.ts with your AdSense IDs
 * 5. Add the AdSense script to your HTML head (see index.html instructions below)
 * 
 * Add this to your web/index.html <head>:
 * <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
 */
export function BannerAd({ position = 'bottom' }: BannerAdProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const isAdLoaded = useRef(false);

  useEffect(() => {
    // Skip if already loaded or if publisher ID is not set
    if (isAdLoaded.current || ADSENSE_CONFIG.publisherId.includes('XXXX')) {
      return;
    }

    // Try to load the ad
    try {
      if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
        (window as any).adsbygoogle.push({});
        isAdLoaded.current = true;
      }
    } catch (error) {
      console.log('AdSense not loaded:', error);
    }
  }, []);

  // Don't render if AdSense is not configured
  if (ADSENSE_CONFIG.publisherId.includes('XXXX')) {
    return null;
  }

  return (
    <View style={[styles.container, position === 'top' ? styles.top : styles.bottom]}>
      <div ref={adRef} style={{ width: '100%', textAlign: 'center' }}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={ADSENSE_CONFIG.publisherId}
          data-ad-slot={ADSENSE_CONFIG.slots.banner}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    minHeight: 50,
  },
  top: {
    paddingTop: 0,
  },
  bottom: {
    paddingBottom: 0,
  },
});
