import { useRef } from 'react';
import {
  CanvasStage,
  ControlBar,
  FloatingText,
  Particles,
  Shake,
  TouchButton,
  createContinueGate,
  useGameLoop,
  useHeldKeys,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { fillRoundRect, prompt, text } from '../../engine/draw';
import type { GameProps } from '../../platform/types';
import {
  bag,
  cells,
  PALETTES,
  COLS,
  dropDistance,
  emptyBoard,
  fits,
  gravityFor,
  LINE_POINTS,
  lock,
  removeRows,
  rotate,
  ROWS,
  spawn,
  VISIBLE,
  type Board,
  type Piece,
  type PieceType,
} from './logic';

const W = 360;
const H = 640;
const CELL = 26;
const BX = 16;
const BY = 36;
const HIDDEN = ROWS - VISIBLE;
const LOCK_DELAY = 0.5;

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha = 1,
) {
  ctx.globalAlpha = alpha;
  fillRoundRect(ctx, x + 1, y + 1, size - 2, size - 2, 4, color);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(x + 4, y + 3, size - 8, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + 4, y + size - 5, size - 8, 2);
  ctx.globalAlpha = 1;
}

function drawMini(
  ctx: CanvasRenderingContext2D,
  type: PieceType | null,
  cx: number,
  cy: number,
  size: number,
  colors: Record<PieceType, string>,
) {
  if (!type) return;
  const cs = cells({ type, x: 0, y: 0, rot: 0 });
  const minX = Math.min(...cs.map(([x]) => x));
  const maxX = Math.max(...cs.map(([x]) => x));
  const minY = Math.min(...cs.map(([, y]) => y));
  const maxY = Math.max(...cs.map(([, y]) => y));
  const w = (maxX - minX + 1) * size;
  const h = (maxY - minY + 1) * size;
  for (const [x, y] of cs)
    drawBlock(ctx, cx - w / 2 + (x - minX) * size, cy - h / 2 + (y - minY) * size, size, colors[type]);
}

