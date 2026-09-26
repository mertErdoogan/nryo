export const GRAVITY = 1250;
export const BALL_R = 16;
export const RIM_HALF = 30;
export const RIM_R = 4;

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Reflects the ball off a fixed circle (rim edge). Returns true on contact. */
export function bounceOffPoint(b: Ball, px: number, py: number, pr: number, restitution: number): boolean {
  const dx = b.x - px;
  const dy = b.y - py;
  const d = Math.hypot(dx, dy);
  const min = BALL_R + pr;
  if (d >= min || d === 0) return false;
  const nx = dx / d;
  const ny = dy / d;
  b.x = px + nx * min;
  b.y = py + ny * min;
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) {
    b.vx -= (1 + restitution) * dot * nx;
    b.vy -= (1 + restitution) * dot * ny;
  }
  return true;
}

/** Launch velocity from a drag vector (pull back to shoot forward). */
export function launchVelocity(dx: number, dy: number): { vx: number; vy: number } {
  const power = 5.6;
  let vx = -dx * power;
  let vy = -dy * power;
  const speed = Math.hypot(vx, vy);
  const max = 1150;
  if (speed > max) {
    vx = (vx / speed) * max;
    vy = (vy / speed) * max;
  }
  return { vx, vy };
}

/** Points for a basket given swish and streak. */
export function basketPoints(swish: boolean, streak: number): number {
  const mult = streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
  return (2 + (swish ? 1 : 0)) * mult;
}
