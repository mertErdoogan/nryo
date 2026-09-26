export const COLS = 7;
export const ROWS = 6;
export type Cell = 0 | 1 | 2; // 0 empty, 1 player, 2 AI
/** board[c][r] with r = 0 at the bottom. */
export type Board = Cell[][];

export const emptyBoard = (): Board => Array.from({ length: COLS }, () => Array<Cell>(ROWS).fill(0));
export const heightOf = (b: Board, c: number) => b[c]!.findIndex((v) => v === 0);
export const canPlay = (b: Board, c: number) => b[c]![ROWS - 1] === 0;
export const validMoves = (b: Board) => [3, 2, 4, 1, 5, 0, 6].filter((c) => canPlay(b, c));

export function play(b: Board, c: number, who: Cell): number {
  const r = heightOf(b, c);
  b[c]![r] = who;
  return r;
}

const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** Winning line through (c, r), or null. */
export function winningLine(b: Board, c: number, r: number): [number, number][] | null {
  const who = b[c]![r];
  if (!who) return null;
  for (const [dc, dr] of DIRS) {
    const line: [number, number][] = [[c, r]];
    for (const sign of [1, -1]) {
      let x = c + dc * sign;
      let y = r + dr * sign;
      while (x >= 0 && x < COLS && y >= 0 && y < ROWS && b[x]![y] === who) {
        line.push([x, y]);
        x += dc * sign;
        y += dr * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

function windowScore(cells: Cell[], who: Cell): number {
  const mine = cells.filter((v) => v === who).length;
  const theirs = cells.filter((v) => v !== 0 && v !== who).length;
  if (mine && theirs) return 0;
  if (mine === 3) return 5;
  if (mine === 2) return 2;
  if (theirs === 3) return -4;
  if (theirs === 2) return -1;
  return 0;
}

/** Static evaluation from `who`'s perspective. */
export function evaluate(b: Board, who: Cell): number {
  let score = 0;
  for (let r = 0; r < ROWS; r++) score += (b[3]![r] === who ? 3 : b[3]![r] ? -3 : 0);
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      for (const [dc, dr] of DIRS) {
        const ec = c + dc * 3;
        const er = r + dr * 3;
        if (ec < 0 || ec >= COLS || er < 0 || er >= ROWS) continue;
        score += windowScore([b[c]![r]!, b[c + dc]![r + dr]!, b[c + dc * 2]![r + dr * 2]!, b[ec]![er]!], who);
      }
    }
  }
  return score;
}

/** Negamax with alpha-beta pruning. */
function negamax(b: Board, depth: number, alpha: number, beta: number, who: Cell, moves: number): number {
  const other: Cell = who === 1 ? 2 : 1;
  const options = validMoves(b);
  if (options.length === 0) return 0;
  // Immediate win?
  for (const c of options) {
    const r = play(b, c, who);
    const win = winningLine(b, c, r);
    b[c]![r] = 0;
    if (win) return 10_000 - moves;
  }
  if (depth === 0) return evaluate(b, who);
  let best = -Infinity;
  for (const c of options) {
    const r = play(b, c, who);
    const score = -negamax(b, depth - 1, -beta, -alpha, other, moves + 1);
    b[c]![r] = 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function bestMove(b: Board, depth: number, random: () => number, blunder = 0): number {
  const options = validMoves(b);
  if (random() < blunder) return options[Math.floor(random() * options.length)]!;
  let best = options[0]!;
  let bestScore = -Infinity;
  const board = b.map((col) => col.slice()) as Board;
  for (const c of options) {
    const r = play(board, c, 2);
    const win = winningLine(board, c, r);
    const score = win ? 100_000 : -negamax(board, depth - 1, -Infinity, Infinity, 1, 1) + (random() - 0.5) * 0.5;
    board[c]![r] = 0;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export const LEVELS = [
  { name: 'Rookie', depth: 2, blunder: 0.25, points: 300 },
  { name: 'Clever', depth: 4, blunder: 0.05, points: 600 },
  { name: 'Sharp', depth: 6, blunder: 0, points: 1000 },
  { name: 'Grandmaster', depth: 7, blunder: 0, points: 1600 },
];
