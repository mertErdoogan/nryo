import type { Rng } from '../../lib/rng';

export const COLS = 8;
export const BRICK_W = 38;
export const BRICK_H = 16;
export const GAP = 4;
export const LEFT = 14;
export const TOP = 70;

export interface Brick {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Steel bricks cannot be destroyed. */
  steel: boolean;
}

type Pattern = (r: number, c: number, rows: number) => boolean;

const PATTERNS: Pattern[] = [
  () => true,
  (r, c) => (r + c) % 2 === 0,
  (r, c, rows) => Math.abs(c - 3.5) <= (r / rows) * 4 + 0.5,
  (r, c, rows) => Math.abs(c - 3.5) + Math.abs(r - (rows - 1) / 2) <= 4,
  (r, c) => c !== 3 && c !== 4 ? true : r % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 !== 1,
];

export function buildLevel(level: number, rng: Rng): Brick[] {
  const rows = Math.min(8, 4 + Math.floor(level / 2));
  const pattern = level === 1 ? PATTERNS[0]! : rng.pick(PATTERNS);
  const bricks: Brick[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!pattern(r, c, rows)) continue;
      const steel = level >= 4 && r === rows - 1 && (c === 1 || c === 6) && rng.chance(0.7);
      const hp = steel ? 1 : Math.max(1, Math.min(3, 1 + Math.floor((rows - r - 1 + level - 1) / 4) - (rng.chance(0.3) ? 1 : 0)));
      bricks.push({ x: LEFT + c * (BRICK_W + GAP), y: TOP + r * (BRICK_H + GAP), hp, maxHp: hp, steel });
    }
  }
  return bricks;
}

/** Paddle bounce: angle depends on where the ball hits (−1 left edge … 1 right edge). */
export function paddleBounce(offset: number, speed: number): { vx: number; vy: number } {
  const angle = Math.max(-1, Math.min(1, offset)) * (Math.PI / 3);
  return { vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed };
}

/** Resolves a circle/rect overlap: returns which axis to reflect, or null when not touching. */
export function collideCircleRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): 'x' | 'y' | null {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  if (dx * dx + dy * dy > r * r) return null;
  const overlapX = Math.min(cx + r - rx, rx + rw - (cx - r));
  const overlapY = Math.min(cy + r - ry, ry + rh - (cy - r));
  return overlapX < overlapY ? 'x' : 'y';
}
