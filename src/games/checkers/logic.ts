/** American checkers (8×8, forced captures, multi-jumps, kings) with a minimax AI. */

export type Board = number[]; // 64 cells: 0 empty, 1 player man, 2 player king, -1 AI man, -2 AI king
export interface Move {
  from: number;
  path: number[]; // squares visited after `from`
  captures: number[];
}

export const idx = (r: number, c: number) => r * 8 + c;
export const rc = (i: number): [number, number] => [Math.floor(i / 8), i % 8];
export const isDark = (i: number) => {
  const [r, c] = rc(i);
  return (r + c) % 2 === 1;
};

export function initialBoard(): Board {
  const b: Board = Array(64).fill(0);
  for (let i = 0; i < 64; i++) {
    if (!isDark(i)) continue;
    const r = Math.floor(i / 8);
    if (r < 3) b[i] = -1;
    else if (r > 4) b[i] = 1;
  }
  return b;
}

const side = (p: number) => Math.sign(p);
const dirsFor = (p: number): [number, number][] =>
  Math.abs(p) === 2
    ? [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]
    : p > 0
      ? [
          [-1, -1],
          [-1, 1],
        ]
      : [
          [1, -1],
          [1, 1],
        ];
const inB = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const kingRow = (p: number) => (p > 0 ? 0 : 7);

function jumps(
  b: Board,
  from: number,
  piece: number,
  taken: number[],
  visited: number[],
  out: Move[],
  start: number,
) {
  const [r, c] = rc(from);
  let extended = false;
  for (const [dr, dc] of dirsFor(piece)) {
    const mr = r + dr;
    const mc = c + dc;
    const lr = r + 2 * dr;
    const lc = c + 2 * dc;
    if (!inB(lr, lc)) continue;
    const mid = idx(mr, mc);
    const land = idx(lr, lc);
    if (side(b[mid]!) !== -side(piece) || taken.includes(mid)) continue;
    if (b[land] !== 0 && land !== start) continue;
    extended = true;
    const promotes = Math.abs(piece) === 1 && lr === kingRow(piece);
    if (promotes) out.push({ from: start, path: [...visited, land], captures: [...taken, mid] });
    else jumps(b, land, piece, [...taken, mid], [...visited, land], out, start);
  }
  if (!extended && taken.length > 0) out.push({ from: start, path: visited, captures: taken });
}

export function legalMoves(b: Board, who: 1 | -1): Move[] {
  const caps: Move[] = [];
  const quiet: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i]!;
    if (side(p) !== who) continue;
    jumps(b, i, p, [], [], caps, i);
    if (caps.length) continue;
    const [r, c] = rc(i);
    for (const [dr, dc] of dirsFor(p)) {
      const nr = r + dr;
      const nc = c + dc;
      if (inB(nr, nc) && b[idx(nr, nc)] === 0) quiet.push({ from: i, path: [idx(nr, nc)], captures: [] });
    }
  }
  return caps.length ? caps : quiet;
}

export function applyMove(b: Board, m: Move): Board {
  const next = b.slice();
  let p = next[m.from]!;
  next[m.from] = 0;
  for (const c of m.captures) next[c] = 0;
  const to = m.path[m.path.length - 1]!;
  if (Math.abs(p) === 1 && Math.floor(to / 8) === kingRow(p)) p *= 2;
  next[to] = p;
  return next;
}

export function evaluate(b: Board): number {
  // positive = good for the AI (-1 side)
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i]!;
    if (!p) continue;
    const [r, c] = rc(i);
    const val = Math.abs(p) === 2 ? 175 : 100 + (p < 0 ? r : 7 - r) * 4;
    const centre = c >= 2 && c <= 5 && r >= 2 && r <= 5 ? 6 : 0;
    s += (p < 0 ? 1 : -1) * (val + centre);
  }
  return s;
}

function search(b: Board, depth: number, who: 1 | -1, alpha: number, beta: number): number {
  const moves = legalMoves(b, who);
  if (moves.length === 0) return who === -1 ? -100000 - depth : 100000 + depth;
  if (depth === 0) return evaluate(b);
  if (who === -1) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(applyMove(b, m), depth - 1, 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(applyMove(b, m), depth - 1, -1, alpha, beta));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

/** Best move for `who` at the given depth. `noise` adds mistakes for easy levels. */
export function bestMove(b: Board, who: 1 | -1, depth: number, random: () => number, noise = 0): Move | null {
  const moves = legalMoves(b, who);
  if (moves.length === 0) return null;
  let best: Move = moves[0]!;
  let bestScore = -Infinity;
  for (const m of moves) {
    const raw = search(applyMove(b, m), depth - 1, who === 1 ? -1 : 1, -Infinity, Infinity);
    const score = (who === -1 ? raw : -raw) + (random() - 0.5) * noise;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export const count = (b: Board, who: 1 | -1) => b.filter((p) => side(p) === who).length;
