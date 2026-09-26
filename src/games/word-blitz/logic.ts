import type { Rng } from '../../lib/rng';
import { BLITZ_SEEDS } from '../_shared/words/blitz-seeds.data';
import { subAnagrams, unpack } from '../_shared/words';

export const POINTS: Record<number, number> = { 3: 30, 4: 60, 5: 100, 6: 160, 7: 300 };
export const PANGRAM_BONUS = 200;

export function wordScore(word: string, letterCount: number): number {
  const base = POINTS[word.length] ?? 0;
  return word.length === letterCount ? base + PANGRAM_BONUS : base;
}

export interface Puzzle {
  seed: string;
  letters: string[];
  answers: Set<string>;
}

export function makePuzzle(rng: Rng): Puzzle {
  const seeds = unpack(BLITZ_SEEDS, 7);
  const seed = rng.pick(seeds);
  let letters = rng.shuffle(seed.split(''));
  // Avoid showing the seed word in order.
  if (letters.join('') === seed) letters = [...letters.slice(1), letters[0]!];
  return { seed, letters, answers: new Set(subAnagrams(seed, 3)) };
}

/** Whether `word` can be spelled with `letters` (respecting counts). */
export function canSpell(word: string, letters: readonly string[]): boolean {
  const pool = [...letters];
  for (const c of word) {
    const i = pool.indexOf(c);
    if (i < 0) return false;
    pool.splice(i, 1);
  }
  return true;
}
