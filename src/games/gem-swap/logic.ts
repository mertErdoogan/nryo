import type { Rng } from '../../lib/rng';

export const SIZE = 8;
export const TYPES = 6;
export type Special = 'none' | 'row' | 'col' | 'bomb' | 'star';

export interface Gem {
  id: number;
  type: number; // -1 for star
  special: Special;
}

export type Board = (Gem | null)[][];

let nextId = 1;
export const newGem = (type: number, special: Special = 'none'): Gem => ({ id: nextId++, type, special });

export const cloneBoard = (b: Board): Board => b.map((row) => row.slice());

/** Fills a board with no initial matches. */
export function createBoard(rng: Rng): Board {
  const b: Board = Array.from({ length: SIZE }, () => Array<Gem | null>(SIZE).fill(null));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      let t: number;
      do {
        t = rng.int(0, TYPES - 1);
      } while (
        (c >= 2 && b[r]![c - 1]?.type === t && b[r]![c - 2]?.type === t) ||
        (r >= 2 && b[r - 1]![c]?.type === t && b[r - 2]![c]?.type === t)
      );
      b[r]![c] = newGem(t);
    }
  }
  return b;
}

export interface Run {
  cells: [number, number][];
  dir: 'h' | 'v';
}

export function findRuns(b: Board): Run[] {
  const runs: Run[] = [];
  for (let r = 0; r < SIZE; r++) {
    let c = 0;
    while (c < SIZE) {
      const t = b[r]![c]?.type;
      let e = c + 1;
      while (t !== undefined && t >= 0 && e < SIZE && b[r]![e]?.type === t) e++;
      if (t !== undefined && t >= 0 && e - c >= 3) runs.push({ cells: Array.from({ length: e - c }, (_, k) => [r, c + k]), dir: 'h' });
      c = e;
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let r = 0;
    while (r < SIZE) {
      const t = b[r]![c]?.type;
      let e = r + 1;
      while (t !== undefined && t >= 0 && e < SIZE && b[e]![c]?.type === t) e++;
      if (t !== undefined && t >= 0 && e - r >= 3) runs.push({ cells: Array.from({ length: e - r }, (_, k) => [r + k, c]), dir: 'v' });
      r = e;
    }
  }
  return runs;
}

export const key = (r: number, c: number) => r * SIZE + c;

export function swap(b: Board, a: [number, number], z: [number, number]): Board {
  const n = cloneBoard(b);
  const t = n[a[0]]![a[1]]!;
  n[a[0]]![a[1]] = n[z[0]]![z[1]]!;
  n[z[0]]![z[1]] = t;
  return n;
}

export const adjacent = (a: [number, number], z: [number, number]) => Math.abs(a[0] - z[0]) + Math.abs(a[1] - z[1]) === 1;

export function hasMove(b: Board): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (b[r]![c]?.special === 'star') return true;
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
      ] as const) {
        const r2 = r + dr;
        const c2 = c + dc;
        if (r2 >= SIZE || c2 >= SIZE) continue;
        if (findRuns(swap(b, [r, c], [r2, c2])).length > 0) return true;
      }
    }
  }
  return false;
}

export interface ClearResult {
  cleared: Set<number>;
  created: { r: number; c: number; gem: Gem }[];
  specialsFired: number;
}

/**
 * Determines every cell cleared by the current runs (expanding special gem
 * effects) and which special gems are created. `focus` is the swapped cell
 * that should become the special, when applicable.
 */
