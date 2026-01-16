// Web version - ads not supported on web
export function useRewardedAd() {
  return {
    showAd: async () => {
      console.log('Ads not supported on web');
      return false;
    },
    isLoaded: false,
    isShowing: false,
    reward: null,
    clearReward: () => {},
  };
}
