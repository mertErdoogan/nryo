import type { Rng } from '../../lib/rng';

export const CAPACITY = 4;
export type Tubes = number[][];

export const colorsForLevel = (level: number) => Math.min(11, 3 + Math.floor((level - 1) / 2));

export const top = (t: number[]) => t[t.length - 1];

export function canMove(tubes: Tubes, from: number, to: number, capacity = CAPACITY): boolean {
  if (from === to) return false;
  const a = tubes[from]!;
  const b = tubes[to]!;
  if (a.length === 0 || b.length >= capacity) return false;
  return b.length === 0 || top(b) === top(a);
}

/** Moves every matching ball on top of `from` that fits. Returns the number moved. */
export function applyMove(tubes: Tubes, from: number, to: number, capacity = CAPACITY): number {
  let moved = 0;
  while (canMove(tubes, from, to, capacity)) {
    const colour = top(tubes[from]!)!;
    tubes[to]!.push(tubes[from]!.pop()!);
    moved++;
    if (top(tubes[from]!) !== colour) break;
  }
  return moved;
}

const uniform = (t: number[]) => t.every((c) => c === t[0]);

export function isSolved(tubes: Tubes, capacity = CAPACITY): boolean {
  return tubes.every((t) => t.length === 0 || (t.length === capacity && uniform(t)));
}

const keyOf = (tubes: Tubes) =>
  tubes
    .map((t) => t.join(','))
    .sort()
    .join('|');

/**
 * Depth-first solver with a node budget. Returns the move list, or null if no
 * solution was found within the budget.
 */
export function solve(start: Tubes, capacity = CAPACITY, budget = 60000): [number, number][] | null {
  const seen = new Set<string>();
  const path: [number, number][] = [];
  let nodes = 0;
  const tubes = start.map((t) => t.slice());
  const dfs = (): boolean => {
    if (isSolved(tubes, capacity)) return true;
    if (++nodes > budget) return false;
    const key = keyOf(tubes);
    if (seen.has(key)) return false;
    seen.add(key);
    const moves: [number, number, number][] = [];
    for (let i = 0; i < tubes.length; i++) {
      const a = tubes[i]!;
      if (a.length === 0 || (a.length === capacity && uniform(a))) continue;
      let emptyTried = false;
      for (let j = 0; j < tubes.length; j++) {
        if (!canMove(tubes, i, j, capacity)) continue;
        const b = tubes[j]!;
        if (b.length === 0) {
          if (uniform(a) || emptyTried) continue; // pointless or symmetric
          emptyTried = true;
          moves.push([i, j, 0]);
        } else moves.push([i, j, 2 + b.length]);
      }
    }
    moves.sort((m1, m2) => m2[2] - m1[2]);
    for (const [i, j] of moves) {
      const snapshot = tubes.map((t) => t.slice());
      applyMove(tubes, i, j, capacity);
      path.push([i, j]);
      if (dfs()) return true;
      path.pop();
      for (let k = 0; k < tubes.length; k++) tubes[k] = snapshot[k]!;
    }
    return false;
  };
  return dfs() ? path : null;
}

/** A shuffled, solvable level: `colors` full tubes plus two empty ones. */
export function generate(colors: number, rng: Rng, capacity = CAPACITY): Tubes {
  for (let attempt = 0; attempt < 40; attempt++) {
    const balls: number[] = [];
    for (let c = 0; c < colors; c++) for (let k = 0; k < capacity; k++) balls.push(c);
    const mixed = rng.shuffle(balls);
    const tubes: Tubes = [];
    for (let c = 0; c < colors; c++) tubes.push(mixed.slice(c * capacity, (c + 1) * capacity));
    tubes.push([], []);
    if (tubes.some((t) => t.length === capacity && uniform(t))) continue;
    if (solve(tubes, capacity, 30000)) return tubes;
  }
  // Fallback: a gently mixed but certainly solvable layout.
  const tubes: Tubes = [];
  for (let c = 0; c < colors; c++) tubes.push(Array.from({ length: capacity }, () => c));
  tubes.push([], []);
  for (let i = 0; i < colors * 6; i++) {
    const from = rng.int(0, tubes.length - 1);
    const to = rng.int(0, tubes.length - 1);
    if (from !== to && tubes[from]!.length > 0 && tubes[to]!.length < capacity)
      tubes[to]!.push(tubes[from]!.pop()!);
  }
  return tubes;
}