export function resolveClears(b: Board, runs: Run[], focus: [number, number] | null, rng: Rng): ClearResult {
  const cleared = new Set<number>();
  const created: ClearResult['created'] = [];
  const counts = new Map<number, number>();
  for (const run of runs) for (const [r, c] of run.cells) counts.set(key(r, c), (counts.get(key(r, c)) ?? 0) + 1);

  for (const run of runs) {
    const inRun = (r: number, c: number) => run.cells.some(([rr, cc]) => rr === r && cc === c);
    const anchor: [number, number] =
      focus && inRun(focus[0], focus[1]) ? focus : run.cells[Math.floor(run.cells.length / 2)]!;
    const type = b[run.cells[0]![0]]![run.cells[0]![1]]!.type;
    const crossing = run.cells.find(([r, c]) => (counts.get(key(r, c)) ?? 0) > 1);
    let special: Special = 'none';
    if (run.cells.length >= 5) special = 'star';
    else if (crossing) special = 'bomb';
    else if (run.cells.length === 4) special = run.dir === 'h' ? 'row' : 'col';
    for (const [r, c] of run.cells) cleared.add(key(r, c));
    if (special !== 'none') {
      const at = special === 'bomb' && crossing ? crossing : anchor;
      if (!created.some((x) => x.r === at[0] && x.c === at[1])) {
        created.push({ r: at[0], c: at[1], gem: newGem(special === 'star' ? -1 : type, special) });
      }
    }
  }

  const specialsFired = expandSpecials(b, cleared, rng);
  // Newly created specials survive in place.
  for (const cr of created) cleared.delete(key(cr.r, cr.c));
  return { cleared, created, specialsFired };
}

/** Adds the effects of any special gems inside `cleared` (in place). Returns how many fired. */
export function expandSpecials(b: Board, cleared: Set<number>, rng: Rng): number {
  let fired = 0;
  const queue = [...cleared];
  const done = new Set<number>();
  while (queue.length) {
    const k = queue.pop()!;
    const r = Math.floor(k / SIZE);
    const c = k % SIZE;
    const g = b[r]![c];
    if (!g || g.special === 'none' || done.has(k)) continue;
    done.add(k);
    fired++;
    const hit: number[] = [];
    if (g.special === 'row') for (let x = 0; x < SIZE; x++) hit.push(key(r, x));
    else if (g.special === 'col') for (let y = 0; y < SIZE; y++) hit.push(key(y, c));
    else if (g.special === 'bomb') {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (r + dy >= 0 && r + dy < SIZE && c + dx >= 0 && c + dx < SIZE) hit.push(key(r + dy, c + dx));
        }
      }
    } else if (g.special === 'star') {
      const t = rng.int(0, TYPES - 1);
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (b[y]![x]?.type === t) hit.push(key(y, x));
    }
    for (const h of hit) {
      if (!cleared.has(h)) {
        cleared.add(h);
        queue.push(h);
      }
    }
  }
  return fired;
}

/** Clears every gem of `type` (star swapped with a normal gem). */
export function starClear(b: Board, star: [number, number], type: number): Set<number> {
  const out = new Set<number>([key(star[0], star[1])]);
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (b[r]![c]?.type === type) out.add(key(r, c));
  return out;
}

/** Removes cleared cells, drops gems down and fills from the top. */
export function collapse(b: Board, cleared: Set<number>, rng: Rng): Board {
  const n = cloneBoard(b);
  for (const k of cleared) n[Math.floor(k / SIZE)]![k % SIZE] = null;
  for (let c = 0; c < SIZE; c++) {
    const column: Gem[] = [];
    for (let r = SIZE - 1; r >= 0; r--) if (n[r]![c]) column.push(n[r]![c]!);
    for (let r = SIZE - 1, i = 0; r >= 0; r--, i++) n[r]![c] = column[i] ?? newGem(rng.int(0, TYPES - 1));
  }
  return n;
}

export function shuffleBoard(b: Board, rng: Rng): Board {
  let gems = rng.shuffle(b.flat().filter((g): g is Gem => !!g));
  let n: Board;
  let guard = 0;
  do {
    gems = rng.shuffle(gems);
    n = Array.from({ length: SIZE }, (_, r) => gems.slice(r * SIZE, r * SIZE + SIZE));
  } while ((findRuns(n).length > 0 || !hasMove(n)) && guard++ < 50);
  return n;
}

export const SPECIAL_BONUS: Record<Special, number> = { none: 0, row: 60, col: 60, bomb: 90, star: 150 };
