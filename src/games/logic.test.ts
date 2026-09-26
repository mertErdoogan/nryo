/**
 * Mechanics tests for representative games: pure logic only, no rendering.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../lib/rng';
import * as g2048 from './merge-2048/logic';
import * as mines from './mine-sweeper/logic';
import * as sudoku from './sudoku/logic';
import * as four from './four-in-a-row/logic';
import * as reversi from './reversi/logic';
import * as gems from './gem-swap/logic';
import * as blockFit from './block-fit/logic';
import * as drop from './block-drop/logic';
import * as five from './five-letters/logic';
import * as blitz from './word-blitz/logic';
import * as hunt from './word-hunt/logic';
import * as pipes from './pipe-link/logic';
import * as stack from './stack-tower/logic';
import * as snake from './neon-snake/logic';
import * as miner from './gem-miner/economy';
import * as td from './tower-guard/logic';
import * as barrage from './bounce-barrage/logic';
import * as golf from './mini-golf/physics';
import * as hoop from './hoop-shot/physics';
import * as hockey from './air-hockey/physics';
import * as planets from './planet-conquest/logic';
import * as reflex from './reflex-test/logic';
import * as pin from './pin-spin/logic';
import { isWord } from './_shared/words';

const tile = (value: number, r: number, c: number): g2048.Tile => ({ id: r * 4 + c + 1000 * value, value, r, c });

describe('2048', () => {
  it('merges pairs once per move and slides tiles', () => {
    const res = g2048.move([tile(2, 0, 0), tile(2, 0, 1), tile(2, 0, 2), tile(2, 0, 3)], 'left');
    expect(res.moved).toBe(true);
    expect(res.gained).toBe(8);
    expect(res.tiles.map((t) => [t.value, t.c])).toEqual([
      [4, 0],
      [4, 1],
    ]);
    expect(res.ghosts).toHaveLength(2);
  });

  it('does not merge a merged tile again and detects stuck boards', () => {
    const res = g2048.move([tile(4, 0, 0), tile(2, 0, 1), tile(2, 0, 2)], 'left');
    expect(res.tiles.map((t) => t.value)).toEqual([4, 4]);
    const full: g2048.Tile[] = [];
    let v = 2;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) full.push(tile((v = v === 2 ? 4 : 2) * (r % 2 ? 1 : 8), r, c));
    expect(g2048.canMove(full)).toBe(false);
    expect(g2048.move([tile(2, 0, 0)], 'left').moved).toBe(false);
  });
});

describe('mine sweeper', () => {
  it('keeps the first tap and its neighbours safe', () => {
    const rng = createRng(3);
    for (let i = 0; i < 20; i++) {
      const board = mines.placeMines(9, 9, 10, 40, rng);
      expect(board.filter(Boolean)).toHaveLength(10);
      for (const n of [40, ...mines.neighbors(40, 9, 9)]) expect(board[n]).toBe(false);
    }
  });

  it('flood-fills zero regions and detects wins', () => {
    const minesArr = Array(9).fill(false);
    minesArr[8] = true;
    const nums = mines.counts(minesArr, 3, 3);
    const opened = mines.flood(0, minesArr, nums, new Set(), new Set(), 3, 3);
    expect(opened).toHaveLength(8);
    expect(mines.isWon(minesArr, new Set(opened))).toBe(true);
    expect(mines.winScore('easy', 1)).toBeGreaterThan(mines.winScore('easy', 100));
  });
});

describe('sudoku', () => {
  it('generates valid puzzles with exactly one solution', () => {
    const { puzzle, solution } = sudoku.generate(createRng(11), 'medium');
    expect(puzzle.filter(Boolean).length).toBeGreaterThanOrEqual(sudoku.LEVELS.medium.clues);
    expect(sudoku.countSolutions(puzzle.slice(), 2)).toBe(1);
    for (let i = 0; i < 81; i++) {
      if (puzzle[i]) expect(puzzle[i]).toBe(solution[i]);
      for (const p of sudoku.peers(i)) expect(solution[p]).not.toBe(solution[i]);
    }
  });
});

describe('four in a row', () => {
  it('detects wins in every direction', () => {
    const b = four.emptyBoard();
    for (let c = 0; c < 4; c++) four.play(b, c, 1);
    expect(four.winningLine(b, 3, 0)).toHaveLength(4);
    const d = four.emptyBoard();
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < i; k++) four.play(d, i, 2);
      four.play(d, i, 1);
    }
    expect(four.winningLine(d, 3, 3)).not.toBeNull();
  });

  it('AI takes immediate wins and blocks immediate threats', () => {
    const rng = createRng(1);
    const win = four.emptyBoard();
    for (let i = 0; i < 3; i++) four.play(win, 0, 2);
    expect(four.bestMove(win, 3, rng.next)).toBe(0);
    const block = four.emptyBoard();
    for (let c = 0; c < 3; c++) four.play(block, c, 1);
    four.play(block, 6, 2);
    expect(four.bestMove(block, 3, rng.next)).toBe(3);
  });
});

describe('reversi', () => {
  it('starts with four legal moves and flips correctly', () => {
    const b = reversi.initialBoard();
    expect(reversi.legalMoves(b, 1)).toHaveLength(4);
    const move = reversi.legalMoves(b, 1)[0]!;
    const next = reversi.apply(b, move, 1);
    expect(reversi.count(next, 1)).toBe(4);
    expect(reversi.count(next, 2)).toBe(1);
    expect(reversi.bestMove(next, 2, createRng(2).next)).not.toBeNull();
  });
});

describe('gem swap', () => {
  it('creates boards without initial matches but with moves', () => {
    const board = gems.createBoard(createRng(5));
    expect(gems.findRuns(board)).toHaveLength(0);
    expect(gems.hasMove(board)).toBe(true);
  });

  it('turns four-in-a-row into a striped gem and refills after collapse', () => {
    const rng = createRng(9);
    const board = gems.createBoard(rng);
    for (let c = 0; c < 4; c++) board[7]![c] = gems.newGem(0);
    board[7]![4] = gems.newGem(1);
    const runs = gems.findRuns(board).filter((r) => r.cells.every(([r2]) => r2 === 7));
    const res = gems.resolveClears(board, runs, [7, 1], rng);
    expect(res.created[0]!.gem.special).toBe('row');
    const after = gems.collapse(board, res.cleared, rng);
    expect(after.flat().every(Boolean)).toBe(true);
  });
});

describe('block fit', () => {
  it('clears full rows and columns', () => {
    const b = blockFit.emptyBoard();
    for (let c = 0; c < 7; c++) b[0]![c] = 0;
    const mono = blockFit.PIECES.findIndex((p) => p.cells.length === 1);
    const res = blockFit.place(b, mono, 0, 7);
    expect(res.rows).toEqual([0]);
    expect(res.cleared).toBe(8);
    expect(res.board[0]!.every((v) => v === -1)).toBe(true);
    expect(blockFit.placePoints(1, 2, 2)).toBeGreaterThan(blockFit.placePoints(1, 2, 1));
  });
});

describe('block drop', () => {
  it('uses a fair 7-bag and clears lines', () => {
    expect(new Set(drop.bag(createRng(1)))).toEqual(new Set(drop.TYPES));
    let b = drop.emptyBoard();
    for (let x = 0; x < drop.COLS - 4; x++) b[drop.ROWS - 1]![x] = 'O';
    const piece = { type: 'I' as const, x: drop.COLS - 4, y: 0, rot: 0 };
    const dropped = { ...piece, y: piece.y + drop.dropDistance(b, piece) };
    const res = drop.lock(b, dropped);
    expect(res.cleared).toEqual([drop.ROWS - 1]);
    b = drop.removeRows(res.board, res.cleared);
    expect(b[drop.ROWS - 1]!.every((c) => c === null)).toBe(true);
  });

  it('rotates with wall kicks near the edge', () => {
    const b = drop.emptyBoard();
    const vertical = { type: 'I' as const, x: -2, y: 5, rot: 1 };
    expect(drop.fits(b, vertical)).toBe(true);
    expect(drop.rotate(b, vertical, 1)).not.toBeNull();
  });
});

describe('word games', () => {
  it('marks repeated letters like the classic game', () => {
    expect(five.evaluate('speed', 'abide')).toEqual(['absent', 'absent', 'present', 'absent', 'present']);
    expect(five.evaluate('eerie', 'there')).toEqual(['present', 'absent', 'present', 'absent', 'correct']);
    expect(five.evaluate('crane', 'crane').every((m) => m === 'correct')).toBe(true);
    expect(five.isValidGuess(five.answerList()[0]!)).toBe(true);
    expect(five.isValidGuess('zzzzz')).toBe(false);
  });

  it('builds anagram puzzles whose answers are real words', () => {
    const puzzle = blitz.makePuzzle(createRng(4));
    expect(puzzle.letters).toHaveLength(7);
    expect(puzzle.answers.has(puzzle.seed)).toBe(true);
    for (const w of puzzle.answers) {
      expect(isWord(w)).toBe(true);
      expect(blitz.canSpell(w, puzzle.letters)).toBe(true);
    }
    expect(blitz.wordScore(puzzle.seed, 7)).toBe(blitz.POINTS[7]! + blitz.PANGRAM_BONUS);
  });

  it('places every hidden word in the word search grid', () => {
    const p = hunt.generate(createRng(8));
    expect(p.placements.length).toBeGreaterThanOrEqual(6);
    for (const pl of p.placements) {
      const letters = Array.from({ length: pl.word.length }, (_, i) => p.grid[pl.r + pl.dr * i]![pl.c + pl.dc * i]);
      expect(letters.join('')).toBe(pl.word);
      const cells = Array.from({ length: pl.word.length }, (_, i) => ({ r: pl.r + pl.dr * i, c: pl.c + pl.dc * i }));
      expect(hunt.matchSelection(cells, p.placements)).toBe(pl);
      expect(hunt.matchSelection([...cells].reverse(), p.placements)).toBe(pl);
    }
    expect(hunt.lineCells({ r: 0, c: 0 }, { r: 3, c: 2 })).toHaveLength(4);
  });
});

describe('puzzles and physics', () => {
  it('pipe boards are solvable: the unrotated tree lights every tile', () => {
    for (const size of [4, 6, 8]) {
      const { base, source } = pipes.generate(size, createRng(size));
      expect(pipes.connected(base, size, source).size).toBe(size * size);
      expect(pipes.rotateMask(pipes.N, 1)).toBe(pipes.E);
    }
  });

  it('stack drops slice overhangs and detect perfects', () => {
    expect(stack.resolveDrop({ x: 100, w: 100 }, { x: 102, w: 100 }, 5).kind).toBe('perfect');
    const cut = stack.resolveDrop({ x: 100, w: 100 }, { x: 150, w: 100 }, 5);
    expect(cut).toMatchObject({ kind: 'cut', placed: { x: 150, w: 50 }, debris: { x: 200, w: 50 } });
    expect(stack.resolveDrop({ x: 0, w: 50 }, { x: 60, w: 50 }, 5).kind).toBe('miss');
  });

  it('snake refuses reversals and detects collisions', () => {
    expect(snake.queueTurn([], 'up', 'down')).toEqual([]);
    expect(snake.queueTurn([], 'up', 'left')).toEqual(['left']);
    expect(snake.collides({ x: -1, y: 0 }, [], 10, 10, false)).toBe(true);
    expect(snake.collides({ x: 1, y: 1 }, [{ x: 1, y: 1 }, { x: 2, y: 1 }], 10, 10, false)).toBe(true);
  });

  it('golf balls bounce off walls and drop only when slow', () => {
    const ball = { x: 50, y: 50, vx: 300, vy: 0 };
    ball.x = 95;
    expect(golf.bounceRect(ball, { x: 100, y: 0, w: 20, h: 100 })).toBe(true);
    expect(ball.vx).toBeLessThan(0);
    expect(golf.checkCup({ x: 10, y: 10, vx: 100, vy: 0 }, 10, 10)).toBe('in');
    expect(golf.checkCup({ x: 10, y: 10, vx: 600, vy: 0 }, 10, 10)).toBe('lip');
  });

  it('scores baskets and transfers air hockey momentum', () => {
    expect(hoop.basketPoints(true, 6)).toBe(9);
    const puck = { x: 0, y: -40, vx: 0, vy: 0, r: 17 };
    expect(hockey.strike(puck, { x: 0, y: 0, vx: 0, vy: -500, r: 26 }, 900)).toBe(true);
    expect(puck.vy).toBeLessThan(0);
  });

  it('resolves planet battles', () => {
    const planet = { id: 0, x: 0, y: 0, r: 20, owner: 2, ships: 10 };
    expect(planets.land({ from: 1, to: 0, owner: 1, ships: 15, x: 0, y: 0 }, planet)).toBe(true);
    expect(planet).toMatchObject({ owner: 1, ships: 5 });
  });

  it('bounce barrage adds rows and ends when blocks reach the bottom', () => {
    const g = barrage.emptyGrid();
    const res = barrage.advance(g, 3, createRng(1));
    expect(res.alive).toBe(true);
    expect(res.grid[0]!.filter((v) => v > 0).length).toBeGreaterThan(0);
    expect(res.grid[0]!.filter((v) => v === -1)).toHaveLength(1);
    g[barrage.ROWS - 1]![0] = 5;
    expect(barrage.advance(g, 4, createRng(1)).alive).toBe(false);
  });

  it('pin spin collisions respect clearance', () => {
    expect(pin.collides(0.1, [0])).toBe(true);
    expect(pin.collides(1, [0])).toBe(false);
    expect(pin.planLevel(5).boss).toBe(true);
  });

  it('reflex averages rounds', () => {
    expect(reflex.average([200, 300])).toBe(250);
    expect(reflex.verdict(180)).toBe('Lightning!');
  });
});

describe('strategy and idle economies', () => {
  it('tower defense path is continuous and bosses arrive every 5 waves', () => {
    const cells = td.pathCells();
    expect(cells.size).toBeGreaterThan(20);
    expect(td.waveCreeps(5)).toContain('boss');
    expect(td.waveCreeps(4)).not.toContain('boss');
    expect(td.sellValue('blaster', 1)).toBeLessThan(td.TOWERS.blaster.cost);
  });

  it('idle prices grow geometrically and prestige needs a million', () => {
    const miner0 = miner.BUILDINGS[0]!;
    expect(miner.priceOf(miner0, 0)).toBe(miner0.cost);
    expect(miner.priceOf(miner0, 1)).toBeGreaterThan(miner0.cost);
    expect(miner.priceOf(miner0, 0, 2)).toBe(miner.priceOf(miner0, 0) + miner.priceOf(miner0, 1));
    expect(miner.gemsForRun(999_999)).toBe(0);
    expect(miner.gemsForRun(4_000_000)).toBe(6);
    expect(miner.offlineEarnings(10, 10_000)).toBe(0);
    expect(miner.offlineEarnings(10, 100 * 3600 * 1000)).toBe(10 * 8 * 3600 * 0.5);
  });
});
