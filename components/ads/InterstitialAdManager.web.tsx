// Web version - ads not supported on web
export function useInterstitialAd() {
  return {
    showAd: async () => {
      console.log('Ads not supported on web');
      return false;
    },
    isLoaded: false,
    isShowing: false,
  };
}
