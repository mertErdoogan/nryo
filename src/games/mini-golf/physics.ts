import type { Rect } from '../../lib/math';

export const BALL_R = 8;
export const CUP_R = 11;
export const MAX_SPEED = 760;

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Circle vs rect bounce. `mvx/mvy` is the rect's own velocity (moving blockers). */
export function bounceRect(b: BallState, r: Rect, restitution = 0.78, mvx = 0, mvy = 0): boolean {
  const nx = Math.max(r.x, Math.min(b.x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(b.y, r.y + r.h));
  const dx = b.x - nx;
  const dy = b.y - ny;
  const d = Math.hypot(dx, dy);
  let ux = 0;
  let uy = 0;
  if (d > 0) {
    if (d >= BALL_R) return false;
    ux = dx / d;
    uy = dy / d;
    b.x = nx + ux * BALL_R;
    b.y = ny + uy * BALL_R;
  } else {
    // Centre inside the rect (e.g. a blocker moved onto the ball): exit via the nearest side.
    const left = b.x - r.x;
    const right = r.x + r.w - b.x;
    const top = b.y - r.y;
    const bottom = r.y + r.h - b.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) {
      ux = -1;
      b.x = r.x - BALL_R;
    } else if (m === right) {
      ux = 1;
      b.x = r.x + r.w + BALL_R;
    } else if (m === top) {
      uy = -1;
      b.y = r.y - BALL_R;
    } else {
      uy = 1;
      b.y = r.y + r.h + BALL_R;
    }
  }
  const rvx = b.vx - mvx;
  const rvy = b.vy - mvy;
  const dot = rvx * ux + rvy * uy;
  if (dot < 0) {
    b.vx -= (1 + restitution) * dot * ux;
    b.vy -= (1 + restitution) * dot * uy;
  }
  return true;
}

export function bounceCircle(b: BallState, cx: number, cy: number, cr: number, restitution = 1.05): boolean {
  const dx = b.x - cx;
  const dy = b.y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= cr + BALL_R || d === 0) return false;
  const ux = dx / d;
  const uy = dy / d;
  b.x = cx + ux * (cr + BALL_R);
  b.y = cy + uy * (cr + BALL_R);
  const dot = b.vx * ux + b.vy * uy;
  if (dot < 0) {
    b.vx -= (1 + restitution) * dot * ux;
    b.vy -= (1 + restitution) * dot * uy;
  }
  return true;
}

export const inRect = (x: number, y: number, r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Rolling friction: exponential drag plus a constant stop force. */
export function applyFriction(b: BallState, dt: number, sand: boolean): void {
  const speed = Math.hypot(b.vx, b.vy);
  if (speed === 0) return;
  const drag = sand ? 3.2 : 0.9;
  const stop = sand ? 220 : 45;
  const next = Math.max(0, speed * Math.exp(-drag * dt) - stop * dt);
  b.vx = (b.vx / speed) * next;
  b.vy = (b.vy / speed) * next;
}

/** Ball drops in when slow enough over the cup; fast balls lip out. */
export function checkCup(b: BallState, cx: number, cy: number): 'in' | 'lip' | null {
  const d = Math.hypot(b.x - cx, b.y - cy);
  if (d > CUP_R) return null;
  const speed = Math.hypot(b.vx, b.vy);
  return speed < 280 ? 'in' : 'lip';
}
