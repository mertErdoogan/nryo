/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'adsense' | 'house' | 'none'. Defaults to adsense when a client id is set, otherwise house. */
  readonly VITE_ADS_PROVIDER?: string;
  /** AdSense publisher id, e.g. ca-pub-1234567890123456. */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** "1" serves Google's test ads. */
  readonly VITE_ADSENSE_TEST?: string;
  /** Display ad unit (slot) ids for banners. */
  readonly VITE_ADSENSE_SLOT_HOME?: string;
  readonly VITE_ADSENSE_SLOT_LIST?: string;
  readonly VITE_ADSENSE_SLOT_GAME?: string;
  /** "0" disables the house-ad fallback when the network has no rewarded ad. */
  readonly VITE_ADS_REWARD_FALLBACK?: string;
}
