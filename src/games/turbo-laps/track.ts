export interface Point {
  x: number;
  y: number;
}

/** Hand-placed control points for the circuit (clockwise). */
const CONTROL: Point[] = [
  { x: 300, y: 820 },
  { x: 650, y: 850 },
  { x: 950, y: 820 },
  { x: 1230, y: 690 },
  { x: 1280, y: 450 },
  { x: 1080, y: 290 },
  { x: 830, y: 380 },
  { x: 640, y: 240 },
  { x: 400, y: 140 },
  { x: 190, y: 290 },
  { x: 170, y: 560 },
];

export const TRACK_WIDTH = 96;
export const LAPS = 3;

function catmull(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** Evenly-ish sampled closed centreline. */
export function buildTrack(samplesPerSegment = 40): Point[] {
  const out: Point[] = [];
  const n = CONTROL.length;
  for (let i = 0; i < n; i++) {
    const p0 = CONTROL[(i - 1 + n) % n]!;
    const p1 = CONTROL[i]!;
    const p2 = CONTROL[(i + 1) % n]!;
    const p3 = CONTROL[(i + 2) % n]!;
    for (let s = 0; s < samplesPerSegment; s++) out.push(catmull(p0, p1, p2, p3, s / samplesPerSegment));
  }
  return out;
}

export function trackLength(points: readonly Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/** Nearest centreline index, searching a window around a previous guess. */
export function nearestIndex(points: readonly Point[], x: number, y: number, guess: number, back = 12, ahead = 40): { index: number; dist: number } {
  const n = points.length;
  let best = guess;
  let bestD = Infinity;
  for (let k = -back; k <= ahead; k++) {
    const i = (((guess + k) % n) + n) % n;
    const p = points[i]!;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { index: best, dist: Math.sqrt(bestD) };
}

/** Heading change (radians) over the next `span` samples — used by AI to brake for corners. */
export function curvatureAhead(points: readonly Point[], index: number, span = 18): number {
  const n = points.length;
  const a = points[index % n]!;
  const b = points[(index + Math.floor(span / 2)) % n]!;
  const c = points[(index + span) % n]!;
  const h1 = Math.atan2(b.y - a.y, b.x - a.x);
  const h2 = Math.atan2(c.y - b.y, c.x - b.x);
  let d = h2 - h1;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}
