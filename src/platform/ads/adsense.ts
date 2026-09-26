import { sound } from '../audio';
import type { AdOutcome } from '../types';
import type { AdPlacement, AdProvider, RewardedHandle } from './types';

/**
 * Google AdSense for games (H5 Games Ads, "Ad Placement API") for rewarded and
 * interstitial ads, plus classic AdSense display units for banners.
 * https://developers.google.com/ad-placement
 *
 * Only loaded when `VITE_ADSENSE_CLIENT` is set at build time; the build then
 * also widens the Content-Security-Policy and writes ads.txt.
 */

interface PlacementInfo {
  breakType: string;
  breakName: string;
  breakFormat: string;
  breakStatus:
    | 'notReady'
    | 'timeout'
    | 'error'
    | 'noAdPreloaded'
    | 'frequencyCapped'
    | 'ignored'
    | 'other'
    | 'dismissed'
    | 'viewed';
}

interface AdBreakOptions {
  type: 'reward' | 'next' | 'start' | 'pause' | 'browse';
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (info: PlacementInfo) => void;
}

interface AdConfigOptions {
  preloadAdBreaks?: 'on' | 'auto';
  sound?: 'on' | 'off';
  onReady?: () => void;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (o: AdBreakOptions) => void;
    adConfig?: (o: AdConfigOptions) => void;
  }
}

export interface AdSenseOptions {
  client: string;
  /** Serve Google's test ads (`data-adbreak-test="on"`). */
  test: boolean;
  /** Minimum time between interstitials that Google should respect. */
  frequencyHint: string;
}

const SCRIPT_ID = 'nryo-adsense';
const PREPARE_TIMEOUT_MS = 3000;
const INTERSTITIAL_TIMEOUT_MS = 5000;

export function createAdSenseProvider(options: AdSenseOptions): AdProvider {
  let started = false;

  const push = (o: AdBreakOptions | AdConfigOptions) => {
    window.adsbygoogle = window.adsbygoogle ?? [];
    window.adsbygoogle.push(o);
  };

  const hooks = {
    beforeAd: () => sound.hold(true),
    afterAd: () => sound.hold(false),
  };

  return {
    name: 'adsense',
    banners: true,
    init() {
      if (started || typeof document === 'undefined') return;
      started = true;
      window.adBreak = (o) => push(o);
      window.adConfig = (o) => push(o);
      if (!document.getElementById(SCRIPT_ID)) {
        const s = document.createElement('script');
        s.id = SCRIPT_ID;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(options.client)}`;
        s.dataset.adClient = options.client;
        s.dataset.adFrequencyHint = options.frequencyHint;
        if (options.test) s.dataset.adbreakTest = 'on';
        document.head.appendChild(s);
      }
      window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
    },

    prepareRewarded(placement) {
      if (!started || !navigator.onLine) return Promise.resolve(null);
      return new Promise<RewardedHandle | null>((resolve) => {
        let ready = false;
        let finished = false;
        let outcome: AdOutcome = 'dismissed';
        let done: ((o: AdOutcome) => void) | null = null;
        const timer = setTimeout(() => {
          if (!ready) {
            finished = true;
            resolve(null);
          }
        }, PREPARE_TIMEOUT_MS);
        window.adBreak?.({
          type: 'reward',
          name: placement,
          ...hooks,
          beforeReward: (showAdFn) => {
            if (finished) return;
            ready = true;
            clearTimeout(timer);
            resolve({
              show: () =>
                new Promise<AdOutcome>((res) => {
                  done = res;
                  showAdFn();
                }),
            });
          },
          adDismissed: () => {
            outcome = 'dismissed';
          },
          adViewed: () => {
            outcome = 'rewarded';
          },
          adBreakDone: () => {
            sound.hold(false);
            clearTimeout(timer);
            if (!ready && !finished) {
              finished = true;
              resolve(null);
            } else done?.(outcome);
          },
        });
      });
    },

    showInterstitial(placement: AdPlacement) {
      if (!started || !navigator.onLine) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (shown: boolean) => {
          if (settled) return;
          settled = true;
          sound.hold(false);
          resolve(shown);
        };
        // Never let a stuck ad call block "Play again".
        const timer = setTimeout(() => finish(false), INTERSTITIAL_TIMEOUT_MS);
        window.adBreak?.({
          type: 'next',
          name: placement,
          beforeAd: () => {
            clearTimeout(timer);
            hooks.beforeAd();
          },
          afterAd: hooks.afterAd,
          adBreakDone: (info) => {
            clearTimeout(timer);
            finish(info.breakStatus === 'viewed');
          },
        });
      });
    },
  };
}
