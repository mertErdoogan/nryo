import type { Rng } from '../../lib/rng';
import { THEMES } from './themes';

export const SIZE = 10;
export const WORDS_PER_PUZZLE = 8;

export interface Placement {
  word: string;
  r: number;
  c: number;
  dr: number;
  dc: number;
}

export interface Puzzle {
  theme: string;
  grid: string[][];
  placements: Placement[];
}

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
];

// Rough English letter frequencies for natural-looking filler.
const FILLER = 'EEEEEEEAAAAAIIIIOOOONNNNRRRRTTTTLLLSSSUUDDGGBCCMMPPFHHVWYKJXQZ';

export function generate(rng: Rng): Puzzle {
  const theme = rng.pick(Object.keys(THEMES));
  const words = rng
    .shuffle(THEMES[theme]!)
    .filter((w) => w.length <= SIZE)
    .slice(0, WORDS_PER_PUZZLE)
    .sort((a, b) => b.length - a.length);
  const grid: string[][] = Array.from({ length: SIZE }, () => Array<string>(SIZE).fill(''));
  const placements: Placement[] = [];

  for (const word of words) {
    let placed = false;
    for (let attempt = 0; attempt < 300 && !placed; attempt++) {
      // Favour readable directions (right/down/diagonal) most of the time.
      const [dr, dc] = rng.chance(0.65) ? DIRS[rng.int(0, 3)]! : rng.pick(DIRS);
      const r = rng.int(0, SIZE - 1);
      const c = rng.int(0, SIZE - 1);
      const endR = r + dr * (word.length - 1);
      const endC = c + dc * (word.length - 1);
      if (endR < 0 || endR >= SIZE || endC < 0 || endC >= SIZE) continue;
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const cell = grid[r + dr * i]![c + dc * i]!;
        if (cell !== '' && cell !== word[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let i = 0; i < word.length; i++) grid[r + dr * i]![c + dc * i] = word[i]!;
      placements.push({ word, r, c, dr, dc });
      placed = true;
    }
  }
  for (const row of grid) for (let c = 0; c < SIZE; c++) if (row[c] === '') row[c] = FILLER[rng.int(0, FILLER.length - 1)]!;
  return { theme, grid, placements };
}

export interface Cell {
  r: number;
  c: number;
}

/** Snaps a drag from `a` towards `b` onto one of the 8 straight directions. */
export function lineCells(a: Cell, b: Cell): Cell[] {
  const dr = b.r - a.r;
  const dc = b.c - a.c;
  const len = Math.max(Math.abs(dr), Math.abs(dc));
  if (len === 0) return [a];
  const angle = Math.atan2(dr, dc);
  const oct = Math.round(angle / (Math.PI / 4));
  const sr = Math.round(Math.sin((oct * Math.PI) / 4));
  const sc = Math.round(Math.cos((oct * Math.PI) / 4));
  const out: Cell[] = [];
  for (let i = 0; i <= len; i++) {
    const r = a.r + sr * i;
    const c = a.c + sc * i;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) break;
    out.push({ r, c });
  }
  return out;
}

/** The placement matching the selected cells (either direction), if any. */
export function matchSelection(cells: Cell[], placements: readonly Placement[]): Placement | null {
  for (const p of placements) {
    if (cells.length !== p.word.length) continue;
    const forward = cells.every((cell, i) => cell.r === p.r + p.dr * i && cell.c === p.c + p.dc * i);
    const last = p.word.length - 1;
    const backward = cells.every((cell, i) => cell.r === p.r + p.dr * (last - i) && cell.c === p.c + p.dc * (last - i));
    if (forward || backward) return p;
  }
  return null;
}

export const wordPoints = (word: string) => 50 + word.length * 10;
