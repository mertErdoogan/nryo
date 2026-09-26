export type HoleKind = 'mole' | 'golden' | 'bomb';

export interface Hole {
  kind: HoleKind | null;
  /** Seconds left before it hides. */
  ttl: number;
  /** Seconds since the hole was whacked (for the bonk animation), or -1. */
  hitAge: number;
}

export const ROUND_SECONDS = 40;

/** Difficulty ramps with elapsed time (0 → ROUND_SECONDS). */
export function spawnInterval(elapsed: number): number {
  return Math.max(0.32, 0.85 - elapsed * 0.014);
}

export function visibleFor(elapsed: number): number {
  return Math.max(0.55, 1.25 - elapsed * 0.018);
}

export function comboMultiplier(combo: number): number {
  return Math.min(5, 1 + Math.floor(combo / 5));
}

export function pointsFor(kind: HoleKind, combo: number): number {
  if (kind === 'bomb') return -25;
  const base = kind === 'golden' ? 50 : 10;
  return base * comboMultiplier(combo);
}
