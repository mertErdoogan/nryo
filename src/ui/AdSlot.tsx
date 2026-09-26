import { useEffect, useRef } from 'react';
import { adsConfig, bannersEnabled, type AdPlacement } from '../platform/ads';

/**
 * A display-ad placement (AdSense unit). Renders nothing unless the build has
 * an AdSense client and a slot id for this placement, so layouts stay clean.
 * Banners live on browsing pages only — never on top of a game.
 */
export function AdSlot({ placement }: { placement: AdPlacement }) {
  const ref = useRef<HTMLModElement>(null);
  const enabled = bannersEnabled(placement);
  useEffect(() => {
    if (!enabled || !ref.current || ref.current.dataset.adsbygoogleStatus) return;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      /* blocked by an extension — nothing to do */
    }
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div
      data-ad-placement={placement}
      aria-label="Advertisement"
      style={{ margin: '24px 0', minHeight: 100 }}
    >
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={adsConfig.client}
        data-ad-slot={adsConfig.slots[placement]}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
