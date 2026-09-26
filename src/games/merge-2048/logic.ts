import type { Rng } from '../../lib/rng';

export const SIZE = 4;
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Tile {
  id: number;
  value: number;
  r: number;
  c: number;
  /** Just produced by a merge (for the bump animation). */
  merged?: boolean;
  isNew?: boolean;
}

export interface MoveResult {
  tiles: Tile[];
  /** Tiles consumed by merges; they slide into place then vanish. */
  ghosts: Tile[];
  moved: boolean;
  gained: number;
}

let idCounter = 1;
export const nextId = () => idCounter++;

function lineCoords(dir: Dir, line: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < SIZE; i++) {
    if (dir === 'left') out.push([line, i]);
    else if (dir === 'right') out.push([line, SIZE - 1 - i]);
    else if (dir === 'up') out.push([i, line]);
    else out.push([SIZE - 1 - i, line]);
  }
  return out;
}

export function move(tiles: readonly Tile[], dir: Dir): MoveResult {
  const grid = new Map<string, Tile>();
  for (const t of tiles) grid.set(`${t.r},${t.c}`, t);
  const out: Tile[] = [];
  const ghosts: Tile[] = [];
  let moved = false;
  let gained = 0;

  for (let line = 0; line < SIZE; line++) {
    const coords = lineCoords(dir, line);
    const inLine = coords.map(([r, c]) => grid.get(`${r},${c}`)).filter((t): t is Tile => !!t);
    let slot = 0;
    for (let i = 0; i < inLine.length; i++) {
      const cur = inLine[i]!;
      const next = inLine[i + 1];
      const [r, c] = coords[slot]!;
      if (next && next.value === cur.value) {
        const value = cur.value * 2;
        out.push({ id: cur.id, value, r, c, merged: true });
        ghosts.push({ ...next, r, c });
        gained += value;
        moved = true;
        i++;
      } else {
        if (cur.r !== r || cur.c !== c) moved = true;
        out.push({ id: cur.id, value: cur.value, r, c });
      }
      slot++;
    }
  }
  return { tiles: moved ? out : tiles.map((t) => ({ ...t, merged: false, isNew: false })), ghosts, moved, gained };
}

export function emptyCells(tiles: readonly Tile[]): [number, number][] {
  const taken = new Set(tiles.map((t) => `${t.r},${t.c}`));
  const out: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!taken.has(`${r},${c}`)) out.push([r, c]);
  return out;
}

export function spawn(tiles: readonly Tile[], rng: Rng): Tile[] {
  const empty = emptyCells(tiles);
  if (empty.length === 0) return [...tiles];
  const [r, c] = rng.pick(empty);
  return [...tiles, { id: nextId(), value: rng.chance(0.9) ? 2 : 4, r, c, isNew: true }];
}

export function canMove(tiles: readonly Tile[]): boolean {
  if (tiles.length < SIZE * SIZE) return true;
  const grid = new Map(tiles.map((t) => [`${t.r},${t.c}`, t.value]));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid.get(`${r},${c}`);
      if (v === grid.get(`${r + 1},${c}`) || v === grid.get(`${r},${c + 1}`)) return true;
    }
  }
  return false;
}

export const maxTile = (tiles: readonly Tile[]) => tiles.reduce((m, t) => Math.max(m, t.value), 0);
