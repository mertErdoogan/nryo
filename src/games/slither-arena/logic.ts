export interface Point {
  x: number;
  y: number;
}

export const SPACING = 7;

export const radiusFor = (mass: number) => 7 + Math.min(12, mass / 30);
export const segmentsFor = (mass: number) => Math.max(6, Math.floor(10 + mass * 0.9));

/** Moves each body point toward the one ahead so the chain keeps its spacing. */
export function followChain(body: Point[], spacing: number): void {
  for (let i = 1; i < body.length; i++) {
    const a = body[i - 1]!;
    const b = body[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d > spacing) {
      b.x = a.x + (dx / d) * spacing;
      b.y = a.y + (dy / d) * spacing;
    }
  }
}

/** Grows or shrinks a chain to `count` points (new points trail the tail). */
export function resizeChain(body: Point[], count: number): void {
  while (body.length < count) {
    const tail = body[body.length - 1]!;
    body.push({ x: tail.x, y: tail.y });
  }
  if (body.length > count) body.length = Math.max(2, count);
}

/** True when a head circle overlaps any body point of another snake. */
export function headHitsBody(
  head: Point,
  headR: number,
  body: readonly Point[],
  bodyR: number,
  skip = 0,
): boolean {
  const lim = (headR * 0.6 + bodyR) ** 2;
  for (let i = skip; i < body.length; i += 1) {
    const p = body[i]!;
    const dx = p.x - head.x;
    const dy = p.y - head.y;
    if (dx * dx + dy * dy < lim) return true;
  }
  return false;
}
