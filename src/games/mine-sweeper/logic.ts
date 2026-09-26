import type { Rng } from '../../lib/rng';

export type Level = 'easy' | 'medium' | 'hard';

export const LEVELS: Record<Level, { rows: number; cols: number; mines: number; base: number; par: number; label: string }> = {
  easy: { rows: 9, cols: 9, mines: 10, base: 1000, par: 120, label: 'Easy · 9×9' },
  medium: { rows: 12, cols: 12, mines: 24, base: 2500, par: 300, label: 'Medium · 12×12' },
  hard: { rows: 18, cols: 12, mines: 42, base: 5000, par: 600, label: 'Hard · 12×18' },
};

export function neighbors(i: number, rows: number, cols: number): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc);
    }
  }
  return out;
}

/** Places mines avoiding the first-tapped cell and its neighbours. */
export function placeMines(rows: number, cols: number, count: number, safe: number, rng: Rng): boolean[] {
  const forbidden = new Set([safe, ...neighbors(safe, rows, cols)]);
  const candidates = Array.from({ length: rows * cols }, (_, i) => i).filter((i) => !forbidden.has(i));
  const chosen = new Set(rng.shuffle(candidates).slice(0, count));
  return Array.from({ length: rows * cols }, (_, i) => chosen.has(i));
}

export function counts(mines: readonly boolean[], rows: number, cols: number): number[] {
  return mines.map((_, i) => neighbors(i, rows, cols).filter((n) => mines[n]).length);
}

/** Reveals `start`, flooding through zero-count cells. Returns newly revealed indices. */
export function flood(
  start: number,
  mines: readonly boolean[],
  nums: readonly number[],
  revealed: ReadonlySet<number>,
  flags: ReadonlySet<number>,
  rows: number,
  cols: number,
): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (seen.has(i) || revealed.has(i) || flags.has(i)) continue;
    seen.add(i);
    out.push(i);
    if (!mines[i] && nums[i] === 0) for (const n of neighbors(i, rows, cols)) stack.push(n);
  }
  return out;
}

export function isWon(mines: readonly boolean[], revealed: ReadonlySet<number>): boolean {
  return mines.every((m, i) => m || revealed.has(i));
}

export function winScore(level: Level, seconds: number): number {
  const { base, par } = LEVELS[level];
  return Math.round(base + Math.max(0, par - seconds) * (base / par));
}
