/**
 * Monetisation readiness without monetisation. Placements are typed so a
 * future provider can be wired in one place. Nothing is shown by default and
 * no third-party code is loaded.
 */
export type AdPlacement = 'home-banner' | 'game-list' | 'between-games' | 'rewarded';

export interface AdsConfig {
  enabled: boolean;
  placements: AdPlacement[];
}

export const adsConfig: AdsConfig = {
  enabled: false,
  placements: [],
};

/**
 * Hook point between rounds. Resolves immediately while ads are disabled so
 * the "Play again" flow is never delayed.
 */
export function maybeShowInterstitial(_placement: AdPlacement = 'between-games'): Promise<void> {
  return Promise.resolve();
}
