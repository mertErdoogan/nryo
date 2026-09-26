import type { Rng } from '../../lib/rng';

export function gridSizeFor(level: number): number {
  if (level <= 2) return 3;
  if (level <= 5) return 4;
  if (level <= 9) return 5;
  if (level <= 14) return 6;
  return 7;
}

export const tilesFor = (level: number) => {
  const n = gridSizeFor(level);
  return Math.min(n * n - 3, level + 2);
};

export function pickTiles(level: number, rng: Rng): Set<number> {
  const n = gridSizeFor(level);
  const cells = rng.shuffle(Array.from({ length: n * n }, (_, i) => i));
  return new Set(cells.slice(0, tilesFor(level)));
}

/** How long the pattern is shown (ms). */
export const showTime = (count: number) => 900 + count * 110;
