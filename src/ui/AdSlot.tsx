import { adsConfig, type AdPlacement } from '../platform/ads';

/**
 * Reserved, typed placement for future advertising. Renders nothing while ads
 * are disabled (the default), so layouts stay clean; enabling a provider later
 * does not require touching pages.
 */
export function AdSlot({ placement }: { placement: AdPlacement }) {
  if (!adsConfig.enabled || !adsConfig.placements.includes(placement)) return null;
  return <div data-ad-placement={placement} aria-label="Advertisement" style={{ minHeight: 90 }} />;
}
