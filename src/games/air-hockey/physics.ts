export interface Disc {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/** Puck vs mallet: resolves overlap and transfers the mallet's momentum. */
export function strike(puck: Disc, mallet: Disc, maxSpeed: number): boolean {
  const dx = puck.x - mallet.x;
  const dy = puck.y - mallet.y;
  const d = Math.hypot(dx, dy);
  const min = puck.r + mallet.r;
  if (d >= min || d === 0) return false;
  const nx = dx / d;
  const ny = dy / d;
  puck.x = mallet.x + nx * min;
  puck.y = mallet.y + ny * min;
  const rvx = puck.vx - mallet.vx;
  const rvy = puck.vy - mallet.vy;
  const dot = rvx * nx + rvy * ny;
  if (dot < 0) {
    puck.vx -= 1.9 * dot * nx;
    puck.vy -= 1.9 * dot * ny;
  }
  // Always leave with at least a little push away from the mallet.
  const away = puck.vx * nx + puck.vy * ny;
  if (away < 120) {
    puck.vx += nx * (120 - away);
    puck.vy += ny * (120 - away);
  }
  const speed = Math.hypot(puck.vx, puck.vy);
  if (speed > maxSpeed) {
    puck.vx = (puck.vx / speed) * maxSpeed;
    puck.vy = (puck.vy / speed) * maxSpeed;
  }
  return true;
}

/** AI speed and reaction for a ladder level (1-based). */
export const aiSkill = (level: number) => ({
  speed: Math.min(720, 300 + level * 70),
  aggression: Math.min(0.95, 0.45 + level * 0.1),
});
