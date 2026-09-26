import type { Rng } from '../../lib/rng';

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const DIRS = [
  { bit: N, dr: -1, dc: 0, opp: S },
  { bit: E, dr: 0, dc: 1, opp: W },
  { bit: S, dr: 1, dc: 0, opp: N },
  { bit: W, dr: 0, dc: -1, opp: E },
];

export const rotateMask = (mask: number, turns: number) => {
  let m = mask;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
};

export const sizeForLevel = (level: number) => Math.min(8, 4 + Math.floor((level - 1) / 2));

/** A random spanning tree over the grid, rooted at the centre (the power core). */
export function generate(size: number, rng: Rng): { base: number[]; source: number } {
  const total = size * size;
  const masks = new Array<number>(total).fill(0);
  const source = Math.floor(size / 2) * size + Math.floor(size / 2);
  const inTree = new Set([source]);
  const frontier: [number, number][] = [];
  const addFrontier = (i: number) => {
    const r = Math.floor(i / size);
    const c = i % size;
    DIRS.forEach((d, k) => {
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && !inTree.has(nr * size + nc)) frontier.push([i, k]);
    });
  };
  addFrontier(source);
  while (inTree.size < total && frontier.length) {
    const [from, k] = frontier.splice(rng.int(0, frontier.length - 1), 1)[0]!;
    const d = DIRS[k]!;
    const to = (Math.floor(from / size) + d.dr) * size + (from % size) + d.dc;
    if (inTree.has(to)) continue;
    // Avoid 4-way crosses; they make boards feel noisy.
    let bits = 0;
    for (let m = masks[from]! | d.bit; m; m &= m - 1) bits++;
    if (bits > 3) continue;
    masks[from]! |= d.bit;
    masks[to]! |= d.opp;
    inTree.add(to);
    addFrontier(to);
  }
  return { base: masks, source };
}

export function connected(masks: readonly number[], size: number, source: number): Set<number> {
  const seen = new Set([source]);
  const stack = [source];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / size);
    const c = i % size;
    for (const d of DIRS) {
      if (!(masks[i]! & d.bit)) continue;
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const j = nr * size + nc;
      if (!seen.has(j) && masks[j]! & d.opp) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen;
}

export function scramble(size: number, rng: Rng): number[] {
  return Array.from({ length: size * size }, () => rng.int(0, 3));
}

export const puzzleScore = (size: number, seconds: number) =>
  Math.round(size * size * 10 + Math.max(0, size * size * 3 - seconds) * 5);
