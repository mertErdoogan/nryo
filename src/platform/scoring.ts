import type { GameMeta, MedalTier } from './types';

type ScoreMeta = Pick<GameMeta, 'score' | 'medals'>;

export const MEDAL_NAMES: Record<MedalTier, string> = { 0: 'None', 1: 'Bronze', 2: 'Silver', 3: 'Gold' };

/** True when `a` is strictly better than `b` for this game. */
export function isBetter(a: number, b: number | null, lowerIsBetter = false): boolean {
  if (b === null) return true;
  return lowerIsBetter ? a < b : a > b;
}

export function meetsThreshold(score: number, threshold: number, lowerIsBetter = false): boolean {
  return lowerIsBetter ? score <= threshold : score >= threshold;
}

export function medalFor(score: number | null, meta: ScoreMeta): MedalTier {
  if (score === null) return 0;
  const low = meta.score.lowerIsBetter;
  if (meetsThreshold(score, meta.medals.gold, low)) return 3;
  if (meetsThreshold(score, meta.medals.silver, low)) return 2;
  if (meetsThreshold(score, meta.medals.bronze, low)) return 1;
  return 0;
}

export function medalThreshold(meta: ScoreMeta, tier: 1 | 2 | 3): number {
  return tier === 1 ? meta.medals.bronze : tier === 2 ? meta.medals.silver : meta.medals.gold;
}

/** The next medal to chase, or null when gold is already secured. */
export function nextMedal(score: number | null, meta: ScoreMeta): { tier: 1 | 2 | 3; threshold: number } | null {
  const current = medalFor(score, meta);
  if (current >= 3) return null;
  const tier = (current + 1) as 1 | 2 | 3;
  return { tier, threshold: medalThreshold(meta, tier) };
}

/**
 * 0–1 progress from nothing towards gold, piecewise across the medal bands.
 * Used for bars on cards and the results screen.
 */
export function medalProgress(score: number | null, meta: ScoreMeta): number {
  if (score === null) return 0;
  const { bronze, silver, gold } = meta.medals;
  const low = meta.score.lowerIsBetter;
  const band = (from: number, to: number, value: number) => {
    const t = (value - from) / (to - from || 1);
    return Math.min(1, Math.max(0, t));
  };
  if (meetsThreshold(score, gold, low)) return 1;
  if (meetsThreshold(score, silver, low)) return 2 / 3 + band(silver, gold, score) / 3;
  if (meetsThreshold(score, bronze, low)) return 1 / 3 + band(bronze, silver, score) / 3;
  // Below bronze: scale from a notional "zero" (or 2× bronze for lower-is-better).
  const start = low ? bronze * 2 : 0;
  return band(start, bronze, score) / 3;
}

/** Rounds a target to a friendly number (e.g. 1 234 → 1 250, 37 → 35). */
export function niceNumber(value: number): number {
  const abs = Math.abs(value);
  let step = 1;
  if (abs >= 100_000) step = 5_000;
  else if (abs >= 10_000) step = 500;
  else if (abs >= 1_000) step = 50;
  else if (abs >= 200) step = 10;
  else if (abs >= 40) step = 5;
  return Math.max(step, Math.round(value / step) * step);
}
