import type { Rng } from '../../lib/rng';

export const COLS = 10;
export const ROWS = 22; // top 2 rows are hidden spawn space
export const VISIBLE = 20;

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export const TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

const SHAPES: Record<PieceType, [number, number][]> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
const BOX: Record<PieceType, number> = { I: 4, O: 4, T: 3, S: 3, Z: 3, J: 3, L: 3 };

export const COLORS: Record<PieceType, string> = {
  I: '#22d3ee',
  O: '#facc15',
  T: '#a855f7',
  S: '#22c55e',
  Z: '#ef4444',
  J: '#3b82f6',
  L: '#f97316',
};

export interface Piece {
  type: PieceType;
  x: number;
  y: number;
  rot: number;
}

export type Board = (PieceType | null)[][];

export const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array<PieceType | null>(COLS).fill(null));

export function cells(p: Piece): [number, number][] {
  const n = BOX[p.type];
  return SHAPES[p.type].map(([x, y]) => {
    let cx = x;
    let cy = y;
    if (p.type !== 'O') {
      for (let i = 0; i < ((p.rot % 4) + 4) % 4; i++) {
        const t = cx;
        cx = n - 1 - cy;
        cy = t;
      }
    }
    return [p.x + cx, p.y + cy];
  });
}

export function fits(b: Board, p: Piece): boolean {
  return cells(p).every(([x, y]) => x >= 0 && x < COLS && y < ROWS && (y < 0 || b[y]![x] === null));
}

const KICKS: [number, number][] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [-2, 0],
  [2, 0],
  [-1, -1],
  [1, -1],
];

/** Rotates with simple wall kicks. Returns the new piece or null if blocked. */
export function rotate(b: Board, p: Piece, dir: 1 | -1): Piece | null {
  for (const [dx, dy] of KICKS) {
    const next = { ...p, rot: p.rot + dir, x: p.x + dx, y: p.y + dy };
    if (fits(b, next)) return next;
  }
  return null;
}

export function spawn(type: PieceType): Piece {
  return { type, x: type === 'O' ? 3 : 3, y: type === 'I' ? 0 : 0, rot: 0 };
}

/** 7-bag randomiser: every piece once per bag. */
export function bag(rng: Rng): PieceType[] {
  return rng.shuffle(TYPES);
}

export function lock(b: Board, p: Piece): { board: Board; cleared: number[] } {
  const next = b.map((row) => row.slice());
  for (const [x, y] of cells(p)) if (y >= 0) next[y]![x] = p.type;
  const cleared: number[] = [];
  for (let y = 0; y < ROWS; y++) if (next[y]!.every((c) => c !== null)) cleared.push(y);
  return { board: next, cleared };
}

export function removeRows(b: Board, rows: number[]): Board {
  const keep = b.filter((_, y) => !rows.includes(y));
  while (keep.length < ROWS) keep.unshift(Array<PieceType | null>(COLS).fill(null));
  return keep;
}

export function dropDistance(b: Board, p: Piece): number {
  let d = 0;
  while (fits(b, { ...p, y: p.y + d + 1 })) d++;
  return d;
}

export const LINE_POINTS = [0, 100, 300, 500, 800];
export const gravityFor = (level: number) => Math.max(0.05, 0.8 * Math.pow(0.82, level - 1));
