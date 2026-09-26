import type { Rng } from '../../lib/rng';

export const COLORS = [
  { name: 'RED', hex: '#ef4444' },
  { name: 'BLUE', hex: '#3b82f6' },
  { name: 'GREEN', hex: '#22c55e' },
  { name: 'YELLOW', hex: '#facc15' },
  { name: 'PURPLE', hex: '#a855f7' },
  { name: 'ORANGE', hex: '#f97316' },
] as const;

export interface Question {
  word: number;
  ink: number;
  /** Distracting background tint (later in the round). */
  tint: number | null;
  matches: boolean;
}

export function makeQuestion(rng: Rng, elapsed: number): Question {
  const word = rng.int(0, COLORS.length - 1);
  const matches = rng.chance(0.5);
  let ink = word;
  if (!matches) {
    ink = rng.int(0, COLORS.length - 2);
    if (ink >= word) ink += 1;
  }
  const tint = elapsed > 15 && rng.chance(0.5) ? rng.int(0, COLORS.length - 1) : null;
  return { word, ink, tint, matches };
}

export const multiplier = (streak: number) => Math.min(4, 1 + Math.floor(streak / 5));
