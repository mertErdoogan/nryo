import type { Rng } from '../../lib/rng';

export const COLS = 7;
export const ROWS = 9;
export const CELL = 50;
export const LEFT = 5;
export const TOP = 60;
export const BLOCK = 46;

/** Cell content: >0 = block HP, 0 = empty, -1 = extra-ball ring. */
export type Grid = number[][];

export const emptyGrid = (): Grid => Array.from({ length: ROWS }, () => Array<number>(COLS).fill(0));

/** Shifts everything down one row and fills the top row for turn `turn`. Returns false if a block would pass the bottom. */
export function advance(grid: Grid, turn: number, rng: Rng): { grid: Grid; alive: boolean } {
  const alive = grid[ROWS - 1]!.every((v) => v <= 0);
  const next: Grid = [Array<number>(COLS).fill(0), ...grid.slice(0, ROWS - 1).map((row) => row.slice())];
  const cols = rng.shuffle([...Array(COLS).keys()]);
  const blocks = Math.min(COLS - 1, 1 + rng.int(1, Math.min(5, 2 + Math.floor(turn / 6))));
  for (let i = 0; i < blocks; i++) next[0]![cols[i]!] = rng.chance(0.25) ? turn * 2 : turn;
  next[0]![cols[blocks]!] = -1;
  return { grid: next, alive };
}

export const cellRect = (r: number, c: number) => ({
  x: LEFT + c * CELL + (CELL - BLOCK) / 2,
  y: TOP + r * CELL + (CELL - BLOCK) / 2,
  w: BLOCK,
  h: BLOCK,
});

/** Clamp aim so shots always travel upward at a playable angle. */
export function clampAim(angle: number): number {
  const min = -Math.PI + 0.12;
  const max = -0.12;
  return Math.max(min, Math.min(max, angle));
}
