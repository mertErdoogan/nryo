import { platform } from '../index';
import type { AdOutcome } from '../types';
import { createAdSenseProvider } from './adsense';
import { houseAds, houseProvider, noAdsProvider } from './house';
import { initialPacing, noteRound, shouldShowInterstitial, type PacingState } from './policy';
import type { AdPlacement, AdProvider, RewardedPlacement } from './types';

export type { AdPlacement, RewardedPlacement } from './types';
export { houseAds } from './house';
export { PACING } from './policy';

const env = import.meta.env;
const client = (env.VITE_ADSENSE_CLIENT ?? '').trim();
const requested = (env.VITE_ADS_PROVIDER ?? '').trim();
const providerName = requested === 'none' ? 'none' : requested === 'house' || !client ? 'house' : 'adsense';

export interface AdsConfig {
  provider: 'house' | 'adsense' | 'none';
  client: string;
  /** Display ad unit ids per banner placement. */
  slots: Partial<Record<AdPlacement, string>>;
  /** Fall back to a house ad when the network has no rewarded ad (keeps continues working). */
  rewardFallback: boolean;
}

export const adsConfig: AdsConfig = {
  provider: providerName,
  client,
  slots: {
    'home-banner': env.VITE_ADSENSE_SLOT_HOME,
    'game-list': env.VITE_ADSENSE_SLOT_LIST,
    'game-page': env.VITE_ADSENSE_SLOT_GAME,
  },
  rewardFallback: env.VITE_ADS_REWARD_FALLBACK !== '0',
};

const provider: AdProvider =
  providerName === 'adsense'
    ? createAdSenseProvider({ client, test: env.VITE_ADSENSE_TEST === '1', frequencyHint: '180s' })
    : providerName === 'house'
      ? houseProvider
      : noAdsProvider;

let pacing: PacingState = initialPacing();
let initialised = false;

/** Loads the ad network (if any). Called once when the app boots. */
export function initAds(): void {
  if (initialised) return;
  initialised = true;
  provider.init();
}

export function bannersEnabled(placement: AdPlacement): boolean {
  return provider.banners && !!adsConfig.slots[placement];
}

/** True when some rewarded ad path exists (network or house fallback). */
export function rewardedAvailable(): boolean {
  if (provider.name === 'none') return false;
  return provider.name === 'adsense' || houseAds.available;
}

/**
 * Plays a rewarded ad the player explicitly asked for. Resolves 'rewarded'
 * only when the reward should be granted.
 */
export async function showRewarded(placement: RewardedPlacement, label: string): Promise<AdOutcome> {
  platform.analytics.track('ad_requested', { placement, provider: provider.name });
  let handle = await provider.prepareRewarded(placement, label);
  if (!handle && provider.name === 'adsense' && adsConfig.rewardFallback)
    handle = await houseProvider.prepareRewarded(placement, label);
  if (!handle) {
    platform.analytics.track('ad_unavailable', { placement });
    return 'unavailable';
  }
  const outcome = await handle.show();
  if (outcome === 'rewarded') {
    pacing = { ...pacing, lastRewardedAt: Date.now() };
    platform.wallet.countAd();
    platform.analytics.track('ad_rewarded', { placement });
  } else platform.analytics.track('ad_dismissed', { placement, outcome });
  return outcome;
}

/** Counts a finished round towards interstitial pacing. */
export function noteRoundFinished(durationMs: number): void {
  pacing = noteRound(pacing, durationMs);
}

/**
 * Hook between rounds. Shows an interstitial only when pacing allows it and
 * always resolves (quickly when no ad is due), so "Play again" never hangs.
 */
export async function maybeShowInterstitial(placement: AdPlacement = 'between-games'): Promise<void> {
  const now = Date.now();
  if (!shouldShowInterstitial(pacing, now)) return;
  pacing = { ...pacing, lastInterstitialAt: now, rounds: 0 };
  const shown = await provider.showInterstitial(placement);
  if (shown) platform.analytics.track('ad_interstitial', { placement });
}
