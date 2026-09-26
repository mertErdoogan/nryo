import type { Rng } from '../../lib/rng';

export const N = 6;
export const EXIT_ROW = 2;

export interface Car {
  id: number;
  x: number;
  y: number;
  len: number;
  horiz: boolean;
}

export const cells = (c: Car): [number, number][] =>
  Array.from({ length: c.len }, (_, i) => (c.horiz ? [c.x + i, c.y] : [c.x, c.y + i]));

export function occupancy(cars: readonly Car[], skip = -1): Int8Array {
  const grid = new Int8Array(N * N).fill(-1);
  for (const c of cars) if (c.id !== skip) for (const [x, y] of cells(c)) grid[y * N + x] = c.id;
  return grid;
}

/** How far a car can slide back (negative) and forward (positive). */
export function slideRange(cars: readonly Car[], id: number): [number, number] {
  const car = cars.find((c) => c.id === id)!;
  const grid = occupancy(cars, id);
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && grid[y * N + x] === -1;
  let back = 0;
  while (car.horiz ? free(car.x - back - 1, car.y) : free(car.x, car.y - back - 1)) back++;
  let fwd = 0;
  while (car.horiz ? free(car.x + car.len + fwd, car.y) : free(car.x, car.y + car.len + fwd)) fwd++;
  return [-back, fwd];
}

export const isSolved = (cars: readonly Car[]) => {
  const red = cars.find((c) => c.id === 0)!;
  return red.x + red.len === N;
};

export interface Move {
  id: number;
  delta: number;
}

/**
 * Breadth-first search for the shortest solution (each slide of any length
 * counts as one move). States are packed into short strings for speed.
 */
export function solve(start: readonly Car[], limit = 120000): Move[] | null {
  const n = start.length;
  const horiz = start.map((c) => c.horiz);
  const len = start.map((c) => c.len);
  const fixed = start.map((c) => (c.horiz ? c.y : c.x));
  const redIdx = start.findIndex((c) => c.id === 0);
  const ids = start.map((c) => c.id);
  const pos0 = new Uint8Array(n);
  start.forEach((c, i) => (pos0[i] = c.horiz ? c.x : c.y));
  const enc = (p: Uint8Array) => String.fromCharCode(...p);
  const grid = new Int8Array(N * N);
  const fill = (p: Uint8Array) => {
    grid.fill(-1);
    for (let i = 0; i < n; i++)
      for (let k = 0; k < len[i]!; k++) {
        const x = horiz[i] ? p[i]! + k : fixed[i]!;
        const y = horiz[i] ? fixed[i]! : p[i]! + k;
        grid[y * N + x] = i;
      }
  };
  const solvedPos = (p: Uint8Array) => p[redIdx]! + len[redIdx]! === N;
  const startKey = enc(pos0);
  const prev = new Map<string, [string, number, number] | null>([[startKey, null]]);
  if (solvedPos(pos0)) return [];
  let frontier: Uint8Array[] = [pos0];
  let goal: string | null = null;
  outer: while (frontier.length && prev.size < limit) {
    const next: Uint8Array[] = [];
    for (const p of frontier) {
      fill(p);
      const k = enc(p);
      for (let i = 0; i < n; i++) {
        const h = horiz[i]!;
        const f = fixed[i]!;
        const at = (q: number) => (h ? grid[f * N + q] : grid[q * N + f]);
        for (const dir of [-1, 1]) {
          let d = dir;
          while (true) {
            const lead = dir < 0 ? p[i]! + d : p[i]! + len[i]! - 1 + d;
            if (lead < 0 || lead >= N || at(lead) !== -1) break;
            const q = p.slice();
            q[i] = p[i]! + d;
            const qk = enc(q);
            if (!prev.has(qk)) {
              prev.set(qk, [k, ids[i]!, d]);
              if (solvedPos(q)) {
                goal = qk;
                break outer;
              }
              next.push(q);
            }
            d += dir;
          }
        }
      }
    }
    frontier = next;
  }
  if (!goal) return null;
  const moves: Move[] = [];
  let cur = goal;
  while (prev.get(cur)) {
    const [from, id, delta] = prev.get(cur)!;
    moves.unshift({ id, delta });
    cur = from;
  }
  return moves;
}

export const targetMoves = (level: number) => Math.min(16, 3 + level);

/** Random solvable puzzle whose shortest solution is as close to the target length as we can find. */
export function generate(level: number, rng: Rng): { cars: Car[]; min: number } {
  const target = targetMoves(level);
  let best: { cars: Car[]; min: number } | null = null;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const elapsed = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  for (let attempt = 0; attempt < 400 && (attempt < 12 || elapsed() < 350); attempt++) {
    const cars: Car[] = [{ id: 0, x: rng.int(0, 2), y: EXIT_ROW, len: 2, horiz: true }];
    const count = rng.int(7, 9 + Math.min(4, Math.floor(level / 3)));
    let tries = 0;
    while (cars.length < count && tries++ < 200) {
      const horiz = rng.chance(0.45);
      const len = rng.chance(0.3) ? 3 : 2;
      const x = horiz ? rng.int(0, N - len) : rng.int(0, N - 1);
      const y = horiz ? rng.int(0, N - 1) : rng.int(0, N - len);
      if (horiz && y === EXIT_ROW) continue;
      const car = { id: cars.length, x, y, len, horiz };
      const grid = occupancy(cars);
      if (cells(car).some(([cx, cy]) => grid[cy * N + cx] !== -1)) continue;
      cars.push(car);
    }
    if (isSolved(cars)) continue;
    const sol = solve(cars, 40000);
    if (!sol) continue;
    if (!best || Math.abs(sol.length - target) < Math.abs(best.min - target))
      best = { cars, min: sol.length };
    if (sol.length >= target) break;
  }
  return (
    best ?? {
      cars: [
        { id: 0, x: 0, y: EXIT_ROW, len: 2, horiz: true },
        { id: 1, x: 3, y: 1, len: 3, horiz: false },
      ],
      min: 2,
    }
  );
}
