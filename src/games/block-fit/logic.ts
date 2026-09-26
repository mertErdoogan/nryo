import type { Rng } from '../../lib/rng';

export const SIZE = 8;
export type Cells = [number, number][];

export interface PieceDef {
  cells: Cells;
  color: number;
  weight: number;
}

const rot = (cells: Cells): Cells => {
  const maxR = Math.max(...cells.map(([r]) => r));
  return cells.map(([r, c]) => [c, maxR - r]);
};
const rotations = (cells: Cells, n: number): Cells[] => {
  const out: Cells[] = [cells];
  for (let i = 1; i < n; i++) out.push(rot(out[i - 1]!));
  return out;
};

const L3: Cells = [
  [0, 0],
  [1, 0],
  [1, 1],
];
const BIG_L: Cells = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
  [2, 2],
];
const T4: Cells = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 1],
];
const S4: Cells = [
  [0, 1],
  [0, 2],
  [1, 0],
  [1, 1],
];
const L4: Cells = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
];

export const PIECES: PieceDef[] = [
  { cells: [[0, 0]], color: 0, weight: 3 },
  {
    cells: [
      [0, 0],
      [0, 1],
    ],
    color: 1,
    weight: 4,
  },
  {
    cells: [
      [0, 0],
      [1, 0],
    ],
    color: 1,
    weight: 4,
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    color: 2,
    weight: 4,
  },
  {
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    color: 2,
    weight: 4,
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    color: 3,
    weight: 3,
  },
  {
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    color: 3,
    weight: 3,
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
    color: 4,
    weight: 1.5,
  },
  {
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ],
    color: 4,
    weight: 1.5,
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    color: 5,
    weight: 4,
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    color: 6,
    weight: 1.2,
  },
  ...rotations(L3, 4).map((cells) => ({ cells, color: 7, weight: 2.5 })),
  ...rotations(BIG_L, 4).map((cells) => ({ cells, color: 8, weight: 1 })),
  ...rotations(T4, 4).map((cells) => ({ cells, color: 9, weight: 1.2 })),
  ...rotations(S4, 2).map((cells) => ({ cells, color: 10, weight: 1 })),
  ...rotations(L4, 4).map((cells) => ({ cells, color: 11, weight: 1 })),
];

export function randomPiece(rng: Rng): number {
  const total = PIECES.reduce((s, p) => s + p.weight, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < PIECES.length; i++) {
    roll -= PIECES[i]!.weight;
    if (roll <= 0) return i;
  }
  return 0;
}

export type Board = number[][]; // -1 empty, otherwise colour index

export const emptyBoard = (): Board => Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(-1));

export function fits(board: Board, piece: number, r: number, c: number): boolean {
  return PIECES[piece]!.cells.every(([dr, dc]) => {
    const rr = r + dr;
    const cc = c + dc;
    return rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && board[rr]![cc] === -1;
  });
}

export function fitsAnywhere(board: Board, piece: number): boolean {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (fits(board, piece, r, c)) return true;
  return false;
}

export interface PlaceResult {
  board: Board;
  rows: number[];
  cols: number[];
  cleared: number;
}

export function place(board: Board, piece: number, r: number, c: number): PlaceResult {
  const def = PIECES[piece]!;
  const b = board.map((row) => row.slice());
  for (const [dr, dc] of def.cells) b[r + dr]![c + dc] = def.color;
  const rows = [...Array(SIZE).keys()].filter((y) => b[y]!.every((v) => v >= 0));
  const cols = [...Array(SIZE).keys()].filter((x) => b.every((row) => row[x]! >= 0));
  const clearedCells = new Set<number>();
  for (const y of rows) for (let x = 0; x < SIZE; x++) clearedCells.add(y * SIZE + x);
  for (const x of cols) for (let y = 0; y < SIZE; y++) clearedCells.add(y * SIZE + x);
  for (const k of clearedCells) b[Math.floor(k / SIZE)]![k % SIZE] = -1;
  return { board: b, rows, cols, cleared: clearedCells.size };
}

/** Points: 1 per placed cell, lines scale quadratically, streaks add 25% each. */
export function placePoints(cells: number, lines: number, streak: number): number {
  if (lines === 0) return cells;
  return cells + Math.round(80 * lines * lines * (1 + 0.25 * Math.max(0, streak - 1)));
}
