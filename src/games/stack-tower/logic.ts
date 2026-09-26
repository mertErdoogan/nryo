export interface Slab {
  x: number;
  w: number;
}

export type DropResult =
  { kind: 'miss' } | { kind: 'perfect'; placed: Slab } | { kind: 'cut'; placed: Slab; debris: Slab };

/** Resolve dropping `moving` onto `top`. Perfect within `tolerance` snaps to the block below. */
export function resolveDrop(top: Slab, moving: Slab, tolerance: number): DropResult {
  const left = Math.max(top.x, moving.x);
  const right = Math.min(top.x + top.w, moving.x + moving.w);
  if (right - left <= 0) return { kind: 'miss' };
  if (Math.abs(moving.x - top.x) <= tolerance && Math.abs(moving.w - top.w) <= tolerance) {
    return { kind: 'perfect', placed: { x: top.x, w: top.w } };
  }
  const placed = { x: left, w: right - left };
  const debris =
    moving.x < top.x ? { x: moving.x, w: top.x - moving.x } : { x: right, w: moving.x + moving.w - right };
  return { kind: 'cut', placed, debris };
}

/** Horizontal speed (logical px/s) for a given tower height. */
export const speedForLevel = (level: number) => Math.min(380, 140 + level * 6);