export function BlockDrop({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const COLORS = PALETTES[lo.skin.id] ?? PALETTES.classic!;
  const lockDelay = LOCK_DELAY + 0.1 * lo.level('lock');
  const gravityScale = 1 + 0.1 * lo.level('calm');
  const continueGate = useRef(createContinueGate(api)).current;
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const fx = useRef({
    particles: new Particles(500, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const s = useRef({
    board: emptyBoard() as Board,
    queue: [...bag(rng), ...bag(rng)] as PieceType[],
    piece: null as Piece | null,
    hold: null as PieceType | null,
    canHold: true,
    gravity: 0,
    lockTimer: 0,
    lockResets: 0,
    das: { dir: 0, timer: 0 },
    softDrop: false,
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    clearing: null as null | { rows: number[]; t: number },
    over: false,
    overTimer: 0,
    ended: false,
    waiting: false,
    time: 0,
    started: false,
    touch: null as null | {
      x: number;
      y: number;
      t: number;
      moved: boolean;
      lastCol: number;
      lastRow: number;
    },
  }).current;

  const next = () => {
    if (s.queue.length < 7) s.queue.push(...bag(rng));
    const type = s.queue.shift()!;
    const p = spawn(type);
    s.piece = p;
    s.canHold = true;
    s.lockTimer = 0;
    s.lockResets = 0;
    s.gravity = 0;
    if (!fits(s.board, p)) {
      s.over = true;
      s.overTimer = 1;
      api.sfx('gameover');
    }
  };
  if (!s.piece && !s.over) next();

  const moved = () => {
    if (s.lockTimer > 0 && s.lockResets < 15) {
      s.lockTimer = 0;
      s.lockResets++;
    }
  };

  const tryMove = (dx: number, dy: number) => {
    if (!s.piece || s.clearing || s.over) return false;
    const cand = { ...s.piece, x: s.piece.x + dx, y: s.piece.y + dy };
    if (!fits(s.board, cand)) return false;
    s.piece = cand;
    if (dx) moved();
    return true;
  };

  const tryRotate = (dir: 1 | -1) => {
    if (!s.piece || s.clearing || s.over) return;
    const r = rotate(s.board, s.piece, dir);
    if (r) {
      s.piece = r;
      moved();
      api.sfx('tick');
    }
  };

  const lockPiece = () => {
    if (!s.piece) return;
    const { board, cleared } = lock(s.board, s.piece);
    s.board = board;
    s.piece = null;
    api.sfx('tap');
    if (cleared.length) {
      s.combo += 1;
      const pts = LINE_POINTS[cleared.length]! * s.level + Math.max(0, s.combo) * 50 * s.level;
      s.score += pts;
      s.lines += cleared.length;
      s.clearing = { rows: cleared, t: 0.25 };
      const label =
        cleared.length === 4 ? 'BLOCK BUSTER!' : ['', 'Single', 'Double', 'Triple'][cleared.length]!;
      fx.current.floaters.add(
        `${label} +${pts}`,
        BX + (COLS * CELL) / 2,
        BY + (cleared[0]! - HIDDEN) * CELL,
        cleared.length === 4 ? '#fde047' : '#fff',
        cleared.length === 4 ? 24 : 18,
        1,
      );
      if (s.combo > 0)
        fx.current.floaters.add(
          `Combo ×${s.combo}`,
          BX + (COLS * CELL) / 2,
          BY + (cleared[0]! - HIDDEN) * CELL + 26,
          '#f0abfc',
          15,
        );
      fx.current.shake.add(cleared.length * 3);
      api.sfx(cleared.length === 4 ? 'win' : 'score');
      if (cleared.length === 4) api.addCoins(2);
      api.haptic(cleared.length * 15);
      for (const y of cleared) {
        for (let x = 0; x < COLS; x++) {
          fx.current.particles.burst(BX + x * CELL + CELL / 2, BY + (y - HIDDEN) * CELL + CELL / 2, {
            count: 2,
            color: COLORS[board[y]![x]!],
            speed: 150,
            life: 0.5,
          });
        }
      }
      const newLevel = Math.floor(s.lines / 10) + 1;
      if (newLevel > s.level) {
        s.level = newLevel;
        api.addCoins(1);
        fx.current.floaters.add(`Level ${s.level}`, BX + (COLS * CELL) / 2, BY + 200, '#67e8f9', 26, 1.4);
        api.sfx('levelup');
      }
    } else {
      s.combo = -1;
      next();
    }
    api.setScore(s.score);
  };

  const hardDrop = () => {
    if (!s.piece || s.clearing || s.over) return;
    s.started = true;
    const d = dropDistance(s.board, s.piece);
    s.piece = { ...s.piece, y: s.piece.y + d };
    s.score += d * 2;
    fx.current.shake.add(2);
    lockPiece();
  };

  const holdPiece = () => {
    if (!s.piece || !s.canHold || s.clearing || s.over) return;
    const cur = s.piece.type;
    if (s.hold) {
      s.piece = spawn(s.hold);
      s.hold = cur;
      if (!fits(s.board, s.piece)) {
        s.over = true;
        s.overTimer = 1;
      }
    } else {
      s.hold = cur;
      next();
    }
    s.canHold = false;
    api.sfx('swap');
  };

  useKeyDown((code, e) => {
    s.started = true;
    if (code === 'ArrowLeft' || code === 'KeyA') {
      if (!e.repeat) {
        tryMove(-1, 0);
        s.das = { dir: -1, timer: 0.17 };
      }
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      if (!e.repeat) {
        tryMove(1, 0);
        s.das = { dir: 1, timer: 0.17 };
      }
    } else if (code === 'ArrowUp' || code === 'KeyX' || code === 'KeyW') tryRotate(1);
    else if (code === 'KeyZ') tryRotate(-1);
    else if (code === 'Space') hardDrop();
    else if (code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') holdPiece();
    else if (code !== 'ArrowDown' && code !== 'KeyS') return false;
  }, !paused);

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.touch = { x: p.x, y: p.y, t: performance.now(), moved: false, lastCol: 0, lastRow: 0 };
  };
  const onMove = (p: StagePointer) => {
    const t = s.touch;
    if (!t) return;
    const dx = p.x - t.x;
    const dy = p.y - t.y;
    const col = Math.round(dx / 24);
    while (t.lastCol < col) {
      if (tryMove(1, 0)) t.moved = true;
      t.lastCol++;
    }
    while (t.lastCol > col) {
      if (tryMove(-1, 0)) t.moved = true;
      t.lastCol--;
    }
    const row = Math.floor(Math.max(0, dy) / 24);
    while (t.lastRow < row && Math.abs(dy) > Math.abs(dx)) {
      if (tryMove(0, 1)) {
        s.score += 1;
        t.moved = true;
      }
      t.lastRow++;
    }
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) t.moved = true;
  };
  const onUp = (p: StagePointer) => {
    const t = s.touch;
    s.touch = null;
    if (!t) return;
    const dt = performance.now() - t.t;
    const dy = p.y - t.y;
    if (dy > 70 && dt < 260 && Math.abs(p.x - t.x) < dy) hardDrop();
    else if (!t.moved && dt < 300) tryRotate(1);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;
    const k = keys.current;

    if (s.clearing) {
      s.clearing.t -= dt;
      if (s.clearing.t <= 0) {
        s.board = removeRows(s.board, s.clearing.rows);
        s.clearing = null;
        next();
      }
    } else if (!s.over && s.piece && s.started) {
      // auto-shift
      const held =
        (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
      if (held && held === s.das.dir) {
        s.das.timer -= dt;
        while (s.das.timer <= 0) {
          tryMove(held, 0);
          s.das.timer += 0.045;
        }
      } else s.das.dir = 0;
      const soft = k.has('ArrowDown') || k.has('KeyS') || s.softDrop;
      const fall = gravityFor(s.level) * gravityScale;
      const interval = soft ? Math.min(0.04, fall) : fall;
      s.gravity += dt;
      while (s.gravity >= interval && s.piece) {
        s.gravity -= interval;
        if (tryMove(0, 1)) {
          if (soft) s.score += 1;
        } else break;
      }
      if (s.piece && !fits(s.board, { ...s.piece, y: s.piece.y + 1 })) {
        s.lockTimer += dt;
        if (s.lockTimer >= lockDelay) lockPiece();
      } else s.lockTimer = 0;
      if (soft) api.setScore(s.score);
    }
    if (s.over && !s.ended && !s.waiting) {
      s.overTimer -= dt;
      if (s.overTimer <= 0) {
        s.waiting = true;
        continueGate(
          () => {
            // Blast away the bottom rows so the stack drops down.
            s.board = removeRows(
              s.board,
              Array.from({ length: 8 }, (_, i) => ROWS - 1 - i),
            );
            s.over = false;
            s.waiting = false;
            s.piece = null;
            fx.current.shake.add(10);
            fx.current.floaters.add('8 rows cleared!', BX + (COLS * CELL) / 2, BY + 200, '#86efac', 24, 1.2);
            next();
          },
          () => {
            s.ended = true;
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Lines', value: String(s.lines) },
                { label: 'Level', value: String(s.level) },
              ],
            });
          },
        );
      }
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(1, '#083344');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    fillRoundRect(ctx, BX - 5, BY - 5, COLS * CELL + 10, VISIBLE * CELL + 10, 10, 'rgba(0,0,0,0.45)');
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(BX + x * CELL, BY);
      ctx.lineTo(BX + x * CELL, BY + VISIBLE * CELL);
      ctx.stroke();
    }
    for (let y = HIDDEN; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = s.board[y]![x];
        if (!c) continue;
        const flashing = s.clearing?.rows.includes(y);
        drawBlock(
          ctx,
          BX + x * CELL,
          BY + (y - HIDDEN) * CELL,
          CELL,
          flashing ? '#ffffff' : COLORS[c],
          flashing ? 0.5 + s.clearing!.t * 2 : 1,
        );
      }
    }
    if (s.piece && !s.over) {
      const ghostY = dropDistance(s.board, s.piece);
      for (const [x, y] of cells({ ...s.piece, y: s.piece.y + ghostY })) {
        if (y >= HIDDEN) {
          ctx.strokeStyle = COLORS[s.piece.type];
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = 2;
          ctx.strokeRect(BX + x * CELL + 3, BY + (y - HIDDEN) * CELL + 3, CELL - 6, CELL - 6);
          ctx.globalAlpha = 1;
        }
      }
      for (const [x, y] of cells(s.piece))
        if (y >= HIDDEN) drawBlock(ctx, BX + x * CELL, BY + (y - HIDDEN) * CELL, CELL, COLORS[s.piece.type]);
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    // side panel
    const px = BX + COLS * CELL + 12;
    const pw = W - px - 8;
    text(ctx, 'NEXT', px + pw / 2, BY + 8, { size: 11, weight: 800, color: '#c4b5fd' });
    fillRoundRect(ctx, px, BY + 18, pw, 64, 10, 'rgba(255,255,255,0.06)');
    drawMini(ctx, s.queue[0] ?? null, px + pw / 2, BY + 50, 13, COLORS);
    fillRoundRect(ctx, px, BY + 88, pw, 90, 10, 'rgba(255,255,255,0.03)');
    drawMini(ctx, s.queue[1] ?? null, px + pw / 2, BY + 112, 10, COLORS);
    drawMini(ctx, s.queue[2] ?? null, px + pw / 2, BY + 152, 10, COLORS);
    text(ctx, 'HOLD', px + pw / 2, BY + 198, { size: 11, weight: 800, color: '#c4b5fd' });
    fillRoundRect(
      ctx,
      px,
      BY + 208,
      pw,
      64,
      10,
      s.canHold ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
    );
    drawMini(ctx, s.hold, px + pw / 2, BY + 240, 13, COLORS);
    text(ctx, 'LEVEL', px + pw / 2, BY + 296, { size: 11, weight: 800, color: '#c4b5fd' });
    text(ctx, String(s.level), px + pw / 2, BY + 318, { size: 22, weight: 850 });
    text(ctx, 'LINES', px + pw / 2, BY + 346, { size: 11, weight: 800, color: '#c4b5fd' });
    text(ctx, String(s.lines), px + pw / 2, BY + 368, { size: 22, weight: 850 });
    text(ctx, s.score.toLocaleString('en'), BX + (COLS * CELL) / 2, 18, { size: 18, weight: 850 });
    if (!s.started) prompt(ctx, 'Drag to move · tap to rotate', BX + (COLS * CELL) / 2, BY + 300, s.time, 15);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Block Drop playfield"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      <ControlBar
        left={
          <>
            <TouchButton
              label="Move left"
              size="small"
              repeatMs={70}
              onPress={() => {
                s.started = true;
                tryMove(-1, 0);
              }}
            >
              ◀
            </TouchButton>
            <TouchButton
              label="Move right"
              size="small"
              repeatMs={70}
              onPress={() => {
                s.started = true;
                tryMove(1, 0);
              }}
            >
              ▶
            </TouchButton>
            <TouchButton
              label="Soft drop"
              size="small"
              onPress={() => {
                s.started = true;
                s.softDrop = true;
              }}
              onRelease={() => (s.softDrop = false)}
            >
              ▼
            </TouchButton>
          </>
        }
        right={
          <>
            <TouchButton label="Hold piece" size="small" onPress={holdPiece}>
              ⇄
            </TouchButton>
            <TouchButton
              label="Rotate"
              size="small"
              onPress={() => {
                s.started = true;
                tryRotate(1);
              }}
            >
              ⟳
            </TouchButton>
            <TouchButton label="Hard drop" size="small" onPress={hardDrop}>
              ⤓
            </TouchButton>
          </>
        }
      />
    </CanvasStage>
  );
}
