import { useEffect, useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  createContinueGate,
  useGameLoop,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { fillRoundRect, text } from '../../engine/draw';
import { grid, num, obj, oneOf, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import {
  adjacent,
  cloneBoard,
  collapse,
  createBoard,
  expandSpecials,
  findRuns,
  hasMove,
  key,
  newGem,
  resolveClears,
  shuffleBoard,
  SIZE,
  SPECIAL_BONUS,
  starClear,
  swap,
  type Board,
  type Gem,
  type Run,
} from './logic';

const W = 360;
const H = 450;
const CELL = 42;
const BX = (W - CELL * SIZE) / 2;
const BY = 90;
const MOVES = 30;
const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
const LIGHT = ['#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#bfdbfe', '#e9d5ff'];

const cellSchema = obj({
  t: num({ int: true, min: -1, max: 5 }),
  s: oneOf(['none', 'row', 'col', 'bomb', 'star'] as const),
});
const saveSchema = obj({
  board: grid(cellSchema, SIZE, SIZE),
  moves: num({ int: true, min: 0, max: MOVES + 40 }),
  score: num({ min: 0 }),
});
type Save = Infer<typeof saveSchema>;
export const saveSpec: VersionedSpec<Save> = { version: 1, is: saveSchema.is };

type Phase =
  | { kind: 'idle' }
  | {
      kind: 'swap';
      a: [number, number];
      z: [number, number];
      valid: boolean;
      t: number;
      next: Board | null;
      star: Set<number> | null;
    }
  | { kind: 'revert'; t: number }
  | { kind: 'clear'; t: number; cells: Set<number>; created: { r: number; c: number; gem: Gem }[] }
  | { kind: 'fall' }
  | { kind: 'over' };

const center = (r: number, c: number) => ({ x: BX + c * CELL + CELL / 2, y: BY + r * CELL + CELL / 2 });

function drawGem(ctx: CanvasRenderingContext2D, g: Gem, x: number, y: number, size: number, time: number) {
  const s = size * 0.42;
  ctx.save();
  ctx.translate(x, y);
  if (g.special === 'star') {
    const grad = ctx.createConicGradient ? ctx.createConicGradient(time * 2, 0, 0) : null;
    if (grad) COLORS.forEach((c, i) => grad.addColorStop(i / COLORS.length, c));
    ctx.fillStyle = grad ?? '#fff';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s * 1.05 : s * 0.5;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  const color = COLORS[g.type]!;
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (g.type) {
    case 0:
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.85, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.85, 0);
      break;
    case 1:
      for (let i = 0; i < 6; i++)
        ctx.lineTo(Math.cos((i / 6) * Math.PI * 2) * s, Math.sin((i / 6) * Math.PI * 2) * s);
      break;
    case 2:
      ctx.arc(0, 0, s * 0.92, 0, Math.PI * 2);
      break;
    case 3:
      ctx.roundRect(-s * 0.82, -s * 0.82, s * 1.64, s * 1.64, s * 0.3);
      break;
    case 4:
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.95, s * 0.75);
      ctx.lineTo(-s * 0.95, s * 0.75);
      break;
    default:
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? s : s * 0.78;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = LIGHT[g.type]!;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(-s * 0.25, -s * 0.35, s * 0.32, s * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (g.special === 'row' || g.special === 'col') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    for (const o of [-s * 0.35, 0, s * 0.35]) {
      ctx.beginPath();
      if (g.special === 'row') {
        ctx.moveTo(-s * 0.6, o);
        ctx.lineTo(s * 0.6, o);
      } else {
        ctx.moveTo(o, -s * 0.6);
        ctx.lineTo(o, s * 0.6);
      }
      ctx.stroke();
    }
  } else if (g.special === 'bomb') {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6 + Math.sin(time * 6) * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.05, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function toSave(board: Board, moves: number, score: number): Save {
  return {
    board: board.map((row) => row.map((g) => ({ t: g?.type ?? 0, s: g?.special ?? 'none' }))),
    moves,
    score,
  };
}

export function GemSwap({ api, paused }: GameProps<Save>) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const fx = useRef({
    particles: new Particles(600, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const lo = api.loadout;
  const startMoves = MOVES + 2 * lo.level('moves');
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    board: api.resume ? api.resume.board.map((row) => row.map((c) => newGem(c.t, c.s))) : createBoard(rng),
    moves: api.resume?.moves ?? startMoves,
    score: api.resume?.score ?? 0,
    phase: { kind: 'idle' } as Phase,
    cascade: 1,
    selected: null as [number, number] | null,
    drag: null as null | { r: number; c: number; x: number; y: number },
    display: new Map<number, { x: number; y: number; scale: number }>(),
    cursor: [3, 3] as [number, number],
    time: 0,
    biggestCascade: 1,
    specials: 0,
    ended: false,
  }).current;

  useEffect(() => {
    if (s.score) api.setScore(s.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cellAt = (x: number, y: number): [number, number] | null => {
    const c = Math.floor((x - BX) / CELL);
    const r = Math.floor((y - BY) / CELL);
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE ? [r, c] : null;
  };

  const persist = () => {
    api.save(toSave(s.board, s.moves, s.score), {
      label: `${s.score.toLocaleString('en')} pts · ${s.moves} moves left`,
      progress: Math.max(0, (startMoves - s.moves) / startMoves),
    });
  };

  const beginClear = (cells: Set<number>, created: { r: number; c: number; gem: Gem }[], fired: number) => {
    const { particles, floaters, shake } = fx.current;
    let bonus = 0;
    for (const k of cells) {
      const g = s.board[Math.floor(k / SIZE)]![k % SIZE];
      if (g) bonus += SPECIAL_BONUS[g.special];
    }
    const gained = (cells.size * 10 + bonus) * s.cascade;
    s.score += gained;
    s.specials += created.length;
    if (created.length) api.addCoins(created.length);
    api.setScore(s.score);
    let sx = 0;
    let sy = 0;
    for (const k of cells) {
      const p = center(Math.floor(k / SIZE), k % SIZE);
      sx += p.x;
      sy += p.y;
      const g = s.board[Math.floor(k / SIZE)]![k % SIZE];
      particles.burst(p.x, p.y, {
        count: 5,
        colors: [g && g.type >= 0 ? COLORS[g.type]! : '#fff', '#fff'],
        speed: 140,
        life: 0.45,
        size: 4,
      });
    }
    if (cells.size)
      floaters.add(
        s.cascade > 1 ? `+${gained} ×${s.cascade}` : `+${gained}`,
        sx / cells.size,
        sy / cells.size,
        s.cascade > 1 ? '#fde047' : '#fff',
        18,
      );
    if (fired > 0) {
      shake.add(4 + fired * 2);
      api.sfx('explode');
    } else api.sfx(s.cascade > 1 ? 'powerup' : 'score');
    if (created.length) api.sfx('perfect');
    s.phase = { kind: 'clear', t: 0.2, cells, created };
  };

  const clearRuns = (runs: Run[], focus: [number, number] | null) => {
    const res = resolveClears(s.board, runs, focus, rng);
    beginClear(res.cleared, res.created, res.specialsFired);
  };

  const trySwap = (a: [number, number], z: [number, number]) => {
    if (s.phase.kind !== 'idle' || s.moves <= 0 || !adjacent(a, z)) return;
    s.selected = null;
    const ga = s.board[a[0]]![a[1]]!;
    const gz = s.board[z[0]]![z[1]]!;
    const next = swap(s.board, a, z);
    let star: Set<number> | null = null;
    if (ga.special === 'star' || gz.special === 'star') {
      if (ga.special === 'star' && gz.special === 'star')
        star = new Set(Array.from({ length: SIZE * SIZE }, (_, i) => i));
      else star = ga.special === 'star' ? starClear(next, z, gz.type) : starClear(next, a, ga.type);
    }
    const valid = star !== null || findRuns(next).length > 0;
    s.board = next;
    s.phase = { kind: 'swap', a, z, valid, t: 0.16, next, star };
    api.sfx('swap');
  };

  const onDown = (p: StagePointer) => {
    const cell = cellAt(p.x, p.y);
    if (!cell || paused) return;
    s.drag = { r: cell[0], c: cell[1], x: p.x, y: p.y };
  };
  const onMove = (p: StagePointer) => {
    const d = s.drag;
    if (!d) return;
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * 0.35) return;
    s.drag = null;
    const to: [number, number] =
      Math.abs(dx) > Math.abs(dy) ? [d.r, d.c + Math.sign(dx)] : [d.r + Math.sign(dy), d.c];
    if (to[0] >= 0 && to[0] < SIZE && to[1] >= 0 && to[1] < SIZE) trySwap([d.r, d.c], to);
  };
  const onUp = () => {
    const d = s.drag;
    s.drag = null;
    if (!d) return;
    const cell: [number, number] = [d.r, d.c];
    if (s.selected && adjacent(s.selected, cell)) trySwap(s.selected, cell);
    else {
      s.selected = s.selected && s.selected[0] === d.r && s.selected[1] === d.c ? null : cell;
      api.sfx('tick');
    }
  };

  useKeyDown((code) => {
    const [r, c] = s.cursor;
    const move: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (move[code]) {
      const [dr, dc] = move[code]!;
      const next: [number, number] = [
        Math.min(SIZE - 1, Math.max(0, r + dr)),
        Math.min(SIZE - 1, Math.max(0, c + dc)),
      ];
      if (s.selected && adjacent(s.selected, next)) trySwap(s.selected, next);
      s.cursor = next;
    } else if (code === 'Space' || code === 'Enter') {
      s.selected = s.selected && s.selected[0] === r && s.selected[1] === c ? null : [r, c];
    } else return false;
  }, !paused);

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;

    // ---- state machine
    const ph = s.phase;
    if (ph.kind === 'swap') {
      ph.t -= dt;
      if (ph.t <= 0) {
        if (!ph.valid) {
          s.board = swap(s.board, ph.a, ph.z);
          s.phase = { kind: 'revert', t: 0.16 };
          api.sfx('error');
        } else {
          s.moves -= 1;
          s.cascade = 1;
          if (ph.star) {
            const cells = new Set(ph.star);
            const fired = expandSpecials(s.board, cells, rng);
            beginClear(cells, [], fired + 1);
          } else {
            const runs = findRuns(s.board);
            const inRun = (cell: [number, number]) =>
              runs.some((run) => run.cells.some(([r, c]) => r === cell[0] && c === cell[1]));
            clearRuns(runs, inRun(ph.z) ? ph.z : ph.a);
          }
        }
      }
    } else if (ph.kind === 'revert') {
      ph.t -= dt;
      if (ph.t <= 0) s.phase = { kind: 'idle' };
    } else if (ph.kind === 'clear') {
      ph.t -= dt;
      if (ph.t <= 0) {
        const b = cloneBoard(s.board);
        for (const cr of ph.created) b[cr.r]![cr.c] = cr.gem;
        s.board = collapse(b, ph.cells, rng);
        // New gems drop in from above their column.
        for (let c = 0; c < SIZE; c++) {
          let fresh = 0;
          for (let r = 0; r < SIZE; r++) if (!s.display.has(s.board[r]![c]!.id)) fresh++;
          let k = 0;
          for (let r = 0; r < SIZE; r++) {
            const g = s.board[r]![c]!;
            if (!s.display.has(g.id)) {
              const p = center(r, c);
              s.display.set(g.id, { x: p.x, y: p.y - (fresh + 0.5) * CELL - k * 4, scale: 1 });
              k++;
            }
          }
        }
        for (const cr of ph.created) s.display.set(cr.gem.id, { ...center(cr.r, cr.c), scale: 0.3 });
        s.phase = { kind: 'fall' };
      }
    } else if (ph.kind === 'fall') {
      let settled = true;
      for (let r = 0; r < SIZE && settled; r++) {
        for (let c = 0; c < SIZE; c++) {
          const d = s.display.get(s.board[r]![c]!.id);
          if (d && Math.abs(d.y - center(r, c).y) > 1.5) {
            settled = false;
            break;
          }
        }
      }
      if (settled) {
        const runs = findRuns(s.board);
        if (runs.length) {
          s.cascade += 1;
          s.biggestCascade = Math.max(s.biggestCascade, s.cascade);
          clearRuns(runs, null);
        } else if (s.moves <= 0) {
          s.phase = { kind: 'over' };
          if (!s.ended) {
            s.ended = true;
            continueGate(
              () => {
                s.moves = 5;
                s.ended = false;
                s.phase = { kind: 'idle' };
                floaters.add('+5 moves', W / 2, BY + CELL * 4, '#86efac', 26, 1.2);
                persist();
              },
              () =>
                api.gameOver({
                  score: s.score,
                  stats: [
                    { label: 'Best cascade', value: `×${s.biggestCascade}` },
                    { label: 'Specials made', value: String(s.specials) },
                  ],
                }),
            );
          }
        } else {
          if (!hasMove(s.board)) {
            s.board = shuffleBoard(s.board, rng);
            floaters.add('No moves — shuffling!', W / 2, BY + CELL * 4, '#fff', 18, 1.2);
          }
          s.phase = { kind: 'idle' };
          persist();
        }
      }
    }

    // ---- ease display positions
    const clearing = s.phase.kind === 'clear' ? s.phase.cells : null;
    const alive = new Set<number>();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const g = s.board[r]![c];
        if (!g) continue;
        alive.add(g.id);
        const target = center(r, c);
        const d = s.display.get(g.id) ?? { ...target, scale: 1 };
        const k = Math.min(1, dt * 16);
        d.x += (target.x - d.x) * k;
        if (d.y < target.y) d.y = Math.min(target.y, d.y + Math.max(160, (target.y - d.y) * 10) * dt * 3);
        else d.y += (target.y - d.y) * k;
        const targetScale = clearing?.has(key(r, c)) ? 0 : 1;
        d.scale += (targetScale - d.scale) * Math.min(1, dt * 14);
        s.display.set(g.id, d);
      }
    }
    for (const id of s.display.keys()) if (!alive.has(id)) s.display.delete(id);
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#3b0764');
    bg.addColorStop(1, '#1e0a2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    fillRoundRect(ctx, 16, 14, 150, 60, 14, 'rgba(255,255,255,0.08)');
    text(ctx, 'MOVES', 91, 32, { size: 11, weight: 700, color: '#f9a8d4' });
    text(ctx, String(s.moves), 91, 56, { size: 26, weight: 850, color: s.moves <= 5 ? '#fda4af' : '#fff' });
    fillRoundRect(ctx, 194, 14, 150, 60, 14, 'rgba(255,255,255,0.08)');
    text(ctx, 'SCORE', 269, 32, { size: 11, weight: 700, color: '#f9a8d4' });
    text(ctx, s.score.toLocaleString('en'), 269, 56, { size: 22, weight: 850 });

    ctx.save();
    shake.apply(ctx);
    fillRoundRect(ctx, BX - 6, BY - 6, CELL * SIZE + 12, CELL * SIZE + 12, 16, 'rgba(15, 5, 30, 0.6)');
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.035)';
          ctx.fillRect(BX + c * CELL, BY + r * CELL, CELL, CELL);
        }
      }
    }
    const sel = s.selected;
    if (sel)
      fillRoundRect(
        ctx,
        BX + sel[1] * CELL + 2,
        BY + sel[0] * CELL + 2,
        CELL - 4,
        CELL - 4,
        10,
        'rgba(255,255,255,0.22)',
      );
    ctx.save();
    ctx.beginPath();
    ctx.rect(BX - 6, BY - 6, CELL * SIZE + 12, CELL * SIZE + 12);
    ctx.clip();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const g = s.board[r]![c];
        if (!g) continue;
        const d = s.display.get(g.id)!;
        if (d.scale < 0.05) continue;
        drawGem(ctx, g, d.x, d.y, CELL * d.scale, s.time);
      }
    }
    ctx.restore();
    const [cr, cc] = s.cursor;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(BX + cc * CELL + 1, BY + cr * CELL + 1, CELL - 2, CELL - 2);
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Gem Swap board"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
