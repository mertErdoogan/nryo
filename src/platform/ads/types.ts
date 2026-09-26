import type { AdOutcome } from '../types';

/** Every place an ad can appear. Typed so reporting and pacing stay consistent. */
export type AdPlacement =
  | 'home-banner'
  | 'game-list'
  | 'game-page'
  | 'between-games'
  | 'revive'
  | 'double-coins'
  | 'free-coins'
  | 'daily-reward'
  | 'skin-unlock'
  | 'in-game';

export type RewardedPlacement = Extract<
  AdPlacement,
  'revive' | 'double-coins' | 'free-coins' | 'daily-reward' | 'skin-unlock' | 'in-game'
>;

/** A rewarded ad that is loaded and ready; `show` plays it. */
export interface RewardedHandle {
  show(): Promise<AdOutcome>;
}

/**
 * An ad network adapter. Implementations: `house` (built-in cross-promotion,
 * no network) and `adsense` (Google AdSense for H5 games + display banners).
 */
export interface AdProvider {
  readonly name: 'house' | 'adsense' | 'none';
  /** Whether display banners can render. */
  readonly banners: boolean;
  init(): void;
  /** Resolves a handle when a rewarded ad is available, or null (no fill, offline, blocked). */
  prepareRewarded(placement: RewardedPlacement, label: string): Promise<RewardedHandle | null>;
  /** Resolves true if an interstitial was actually shown. */
  showInterstitial(placement: AdPlacement): Promise<boolean>;
}
