import type { AdOutcome } from '../types';
import type { AdProvider, RewardedPlacement } from './types';

export interface HouseAdRequest {
  id: number;
  placement: RewardedPlacement;
  label: string;
  resolve(outcome: AdOutcome): void;
}

let current: HouseAdRequest | null = null;
let hosts = 0;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * State for the built-in "house" ad: a short sponsored card promoting another
 * game in the arcade. Rendered by `<AdHost/>`; works offline and needs no
 * third-party code, so rewards keep working when no ad network is configured
 * or a network has no ad to show.
 */
export const houseAds = {
  get: (): HouseAdRequest | null => current,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Registered by the AdHost component; without a host, house ads are unavailable. */
  attachHost(): () => void {
    hosts++;
    return () => {
      hosts--;
      if (hosts === 0 && current) houseAds.finish('unavailable');
    };
  },
  get available(): boolean {
    return hosts > 0;
  },
  play(placement: RewardedPlacement, label: string): Promise<AdOutcome> {
    if (hosts === 0) return Promise.resolve('unavailable');
    if (current) current.resolve('dismissed');
    return new Promise<AdOutcome>((resolve) => {
      current = { id: nextId++, placement, label, resolve };
      emit();
    });
  },
  finish(outcome: AdOutcome): void {
    const req = current;
    current = null;
    emit();
    req?.resolve(outcome);
  },
};

export const houseProvider: AdProvider = {
  name: 'house',
  banners: false,
  init() {},
  prepareRewarded(placement, label) {
    if (!houseAds.available) return Promise.resolve(null);
    return Promise.resolve({ show: () => houseAds.play(placement, label) });
  },
  // House ads never interrupt between rounds: an interstitial that earns
  // nothing would only annoy players.
  showInterstitial: () => Promise.resolve(false),
};

export const noAdsProvider: AdProvider = {
  name: 'none',
  banners: false,
  init() {},
  prepareRewarded: () => Promise.resolve(null),
  showInterstitial: () => Promise.resolve(false),
};
