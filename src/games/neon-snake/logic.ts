import type { Rng } from '../../lib/rng';

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Cell {
  x: number;
  y: number;
}

export const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const isOpposite = (a: Dir, b: Dir) => DELTA[a].x + DELTA[b].x === 0 && DELTA[a].y + DELTA[b].y === 0;

/** Seconds per step: starts relaxed, speeds up as the snake grows. */
export const stepTime = (length: number) => Math.max(0.055, 0.14 - (length - 3) * 0.0022);

export function nextHead(head: Cell, dir: Dir): Cell {
  return { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
}

/** Collision against walls and the body (the tail tip moves away unless growing). */
export function collides(head: Cell, body: readonly Cell[], cols: number, rows: number, growing: boolean): boolean {
  if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows) return true;
  const check = growing ? body : body.slice(0, -1);
  return check.some((c) => c.x === head.x && c.y === head.y);
}

export function freeCell(cols: number, rows: number, taken: readonly Cell[], rng: Rng): Cell | null {
  const occupied = new Set(taken.map((c) => c.y * cols + c.x));
  const free: number[] = [];
  for (let i = 0; i < cols * rows; i++) if (!occupied.has(i)) free.push(i);
  if (free.length === 0) return null;
  const i = rng.pick(free);
  return { x: i % cols, y: Math.floor(i / cols) };
}

/** Queue a turn, ignoring reversals and duplicates (max two buffered turns). */
export function queueTurn(queue: Dir[], current: Dir, dir: Dir): Dir[] {
  const last = queue[queue.length - 1] ?? current;
  if (dir === last || isOpposite(dir, last) || queue.length >= 2) return queue;
  return [...queue, dir];
}
