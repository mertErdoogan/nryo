import type { Rng } from '../../lib/rng';

export interface Tile {
  id: number;
  x: number; // half-cell units
  y: number;
  layer: number;
  type: number;
  state: 'board' | 'tray' | 'gone';
}

export const COLS = 12; // half-cells across (6 full tiles)
export const ROWS = 14; // half-cells down (7 full tiles)

export const overlaps = (a: Tile, b: Tile) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

export function isFree(t: Tile, tiles: readonly Tile[]): boolean {
  if (t.state !== 'board') return false;
  return !tiles.some((o) => o !== t && o.state === 'board' && o.layer > t.layer && overlaps(o, t));
}

export function levelSpec(level: number) {
  const types = Math.min(14, 4 + level);
  const sets = Math.min(3, 1 + Math.floor(level / 3));
  return { types, sets, total: types * sets * 3 };
}

/**
 * Builds a layered board. Types are assigned along a random "free removal"
 * order in groups of three, so a perfect pick order always exists.
 */
export function generate(level: number, rng: Rng): Tile[] {
  const { types, total } = levelSpec(level);
  const positions: { x: number; y: number; layer: number }[] = [];
  for (let layer = 0; positions.length < total && layer < 8; layer++) {
    const off = layer % 2;
    const inset = Math.floor(layer / 2) * 2;
    const layerPos: { x: number; y: number; layer: number }[] = [];
    for (let y = off + inset; y <= ROWS - 2 - inset; y += 2)
      for (let x = off + inset; x <= COLS - 2 - inset; x += 2) layerPos.push({ x, y, layer });
    // keep a symmetric-ish random subset
    const cx = (COLS - 2) / 2;
    const cy = (ROWS - 2) / 2;
    const want = Math.min(layerPos.length, Math.max(4, Math.round(layerPos.length * rng.range(0.55, 0.85))));
    const keep = layerPos
      .map((p) => ({ p, d: Math.abs(p.x - cx) * 0.8 + Math.abs(p.y - cy) + rng.range(0, 3) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, want)
      .map((e) => e.p);
    const layerCap = layer === 0 ? Math.ceil(total * 0.6) : total;
    for (const p of keep) {
      if (positions.length >= Math.min(total, layerCap)) break;
      positions.push(p);
    }
  }
  while (positions.length < total)
    positions.push({ x: rng.int(0, COLS - 2), y: rng.int(0, ROWS - 2), layer: 8 + positions.length });
  const tiles: Tile[] = positions.map((p, i) => ({ id: i, ...p, type: -1, state: 'board' }));
  // removal order
  const order: Tile[] = [];
  const work = tiles.map((t) => ({ ...t }));
  while (order.length < work.length) {
    const free = work.filter((t) => t.state === 'board' && isFree(t, work));
    const pick = rng.pick(free);
    pick.state = 'gone';
    order.push(pick);
  }
  const typeOrder = rng.shuffle(Array.from({ length: types }, (_, i) => i));
  order.forEach((t, i) => {
    tiles[t.id]!.type = typeOrder[Math.floor(i / 3) % types]!;
  });
  return tiles;
}

/** Inserts a tile into the tray next to its twins. Returns the new tray. */
export function insertIntoTray(tray: readonly Tile[], tile: Tile): Tile[] {
  const out = tray.slice();
  let idx = out.length;
  for (let i = out.length - 1; i >= 0; i--)
    if (out[i]!.type === tile.type) {
      idx = i + 1;
      break;
    }
  out.splice(idx, 0, tile);
  return out;
}

/** Removes the first complete triple from the tray, if any. */
export function clearTriples(tray: readonly Tile[]): { tray: Tile[]; cleared: Tile[] } {
  const counts = new Map<number, number>();
  for (const t of tray) counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
  for (const [type, n] of counts)
    if (n >= 3) {
      const cleared: Tile[] = [];
      const rest: Tile[] = [];
      for (const t of tray) {
        if (t.type === type && cleared.length < 3) cleared.push(t);
        else rest.push(t);
      }
      return { tray: rest, cleared };
    }
  return { tray: tray.slice(), cleared: [] };
}
