export const N = 8;
export type Cell = 0 | 1 | 2; // 0 empty, 1 player (black), 2 AI (white)
export type Board = Cell[];

const DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

export function initialBoard(): Board {
  const b: Board = Array<Cell>(N * N).fill(0);
  b[27] = 2;
  b[28] = 1;
  b[35] = 1;
  b[36] = 2;
  return b;
}

/** Discs flipped by placing `who` at index `i` (empty if illegal). */
export function flipsFor(b: Board, i: number, who: Cell): number[] {
  if (b[i] !== 0) return [];
  const other = who === 1 ? 2 : 1;
  const r0 = Math.floor(i / N);
  const c0 = i % N;
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === other) {
      line.push(r * N + c);
      r += dr;
      c += dc;
    }
    if (line.length && r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === who) out.push(...line);
  }
  return out;
}

export function legalMoves(b: Board, who: Cell): number[] {
  const out: number[] = [];
  for (let i = 0; i < N * N; i++) if (flipsFor(b, i, who).length) out.push(i);
  return out;
}

export function apply(b: Board, i: number, who: Cell): Board {
  const next = b.slice();
  next[i] = who;
  for (const f of flipsFor(b, i, who)) next[f] = who;
  return next;
}

export const count = (b: Board, who: Cell) => b.filter((v) => v === who).length;

// Classic positional weights: corners great, squares next to corners dangerous.
const WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];

export function evaluate(b: Board, who: Cell): number {
  const other = who === 1 ? 2 : 1;
  const empties = b.filter((v) => v === 0).length;
  if (empties === 0) return (count(b, who) - count(b, other)) * 1000;
  let pos = 0;
  for (let i = 0; i < N * N; i++) pos += b[i] === who ? WEIGHTS[i]! : b[i] === other ? -WEIGHTS[i]! : 0;
  const mobility = legalMoves(b, who).length - legalMoves(b, other).length;
  const discs = count(b, who) - count(b, other);
  return pos + mobility * 8 + (empties < 16 ? discs * 6 : 0);
}

function search(b: Board, depth: number, alpha: number, beta: number, who: Cell, passed: boolean): number {
  const other: Cell = who === 1 ? 2 : 1;
  if (depth === 0) return evaluate(b, who);
  const moves = legalMoves(b, who);
  if (moves.length === 0) {
    if (passed) return evaluate(b, who);
    return -search(b, depth - 1, -beta, -alpha, other, true);
  }
  moves.sort((a, z) => WEIGHTS[z]! - WEIGHTS[a]!);
  let best = -Infinity;
  for (const m of moves) {
    const score = -search(apply(b, m, who), depth - 1, -beta, -alpha, other, false);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function bestMove(b: Board, depth: number, random: () => number, blunder = 0): number | null {
  const moves = legalMoves(b, 2);
  if (moves.length === 0) return null;
  if (random() < blunder) return moves[Math.floor(random() * moves.length)]!;
  let best = moves[0]!;
  let bestScore = -Infinity;
  for (const m of moves) {
    const score = -search(apply(b, m, 2), depth - 1, -Infinity, Infinity, 1, false) + random() * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export const LEVELS = [
  { name: 'Novice', depth: 1, blunder: 0.3, points: 400 },
  { name: 'Tactician', depth: 2, blunder: 0.05, points: 700 },
  { name: 'Strategist', depth: 4, blunder: 0, points: 1100 },
  { name: 'Master', depth: 5, blunder: 0, points: 1600 },
];
