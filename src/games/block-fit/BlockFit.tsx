import { useEffect, useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  useGameLoop,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { fillRoundRect, text } from '../../engine/draw';
import { arr, grid, nullable, num, obj, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import {
  emptyBoard,
  fits,
  fitsAnywhere,
  PIECES,
  place,
  placePoints,
  randomPiece,
  SIZE,
  type Board,
} from './logic';

const W = 360;
const H = 600;
const CELL = 40;
const BX = (W - CELL * SIZE) / 2;
const BY = 64;
const TRAY_Y = 430;
const TRAY_CELL = 22;
const COLORS = [
  '#f472b6',
  '#fb923c',
  '#facc15',
  '#22d3ee',
  '#60a5fa',
  '#a3e635',
  '#34d399',
  '#c084fc',
  '#f87171',
  '#818cf8',
  '#2dd4bf',
  '#fbbf24',
];

const saveSchema = obj({
  board: grid(num({ int: true, min: -1, max: 11 }), SIZE, SIZE),
  tray: arr(nullable(num({ int: true, min: 0, max: PIECES.length - 1 })), { min: 3, max: 3 }),
  score: num({ min: 0 }),
  streak: num({ int: true, min: 0 }),
});
type Save = Infer<typeof saveSchema>;
export const saveSpec: VersionedSpec<Save> = { version: 1, is: saveSchema.is };

function pieceSize(piece: number) {
  const cells = PIECES[piece]!.cells;
  return { rows: Math.max(...cells.map(([r]) => r)) + 1, cols: Math.max(...cells.map(([, c]) => c)) + 1 };
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha = 1,
) {
  ctx.globalAlpha = alpha;
  fillRoundRect(ctx, x + 1.5, y + 1.5, size - 3, size - 3, size * 0.18, color);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x + size * 0.18, y + size * 0.14, size * 0.64, size * 0.12);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + size * 0.18, y + size * 0.78, size * 0.64, size * 0.08);
  ctx.globalAlpha = 1;
}

