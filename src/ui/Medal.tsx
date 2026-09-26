import type { MedalTier } from '../platform/types';
import { MEDAL_NAMES } from '../platform/scoring';

const COLORS: Record<1 | 2 | 3, [string, string]> = {
  1: ['var(--bronze)', 'var(--bronze-deep)'],
  2: ['var(--silver)', 'var(--silver-deep)'],
  3: ['var(--gold)', 'var(--gold-deep)'],
};

interface MedalProps {
  tier: MedalTier;
  size?: number;
  /** Render an empty outline when tier is 0. */
  showEmpty?: boolean;
  title?: string;
}

export function Medal({ tier, size = 20, showEmpty = false, title }: MedalProps) {
  if (tier === 0 && !showEmpty) return null;
  const label = title ?? (tier === 0 ? 'No medal yet' : `${MEDAL_NAMES[tier]} medal`);
  if (tier === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
        <circle
          cx="12"
          cy="14"
          r="7"
          fill="none"
          stroke="var(--text-dim)"
          strokeWidth="1.8"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }
  const [light, deep] = COLORS[tier];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
      <path d="M7 1h4l2 6H9zM13 1h4l-2 6h-4z" fill={deep} opacity="0.9" />
      <circle cx="12" cy="14.5" r="7.5" fill={deep} />
      <circle cx="12" cy="14.5" r="5.8" fill={light} />
      <path
        d="m12 11 1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z"
        fill={deep}
        opacity="0.85"
      />
    </svg>
  );
}
