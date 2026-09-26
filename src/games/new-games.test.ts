/**
 * Mechanics tests for the second batch of games: pure logic only, no rendering.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../lib/rng';
import * as sort from './ball-sort/logic';
import * as bowling from './bowling-strike/logic';
import * as checkers from './checkers/logic';
import * as land from './color-land/logic';
import * as drag from './drag-race/sim';
import * as merge from './merge-drop/logic';
import * as snake from './neon-snake/logic';
import * as parking from './parking-jam/logic';
import * as sea from './sea-battle/logic';
import * as triple from './triple-tile/logic';
import { answerWords, isFamilyFriendly } from './_shared/words/pick';

describe('ball sort', () => {
  it('generates solvable puzzles and the solver solution really sorts them', () => {
    for (const seed of [1, 2, 3]) {
      const tubes = sort.generate(4, createRng(seed));
      const counts = new Map<number, number>();
      for (const t of tubes) for (const b of t) counts.set(b, (counts.get(b) ?? 0) + 1);
      expect([...counts.values()].every((n) => n === sort.CAPACITY)).toBe(true);
      expect(sort.isSolved(tubes)).toBe(false);
      const moves = sort.solve(tubes);
      expect(moves).not.toBeNull();
      const work = tubes.map((t) => t.slice());
      for (const [from, to] of moves!) {
        expect(sort.canMove(work, from, to)).toBe(true);
        sort.applyMove(work, from, to);
      }
      expect(sort.isSolved(work)).toBe(true);
    }
  });

  it('only pours onto a matching colour or an empty tube', () => {
    const tubes = [[1, 2], [2], [1], []];
    expect(sort.canMove(tubes, 0, 1)).toBe(true);
    expect(sort.canMove(tubes, 0, 2)).toBe(false);
    expect(sort.canMove(tubes, 0, 3)).toBe(true);
    expect(sort.canMove(tubes, 3, 0)).toBe(false);
  });
});

describe('bowling scoring', () => {
  it('scores a perfect game as 300', () => {
    const scores = bowling.frameScores(Array(12).fill(10));
    expect(scores[9]).toBe(300);
    expect(bowling.position(Array(12).fill(10)).done).toBe(true);
  });

  it('scores all 5/5 spares with a 5 fill ball as 150', () => {
    expect(bowling.frameScores(Array(21).fill(5))[9]).toBe(150);
  });

  it('leaves strike and spare frames open until their bonus balls are rolled', () => {
    const s = bowling.frameScores([10, 3]);
    expect(s[0]).toBeNull();
    expect(bowling.frameScores([10, 3, 4])[0]).toBe(17);
    expect(bowling.frameScores([7, 3])[0]).toBeNull();
    expect(bowling.frameScores([7, 3, 2])[0]).toBe(12);
  });

  it('tracks the standing pins and the tenth-frame fill ball', () => {
    expect(bowling.position([7]).standing).toBe(3);
    const open10 = [...Array(18).fill(0), 3, 4];
    expect(bowling.position(open10).done).toBe(true);
    const spare10 = [...Array(18).fill(0), 3, 7];
    expect(bowling.position(spare10)).toMatchObject({ frame: 9, roll: 2, done: false, standing: 10 });
  });
});

describe('checkers', () => {
  it('starts with 12 pieces a side and 7 opening moves', () => {
    const b = checkers.initialBoard();
    expect(checkers.count(b, 1)).toBe(12);
    expect(checkers.count(b, -1)).toBe(12);
    expect(checkers.legalMoves(b, 1)).toHaveLength(7);
  });

  it('forces captures and chains multi-jumps', () => {
    const b: checkers.Board = Array(64).fill(0);
    b[checkers.idx(6, 1)] = 1;
    b[checkers.idx(5, 2)] = -1;
    b[checkers.idx(3, 4)] = -1;
    b[checkers.idx(7, 6)] = 1; // has a quiet move, but capture is forced
    const moves = checkers.legalMoves(b, 1);
    expect(moves).toHaveLength(1);
    expect(moves[0]!.captures).toHaveLength(2);
    const after = checkers.applyMove(b, moves[0]!);
    expect(checkers.count(after, -1)).toBe(0);
  });

  it('crowns a man that reaches the far row', () => {
    const b: checkers.Board = Array(64).fill(0);
    b[checkers.idx(1, 2)] = 1;
    const move = checkers.legalMoves(b, 1)[0]!;
    const after = checkers.applyMove(b, move);
    expect(after[move.path[move.path.length - 1]!]).toBe(2);
  });

  it('bot always returns a legal move', () => {
    const b = checkers.initialBoard();
    const m = checkers.bestMove(b, -1, 3, createRng(4).next);
    expect(m).not.toBeNull();
    expect(
      checkers.legalMoves(b, -1).some((x) => x.from === m!.from && x.path.join() === m!.path.join()),
    ).toBe(true);
  });
});

describe('color land', () => {
  it('claims the area enclosed by a closed trail', () => {
    const owner = new Int8Array(land.N * land.N).fill(land.NONE);
    land.claimSquare(owner, 0, 10, 10, 1); // 3×3 home at (9..11, 9..11)
    const before = land.count(owner, 0);
    // A loop from the home out to x=20 and back encloses the rectangle between.
    const trail: number[] = [];
    for (let x = 12; x <= 20; x++) trail.push(land.idx(x, 9));
    for (let y = 10; y <= 15; y++) trail.push(land.idx(20, y));
    for (let x = 19; x >= 10; x--) trail.push(land.idx(x, 15));
    for (let y = 14; y >= 12; y--) trail.push(land.idx(10, y));
    const gained = land.capture(owner, 0, trail);
    expect(gained).toBeGreaterThan(trail.length);
    expect(owner[land.idx(15, 12)]).toBe(0);
    expect(land.count(owner, 0)).toBe(before + gained);
    expect(owner[land.idx(30, 30)]).toBe(land.NONE);
  });
});

describe('drag race', () => {
  const race = (power: number, perfect: boolean) => {
    const p = { power, grip: 1, perfectFrom: 0.82, nitro: 0 };
    const car = drag.newCar(p);
    car.launched = true;
    for (let i = 0; i < 60 * 40 && car.finishTime === null; i++) {
      const shiftAt = perfect ? 0.88 : 0.97;
      if (car.rpm >= shiftAt) drag.shiftUp(car, p);
      drag.stepCar(car, p, 1 / 60);
    }
    return car;
  };

  it('finishes the quarter mile, faster with more power and perfect shifts', () => {
    const base = race(1, false);
    const tuned = race(1.2, false);
    const clean = race(1, true);
    expect(base.finishTime).not.toBeNull();
    expect(tuned.finishTime!).toBeLessThan(base.finishTime!);
    expect(clean.finishTime!).toBeLessThan(base.finishTime!);
    expect(clean.perfects).toBeGreaterThan(0);
  });

  it('grades shifts by rpm', () => {
    const p = { power: 1, grip: 1, perfectFrom: 0.82, nitro: 0 };
    expect(drag.shiftQuality(0.5, p)).toBe('early');
    expect(drag.shiftQuality(0.9, p)).toBe('perfect');
    expect(drag.shiftQuality(0.99, p)).toBe('late');
  });

  it('bot ladder gets stronger', () => {
    expect(drag.botForTier(5, 0).params.power).toBeGreaterThan(drag.botForTier(0, 0).params.power);
  });
});

describe('merge drop', () => {
  it('merges equal neighbours and chains upward', () => {
    const g = merge.emptyGrid();
    let id = 1;
    merge.drop(g, 0, { id: id++, exp: 1 });
    const r = merge.drop(g, 0, { id: id++, exp: 1 });
    expect(r.merges).toBe(1);
    expect(merge.height(g, 0)).toBe(1);
    expect(g[0]![0]!.exp).toBe(2);
    // 4 next to 4 in the next column → 8
    merge.drop(g, 1, { id: id++, exp: 2 });
    expect(merge.height(g, 0) + merge.height(g, 1)).toBe(1);
    expect(r.ok).toBe(true);
  });

  it('refuses to drop into a full column', () => {
    const g = merge.emptyGrid();
    for (let i = 0; i < merge.ROWS; i++) merge.drop(g, 0, { id: i + 1, exp: (i % 2) + 1 });
    expect(merge.drop(g, 0, { id: 99, exp: 5 }).ok).toBe(false);
  });
});

describe('neon snake continue', () => {
  it('points the head at the most open direction', () => {
    const body = [
      { x: 0, y: 5 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
    ];
    // Head on the left wall facing it: the long run is straight down or up.
    const dir = snake.escapeDir(body, 18, 26);
    expect(['down', 'up']).toContain(dir);
    expect(dir).toBe('down');
  });

  it('returns null when fully boxed in', () => {
    // A 3×1 corridor filled by the snake: the only neighbour is its own neck.
    const body = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    expect(snake.escapeDir(body, 3, 1)).toBeNull();
  });

  it('may move into the square the tail is leaving', () => {
    const body = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(snake.escapeDir(body, 2, 2)).toBe('down');
  });
});

describe('parking jam', () => {
  it('generates puzzles whose stated minimum matches the solver', () => {
    const { cars, min } = parking.generate(3, createRng(11));
    expect(parking.isSolved(cars)).toBe(false);
    const sol = parking.solve(cars);
    expect(sol).not.toBeNull();
    expect(sol!.length).toBe(min);
    let state = cars.map((c) => ({ ...c }));
    for (const m of sol!) {
      const [lo, hi] = parking.slideRange(state, m.id);
      expect(m.delta).toBeGreaterThanOrEqual(lo);
      expect(m.delta).toBeLessThanOrEqual(hi);
      state = state.map((c) =>
        c.id === m.id ? { ...c, x: c.horiz ? c.x + m.delta : c.x, y: c.horiz ? c.y : c.y + m.delta } : c,
      );
    }
    expect(parking.isSolved(state)).toBe(true);
  });

  it('never lets cars overlap', () => {
    const { cars } = parking.generate(6, createRng(5));
    const occ = new Set<string>();
    for (const c of cars)
      for (const [x, y] of parking.cells(c)) {
        const k = `${x},${y}`;
        expect(occ.has(k)).toBe(false);
        occ.add(k);
      }
  });
});

describe('sea battle', () => {
  it('places the whole fleet without touching ships', () => {
    const ships = sea.placeFleet(createRng(3));
    expect(ships.map((s) => s.cells.length)).toEqual(sea.FLEET);
    for (const s of ships) {
      const around = new Set(sea.halo(s));
      for (const o of ships) if (o !== s) for (const c of o.cells) expect(around.has(c)).toBe(false);
    }
  });

  it('reports hits and sinks', () => {
    const ships = sea.placeFleet(createRng(9));
    const target = ships[ships.length - 1]!; // the 2-cell boat
    expect(sea.fire(ships, target.cells[0]!)).toBe('hit');
    expect(sea.fire(ships, target.cells[1]!)).toBe('sunk');
    expect(sea.allSunk(ships)).toBe(false);
  });

  it('bot never fires at a known square', () => {
    const rng = createRng(2);
    const known = new Map<number, sea.Shot>();
    for (let i = 0; i < 60; i++) {
      const c = sea.aiPick(known, [5, 4, 3, 3, 2], 2, rng);
      expect(known.has(c)).toBe(false);
      known.set(c, 'miss');
    }
  });
});

describe('triple tile', () => {
  it('deals complete triples with something free to pick', () => {
    for (const level of [1, 4, 9]) {
      const tiles = triple.generate(level, createRng(level));
      expect(tiles).toHaveLength(triple.levelSpec(level).total);
      const counts = new Map<number, number>();
      for (const t of tiles) counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
      for (const n of counts.values()) expect(n % 3).toBe(0);
      expect(tiles.some((t) => triple.isFree(t, tiles))).toBe(true);
    }
  });

  it('groups matching tiles in the tray and clears a triple', () => {
    const t = (id: number, type: number): triple.Tile => ({ id, x: 0, y: 0, layer: 0, type, state: 'tray' });
    let tray = [t(1, 1), t(2, 2), t(3, 1)];
    tray = triple.insertIntoTray([t(1, 1), t(2, 2)], t(3, 1));
    expect(tray.map((x) => x.type)).toEqual([1, 1, 2]);
    const { tray: rest, cleared } = triple.clearTriples(triple.insertIntoTray(tray, t(4, 1)));
    expect(cleared).toHaveLength(3);
    expect(rest.map((x) => x.type)).toEqual([2]);
  });
});

describe('puzzle word lists', () => {
  it('only offers family-friendly answers of the right length', () => {
    const five = answerWords(5);
    const seven = answerWords(7);
    expect(five.length).toBeGreaterThan(200);
    expect(seven.length).toBeGreaterThan(50);
    expect(five.every((w) => w.length === 5 && isFamilyFriendly(w))).toBe(true);
    expect(seven.every((w) => w.length === 7 && isFamilyFriendly(w))).toBe(true);
    expect(isFamilyFriendly('murder')).toBe(false);
  });
});
