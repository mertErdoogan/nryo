/** Merge Drop rules: drop numbered blocks into columns; equal neighbours merge. */

export const COLS = 5;
export const ROWS = 7;

export interface Block {
  id: number;
  exp: number; // value = 2^exp
}
/** grid[col][row], row 0 = bottom. */
export type Grid = (Block | null)[][];

export const emptyGrid = (): Grid =>
  Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => null));
export const value = (exp: number) => 2 ** exp;

export function height(grid: Grid, col: number): number {
  const c = grid[col]!;
  let h = 0;
  while (h < ROWS && c[h]) h++;
  return h;
}

function gravity(grid: Grid, moved: Set<Block>): void {
  for (let c = 0; c < COLS; c++) {
    const col = grid[c]!;
    const stack = col.filter((b): b is Block => b !== null);
    for (let r = 0; r < ROWS; r++) {
      const b = stack[r] ?? null;
      if (b && col[r] !== b) moved.add(b);
      col[r] = b;
    }
  }
}

const find = (grid: Grid, b: Block): [number, number] | null => {
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (grid[c]![r] === b) return [c, r];
  return null;
};

export interface DropResult {
  ok: boolean;
  points: number;
  merges: number;
  chain: number;
  maxExp: number;
}

/**
 * Drops `block` into `col` and resolves merge chains. A block merging with k
 * equal neighbours (left, right, below) grows by k doublings.
 */
export function drop(grid: Grid, col: number, block: Block): DropResult {
  const h = height(grid, col);
  if (h >= ROWS) return { ok: false, points: 0, merges: 0, chain: 0, maxExp: 0 };
  grid[col]![h] = block;
  let active = new Set<Block>([block]);
  let points = 0;
  let merges = 0;
  let chain = 0;
  let maxExp = block.exp;
  while (active.size > 0) {
    const next = new Set<Block>();
    let merged = false;
    // process lowest first so chains resolve bottom-up
    const list = [...active].sort((a, b) => (find(grid, a)?.[1] ?? 0) - (find(grid, b)?.[1] ?? 0));
    for (const b of list) {
      const pos = find(grid, b);
      if (!pos) continue;
      const [c, r] = pos;
      const neighbours: [number, number][] = [
        [c - 1, r],
        [c + 1, r],
        [c, r - 1],
        [c, r + 1],
      ];
      let k = 0;
      for (const [nc, nr] of neighbours) {
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const o = grid[nc]![nr];
        if (o && o !== b && o.exp === b.exp) {
          grid[nc]![nr] = null;
          k++;
        }
      }
      if (k > 0) {
        b.exp += k;
        points += value(b.exp);
        merges += k;
        maxExp = Math.max(maxExp, b.exp);
        next.add(b);
        merged = true;
      }
    }
    if (merged) chain++;
    gravity(grid, next);
    active = next;
  }
  return { ok: true, points, merges, chain, maxExp };
}

export function isFull(grid: Grid): boolean {
  for (let c = 0; c < COLS; c++) if (height(grid, c) < ROWS) return false;
  return true;
}