export function BlockFit({ api, paused }: GameProps<Save>) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const fx = useRef({
    particles: new Particles(500, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const deal = () => [randomPiece(rng), randomPiece(rng), randomPiece(rng)];
  const s = useRef({
    board: (api.resume?.board ?? emptyBoard()) as Board,
    tray: (api.resume?.tray ?? deal()) as (number | null)[],
    score: api.resume?.score ?? 0,
    streak: api.resume?.streak ?? 0,
    drag: null as null | { slot: number; x: number; y: number; offY: number },
    ghost: null as null | { r: number; c: number; ok: boolean },
    keyboard: null as null | { slot: number; r: number; c: number },
    flashes: [] as { k: number; t: number; color: string }[],
    over: false,
    time: 0,
    lines: 0,
  }).current;

  useEffect(() => {
    api.setScore(s.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trayCenter = (slot: number) => ({ x: W / 6 + (slot * W) / 3, y: TRAY_Y + 75 });

  const checkOver = () => {
    const left = s.tray.filter((p): p is number => p !== null);
    if (left.length > 0 && left.every((p) => !fitsAnywhere(s.board, p))) {
      s.over = true;
      api.sfx('gameover');
      setTimeout(
        () => api.gameOver({ score: s.score, stats: [{ label: 'Lines cleared', value: String(s.lines) }] }),
        900,
      );
      return true;
    }
    return false;
  };

  const persist = () =>
    api.save(
      { board: s.board, tray: s.tray, score: s.score, streak: s.streak },
      {
        label: `${s.score.toLocaleString('en')} pts · ${s.board.flat().filter((v) => v >= 0).length} blocks on board`,
        progress: Math.min(1, s.score / 4000),
      },
    );

  const drop = (slot: number, r: number, c: number) => {
    const piece = s.tray[slot];
    if (piece === null || piece === undefined || !fits(s.board, piece, r, c)) return false;
    const { particles, floaters, shake } = fx.current;
    const before = s.board;
    const res = place(s.board, piece, r, c);
    const lines = res.rows.length + res.cols.length;
    s.streak = lines > 0 ? s.streak + 1 : 0;
    const pts = placePoints(PIECES[piece]!.cells.length, lines, s.streak);
    s.score += pts;
    s.lines += lines;
    s.board = res.board;
    s.tray[slot] = null;
    api.setScore(s.score);
    if (lines > 0) {
      for (const y of res.rows)
        for (let x = 0; x < SIZE; x++)
          s.flashes.push({
            k: y * SIZE + x,
            t: 0.35,
            color: COLORS[before[y]![x]! >= 0 ? before[y]![x]! : PIECES[piece]!.color]!,
          });
      for (const x of res.cols)
        for (let y = 0; y < SIZE; y++)
          s.flashes.push({
            k: y * SIZE + x,
            t: 0.35,
            color: COLORS[before[y]![x]! >= 0 ? before[y]![x]! : PIECES[piece]!.color]!,
          });
      for (const f of s.flashes)
        particles.burst(BX + (f.k % SIZE) * CELL + CELL / 2, BY + Math.floor(f.k / SIZE) * CELL + CELL / 2, {
          count: 2,
          color: f.color,
          speed: 120,
          life: 0.5,
        });
      floaters.add(
        lines > 1 ? `${lines} lines! +${pts}` : `+${pts}`,
        W / 2,
        BY + CELL * 4,
        s.streak > 1 ? '#fde047' : '#fff',
        lines > 1 ? 24 : 20,
      );
      if (s.streak > 1) floaters.add(`Streak ×${s.streak}`, W / 2, BY + CELL * 4 + 30, '#f472b6', 16);
      shake.add(3 + lines * 2);
      api.sfx(lines > 1 ? 'powerup' : 'score');
      api.haptic(20);
    } else api.sfx('tap');
    if (s.tray.every((p) => p === null)) s.tray = deal();
    if (!checkOver()) persist();
    return true;
  };

  const ghostFor = (slot: number, px: number, py: number) => {
    const piece = s.tray[slot]!;
    const { rows, cols } = pieceSize(piece);
    const c = Math.round((px - BX) / CELL - cols / 2);
    const r = Math.round((py - BY) / CELL - rows / 2);
    return { r, c, ok: fits(s.board, piece, r, c) };
  };

  const onDown = (p: StagePointer) => {
    if (s.over || paused || p.y < TRAY_Y - 10) return;
    const slot = Math.min(2, Math.max(0, Math.floor(p.x / (W / 3))));
    if (s.tray[slot] === null) return;
    s.keyboard = null;
    s.drag = { slot, x: p.x, y: p.y, offY: p.type === 'touch' ? 90 : 40 };
    api.sfx('tick');
  };
  const onMove = (p: StagePointer) => {
    if (!s.drag) return;
    s.drag.x = p.x;
    s.drag.y = p.y;
    s.ghost = ghostFor(s.drag.slot, p.x, p.y - s.drag.offY);
  };
  const onUp = () => {
    const d = s.drag;
    s.drag = null;
    const g = s.ghost;
    s.ghost = null;
    if (!d || !g) return;
    if (!g.ok || !drop(d.slot, g.r, g.c)) api.sfx('miss');
  };

  useKeyDown((code) => {
    if (s.over) return false;
    const slotKey = ['Digit1', 'Digit2', 'Digit3'].indexOf(code);
    if (slotKey >= 0 && s.tray[slotKey] !== null) {
      s.keyboard = { slot: slotKey, r: 3, c: 3 };
      return;
    }
    const k = s.keyboard;
    if (!k) return false;
    if (code === 'ArrowUp') k.r = Math.max(0, k.r - 1);
    else if (code === 'ArrowDown') k.r = Math.min(SIZE - 1, k.r + 1);
    else if (code === 'ArrowLeft') k.c = Math.max(0, k.c - 1);
    else if (code === 'ArrowRight') k.c = Math.min(SIZE - 1, k.c + 1);
    else if (code === 'Enter' || code === 'Space') {
      if (drop(k.slot, k.r, k.c)) s.keyboard = null;
      else api.sfx('error');
    } else if (code === 'Escape') s.keyboard = null;
    else return false;
  }, !paused);

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;
    for (const f of s.flashes) f.t -= dt;
    s.flashes = s.flashes.filter((f) => f.t > 0);
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    const ctx = v.ctx;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0c1a3a');
    bg.addColorStop(1, '#1e0b3a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    text(ctx, s.score.toLocaleString('en'), W / 2, 34, { size: 30, weight: 850 });
    if (s.streak > 1)
      text(ctx, `Streak ×${s.streak}`, W - 20, 34, { size: 13, align: 'right', color: '#f472b6' });

    ctx.save();
    shake.apply(ctx);
    fillRoundRect(ctx, BX - 6, BY - 6, CELL * SIZE + 12, CELL * SIZE + 12, 14, 'rgba(0,0,0,0.35)');
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val = s.board[r]![c]!;
        const x = BX + c * CELL;
        const y = BY + r * CELL;
        if (val >= 0) drawCell(ctx, x, y, CELL, COLORS[val]!);
        else fillRoundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 6, 'rgba(255,255,255,0.05)');
      }
    }
    for (const f of s.flashes) {
      const x = BX + (f.k % SIZE) * CELL;
      const y = BY + Math.floor(f.k / SIZE) * CELL;
      const t = f.t / 0.35;
      drawCell(ctx, x + (1 - t) * CELL * 0.5, y + (1 - t) * CELL * 0.5, CELL * t, '#ffffff', t);
    }

    // ghost preview (drag or keyboard)
    const kb = s.keyboard;
    const ghost =
      s.ghost ?? (kb ? { r: kb.r, c: kb.c, ok: fits(s.board, s.tray[kb.slot]!, kb.r, kb.c) } : null);
    const ghostPiece = s.drag ? s.tray[s.drag.slot] : kb ? s.tray[kb.slot] : null;
    if (ghost && ghostPiece !== null && ghostPiece !== undefined) {
      const def = PIECES[ghostPiece]!;
      // Highlight lines that would clear.
      if (ghost.ok) {
        const preview = place(s.board, ghostPiece, ghost.r, ghost.c);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        for (const y of preview.rows) ctx.fillRect(BX, BY + y * CELL, CELL * SIZE, CELL);
        for (const x of preview.cols) ctx.fillRect(BX + x * CELL, BY, CELL, CELL * SIZE);
      }
      for (const [dr, dc] of def.cells) {
        const r = ghost.r + dr;
        const c = ghost.c + dc;
        if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) continue;
        drawCell(
          ctx,
          BX + c * CELL,
          BY + r * CELL,
          CELL,
          ghost.ok ? COLORS[def.color]! : '#ef4444',
          ghost.ok ? 0.45 : 0.3,
        );
      }
    }
    particles.draw(ctx);
    ctx.restore();

    // tray
    fillRoundRect(ctx, 10, TRAY_Y, W - 20, 150, 18, 'rgba(255,255,255,0.05)');
    s.tray.forEach((piece, slot) => {
      if (piece === null || (s.drag && s.drag.slot === slot)) return;
      const { rows, cols } = pieceSize(piece);
      const center = trayCenter(slot);
      const fitsNow = fitsAnywhere(s.board, piece);
      for (const [dr, dc] of PIECES[piece]!.cells) {
        drawCell(
          ctx,
          center.x - (cols * TRAY_CELL) / 2 + dc * TRAY_CELL,
          center.y - (rows * TRAY_CELL) / 2 + dr * TRAY_CELL,
          TRAY_CELL,
          COLORS[PIECES[piece]!.color]!,
          fitsNow ? 1 : 0.3,
        );
      }
      if (kb?.slot === slot) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(slot * (W / 3) + 16, TRAY_Y + 8, W / 3 - 32, 134);
      }
    });
    if (s.drag) {
      const piece = s.tray[s.drag.slot]!;
      const { rows, cols } = pieceSize(piece);
      for (const [dr, dc] of PIECES[piece]!.cells) {
        drawCell(
          ctx,
          s.drag.x - (cols * CELL) / 2 + dc * CELL,
          s.drag.y - s.drag.offY - (rows * CELL) / 2 + dr * CELL,
          CELL,
          COLORS[PIECES[piece]!.color]!,
          0.95,
        );
      }
    }
    floaters.draw(ctx);
    if (s.score === 0 && s.board.every((row) => row.every((v) => v < 0)) && !s.drag) {
      text(ctx, 'Drag a piece onto the board', W / 2, TRAY_Y - 18, {
        size: 15,
        color: '#94a3b8',
        weight: 600,
      });
    }
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Block Fit board"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
