import type { Rng } from '../../lib/rng';

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Record<Level, { clues: number; base: number; par: number; label: string }> = {
  easy: { clues: 38, base: 1000, par: 300, label: 'Easy' },
  medium: { clues: 32, base: 2000, par: 600, label: 'Medium' },
  hard: { clues: 27, base: 3500, par: 900, label: 'Hard' },
};

export const boxOf = (i: number) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
const bit = (n: number) => 1 << n;

/** Counts solutions (stopping at `limit`), optionally filling `grid` with the first found. */
export function countSolutions(grid: number[], limit = 2, rng?: Rng, fill = false): number {
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = grid[i]!;
    if (!v) continue;
    const b = bit(v);
    if (rows[Math.floor(i / 9)]! & b || cols[i % 9]! & b || boxes[boxOf(i)]! & b) return 0;
    rows[Math.floor(i / 9)]! |= b;
    cols[i % 9]! |= b;
    boxes[boxOf(i)]! |= b;
  }
  let count = 0;
  const work = grid.slice();
  const search = (): boolean => {
    // Most-constrained empty cell first.
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (work[i]) continue;
      const used = rows[Math.floor(i / 9)]! | cols[i % 9]! | boxes[boxOf(i)]!;
      const mask = ~used & 0x3fe;
      let c = 0;
      for (let m = mask; m; m &= m - 1) c++;
      if (c < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = c;
        if (c <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (fill) for (let i = 0; i < 81; i++) grid[i] = work[i]!;
      return count >= limit;
    }
    let digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (bestMask & bit(d)) digits.push(d);
    if (rng) digits = rng.shuffle(digits);
    const r = Math.floor(best / 9);
    const c = best % 9;
    const bx = boxOf(best);
    for (const d of digits) {
      const b = bit(d);
      work[best] = d;
      rows[r]! |= b;
      cols[c]! |= b;
      boxes[bx]! |= b;
      if (search()) return true;
      rows[r]! &= ~b;
      cols[c]! &= ~b;
      boxes[bx]! &= ~b;
      work[best] = 0;
    }
    return false;
  };
  search();
  return count;
}

export function generate(rng: Rng, level: Level): { puzzle: number[]; solution: number[] } {
  const solution = new Array<number>(81).fill(0);
  countSolutions(solution, 1, rng, true);
  const puzzle = solution.slice();
  let filled = 81;
  for (const i of rng.shuffle(Array.from({ length: 81 }, (_, k) => k))) {
    if (filled <= LEVELS[level].clues) break;
    const keep = puzzle[i]!;
    puzzle[i] = 0;
    if (countSolutions(puzzle.slice(), 2) !== 1) puzzle[i] = keep;
    else filled--;
  }
  return { puzzle, solution };
}

export function winScore(level: Level, seconds: number, mistakes: number, hints: number): number {
  const { base, par } = LEVELS[level];
  const timeBonus = Math.max(0, par - seconds) * (base / par);
  return Math.max(100, Math.round(base + timeBonus - mistakes * 150 - hints * 200));
}

export const peers = (i: number) => {
  const out = new Set<number>();
  const r = Math.floor(i / 9);
  const c = i % 9;
  for (let k = 0; k < 9; k++) {
    out.add(r * 9 + k);
    out.add(k * 9 + c);
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) out.add((br + dr) * 9 + bc + dc);
  out.delete(i);
  return out;
};
