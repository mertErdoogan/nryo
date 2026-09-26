import { circleRect } from '../../lib/math';

export const GRAVITY = 1500;
export const FLAP_VELOCITY = -430;

/** Gap size shrinks from 180 to 128 as the score climbs. */
export const gapForScore = (score: number) => Math.max(128, 180 - score * 1.3);
/** Scroll speed ramps from 150 to 240 px/s. */
export const speedForScore = (score: number) => Math.min(240, 150 + score * 2.2);

export interface Pillar {
  x: number;
  gapY: number;
  gap: number;
  passed: boolean;
}

/** Circle-vs-pillar collision: shafts plus the wider caps at the gap edges. */
export function hitsPillar(
  bx: number,
  by: number,
  r: number,
  p: Pillar,
  width: number,
  floorY: number,
): boolean {
  const top = p.gapY - p.gap / 2;
  const bottom = p.gapY + p.gap / 2;
  const rects = [
    { x: p.x, y: -1000, w: width, h: top + 1000 },
    { x: p.x - 5, y: top - 22, w: width + 10, h: 22 },
    { x: p.x, y: bottom, w: width, h: floorY - bottom },
    { x: p.x - 5, y: bottom, w: width + 10, h: 22 },
  ];
  return rects.some((rect) => circleRect(bx, by, r, rect));
}
