import type { Rng } from '../../lib/rng';

export const N = 10;
export const FLEET = [5, 4, 3, 3, 2];

export interface Ship {
  cells: number[];
  hits: Set<number>;
}
export type Shot = 'miss' | 'hit' | 'sunk';

export const idx = (x: number, y: number) => y * N + x;

/** Random fleet where ships never touch, not even diagonally. */
export function placeFleet(rng: Rng): Ship[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const taken = new Set<number>();
    const ships: Ship[] = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const horiz = rng.chance(0.5);
        const x = rng.int(0, horiz ? N - len : N - 1);
        const y = rng.int(0, horiz ? N - 1 : N - len);
        const cells = Array.from({ length: len }, (_, i) => (horiz ? idx(x + i, y) : idx(x, y + i)));
        if (cells.some((c) => taken.has(c))) continue;
        ships.push({ cells, hits: new Set() });
        for (const c of cells) {
          const cx = c % N;
          const cy = Math.floor(c / N);
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx >= 0 && ny >= 0 && nx < N && ny < N) taken.add(idx(nx, ny));
            }
        }
        placed = true;
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return ships;
  }
  throw new Error('Could not place fleet');
}

export const isSunk = (s: Ship) => s.hits.size === s.cells.length;
export const allSunk = (ships: readonly Ship[]) => ships.every(isSunk);

export function fire(ships: Ship[], cell: number): Shot {
  const ship = ships.find((s) => s.cells.includes(cell));
  if (!ship) return 'miss';
  ship.hits.add(cell);
  return isSunk(ship) ? 'sunk' : 'hit';
}

/** Cells around a sunk ship (can't contain another ship). */
export function halo(ship: Ship): number[] {
  const out = new Set<number>();
  for (const c of ship.cells) {
    const cx = c % N;
    const cy = Math.floor(c / N);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        const n = idx(nx, ny);
        if (nx >= 0 && ny >= 0 && nx < N && ny < N && !ship.cells.includes(n)) out.add(n);
      }
  }
  return [...out];
}

/**
 * AI targeting. `known` maps cell → 'miss' | 'hit' | 'sunk'. Difficulty:
 * 0 = random hunting, 1 = checkerboard hunting, 2 = probability density.
 */
export function aiPick(known: Map<number, Shot>, remaining: number[], level: number, rng: Rng): number {
  const unknown = (c: number) => !known.has(c);
  // target mode: extend open hits
  const openHits = [...known.entries()].filter(([, v]) => v === 'hit').map(([c]) => c);
  if (openHits.length > 0) {
    const candidates: number[] = [];
    const line = openHits.length >= 2;
    const horiz = line && openHits.every((c) => Math.floor(c / N) === Math.floor(openHits[0]! / N));
    for (const h of openHits) {
      const x = h % N;
      const y = Math.floor(h / N);
      const dirs = line
        ? horiz
          ? [
              [-1, 0],
              [1, 0],
            ]
          : [
              [0, -1],
              [0, 1],
            ]
        : [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ];
      for (const [dx, dy] of dirs) {
        const nx = x + dx!;
        const ny = y + dy!;
        if (nx >= 0 && ny >= 0 && nx < N && ny < N && unknown(idx(nx, ny))) candidates.push(idx(nx, ny));
      }
    }
    if (candidates.length) return rng.pick(candidates);
  }
  const all = Array.from({ length: N * N }, (_, i) => i).filter(unknown);
  if (level === 0) return rng.pick(all);
  if (level === 1) {
    const parity = all.filter((c) => ((c % N) + Math.floor(c / N)) % 2 === 0);
    return rng.pick(parity.length ? parity : all);
  }
  // probability density over remaining ship lengths
  const heat = new Map<number, number>();
  for (const len of remaining)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        for (const horiz of [true, false]) {
          const cells: number[] = [];
          for (let i = 0; i < len; i++) {
            const cx = horiz ? x + i : x;
            const cy = horiz ? y : y + i;
            if (cx >= N || cy >= N) break;
            cells.push(idx(cx, cy));
          }
          if (cells.length < len || cells.some((c) => !unknown(c))) continue;
          for (const c of cells) heat.set(c, (heat.get(c) ?? 0) + 1);
        }
  let best = all[0]!;
  let bv = -1;
  for (const c of all) {
    const v = (heat.get(c) ?? 0) + rng.next() * 0.5;
    if (v > bv) {
      bv = v;
      best = c;
    }
  }
  return best;
}
