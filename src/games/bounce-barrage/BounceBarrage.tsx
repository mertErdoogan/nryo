import { useEffect, useRef } from 'react';
import {
  createContinueGate,
  CanvasStage,
  FloatingText,
  Particles,
  useGameLoop,
  useHeldKeys,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import { grid as gridSchema, num, obj, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import { advance, BLOCK, cellRect, clampAim, COLS, emptyGrid, ROWS } from './logic';

const W = 360;
const H = 600;
const FLOOR = 560;
const BALL_R = 6;
const SPEED = 680;

const saveSchema = obj({
  grid: gridSchema(num({ int: true, min: -1 }), ROWS, COLS),
  balls: num({ int: true, min: 1, max: 999 }),
  turn: num({ int: true, min: 1 }),
  x: num({ min: 0, max: W }),
});
type Save = Infer<typeof saveSchema>;
export const saveSpec: VersionedSpec<Save> = { version: 1, is: saveSchema.is };

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  done: boolean;
}

const hue = (hp: number, turn: number) => 200 - Math.min(1, hp / Math.max(1, turn * 1.6)) * 200;

export function BounceBarrage({ api, paused }: GameProps<Save>) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const fx = useRef({ particles: new Particles(400, rng.next), floaters: new FloatingText() });
  const lo = api.loadout;
  const [ballColor, guideColor] = lo.skin.colors;
  const speed = SPEED * (1 + 0.1 * lo.level('speed'));
  const guideDots = 16 + 6 * lo.level('guide');
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    grid: api.resume?.grid ?? advance(emptyGrid(), 1, rng).grid,
    balls: api.resume?.balls ?? 1 + lo.level('start'),
    turn: api.resume?.turn ?? 1,
    x: api.resume?.x ?? W / 2,
    aim: -Math.PI / 2,
    aiming: false,
    flying: [] as Ball[],
    toLaunch: 0,
    launchTimer: 0,
    nextX: null as number | null,
    shotTime: 0,
    over: false,
    ended: false,
    time: 0,
    gained: 0,
  }).current;

  useEffect(() => {
    api.setScore(s.turn - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = () => s.flying.length > 0 || s.toLaunch > 0;

  const aimAt = (p: StagePointer) => {
    s.aim = clampAim(Math.atan2(p.y - FLOOR, p.x - s.x));
  };
  const onDown = (p: StagePointer) => {
    if (busy() || s.over) return;
    s.aiming = true;
    aimAt(p);
  };
  const onMove = (p: StagePointer) => {
    if (s.aiming) aimAt(p);
  };
  const fire = () => {
    if (busy() || s.over) return;
    s.aiming = false;
    s.toLaunch = s.balls;
    s.launchTimer = 0;
    s.nextX = null;
    s.shotTime = 0;
    s.gained = 0;
    api.sfx('shoot');
  };
  const onUp = () => {
    if (s.aiming) fire();
  };

  useKeyDown((code) => {
    if (code === 'Space' || code === 'Enter') fire();
    else return false;
  }, !paused);

  const endTurn = () => {
    s.balls += s.gained;
    s.x = s.nextX ?? s.x;
    s.turn += 1;
    if (s.turn % 10 === 0) api.addCoins(2);
    const res = advance(s.grid, s.turn, rng);
    if (!res.alive) {
      s.over = true;
      api.sfx('gameover');
      continueGate(
        () => {
          // Wipe the three lowest rows and carry on.
          for (let r = ROWS - 3; r < ROWS; r++) s.grid[r] = Array<number>(COLS).fill(0);
          s.grid = advance(s.grid, s.turn, rng).grid;
          s.over = false;
          fx.current.floaters.add('Rows cleared!', W / 2, FLOOR - 120, '#5eead4', 24, 1.2);
          api.save(
            { grid: s.grid, balls: s.balls, turn: s.turn, x: s.x },
            { label: `Turn ${s.turn} · ${s.balls} balls`, progress: Math.min(1, s.turn / 80) },
          );
        },
        () => api.gameOver({ score: s.turn - 1, stats: [{ label: 'Balls', value: String(s.balls) }] }),
      );
      return;
    }
    s.grid = res.grid;
    api.setScore(s.turn - 1);
    api.save(
      { grid: s.grid, balls: s.balls, turn: s.turn, x: s.x },
      { label: `Turn ${s.turn} · ${s.balls} balls`, progress: Math.min(1, s.turn / 80) },
    );
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters } = fx.current;
    s.time += dt;
    const k = keys.current;
    if (!busy()) {
      if (k.has('ArrowLeft') || k.has('KeyA')) s.aim = clampAim(s.aim - 1.6 * dt);
      if (k.has('ArrowRight') || k.has('KeyD')) s.aim = clampAim(s.aim + 1.6 * dt);
    }

    if (busy()) {
      s.shotTime += dt;
      // Long volleys fast-forward automatically.
      const scale = s.shotTime > 10 ? 3 : s.shotTime > 5 ? 2 : 1;
      const sdt = (dt * scale) / 4;
      for (let step = 0; step < 4; step++) {
        if (s.toLaunch > 0) {
          s.launchTimer -= sdt;
          if (s.launchTimer <= 0) {
            s.launchTimer = 0.07;
            s.toLaunch -= 1;
            s.flying.push({
              x: s.x,
              y: FLOOR - BALL_R,
              vx: Math.cos(s.aim) * speed,
              vy: Math.sin(s.aim) * speed,
              done: false,
            });
          }
        }
        for (const b of s.flying) {
          if (b.done) continue;
          b.x += b.vx * sdt;
          b.y += b.vy * sdt;
          if (b.x < BALL_R) {
            b.x = BALL_R;
            b.vx = Math.abs(b.vx);
          } else if (b.x > W - BALL_R) {
            b.x = W - BALL_R;
            b.vx = -Math.abs(b.vx);
          }
          if (b.y < BALL_R + 40) {
            b.y = BALL_R + 40;
            b.vy = Math.abs(b.vy);
          }
          // Avoid near-horizontal endless bounces.
          if (Math.abs(b.vy) < 60) b.vy = b.vy < 0 ? -60 : 60;
          const c = Math.floor((b.x - 5) / 50);
          const r = Math.floor((b.y - 60) / 50);
          for (let rr = r - 1; rr <= r + 1; rr++) {
            for (let cc = c - 1; cc <= c + 1; cc++) {
              if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
              const val = s.grid[rr]![cc]!;
              if (val === 0) continue;
              const rect = cellRect(rr, cc);
              if (val < 0) {
                if (Math.hypot(b.x - (rect.x + BLOCK / 2), b.y - (rect.y + BLOCK / 2)) < 16) {
                  s.grid[rr]![cc] = 0;
                  s.gained += 1;
                  floaters.add('+1', rect.x + BLOCK / 2, rect.y + BLOCK / 2, '#5eead4', 16, 0.6);
                  api.sfx('coin');
                }
                continue;
              }
              const nx = Math.max(rect.x, Math.min(b.x, rect.x + rect.w));
              const ny = Math.max(rect.y, Math.min(b.y, rect.y + rect.h));
              const dx = b.x - nx;
              const dy = b.y - ny;
              if (dx * dx + dy * dy > BALL_R * BALL_R) continue;
              if (Math.abs(dx) > Math.abs(dy)) {
                b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
                b.x = nx + Math.sign(dx || 1) * BALL_R;
              } else {
                b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
                b.y = ny + Math.sign(dy || 1) * BALL_R;
              }
              s.grid[rr]![cc] = val - 1;
              if (val - 1 <= 0) {
                particles.burst(rect.x + BLOCK / 2, rect.y + BLOCK / 2, {
                  count: 12,
                  colors: [`hsl(${hue(val, s.turn)} 80% 60%)`, '#fff'],
                  speed: 160,
                  life: 0.45,
                  shape: 'square',
                });
                api.sfx('score');
              } else if (rng.chance(0.3)) api.sfx('tick');
            }
          }
          if (b.y >= FLOOR - BALL_R && b.vy > 0) {
            b.done = true;
            b.y = FLOOR - BALL_R;
            if (s.nextX === null) s.nextX = Math.max(BALL_R, Math.min(W - BALL_R, b.x));
          }
        }
      }
      // Returned balls slide to the new launch point.
      for (const b of s.flying) if (b.done && s.nextX !== null) b.x += (s.nextX - b.x) * Math.min(1, dt * 10);
      if (s.toLaunch === 0 && s.flying.length > 0 && s.flying.every((b) => b.done)) {
        s.flying = [];
        endTurn();
      }
    }
    particles.update(dt);
    floaters.update(dt);

    // ---- render
    const ctx = v.ctx;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(1, '#134e4a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 40, W, 1);
    ctx.fillRect(0, FLOOR, W, 1);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const val = s.grid[r]![c]!;
        if (val === 0) continue;
        const rect = cellRect(r, c);
        if (val < 0) {
          const pulse = 1 + Math.sin(s.time * 5 + c) * 0.12;
          ctx.strokeStyle = '#5eead4';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(rect.x + BLOCK / 2, rect.y + BLOCK / 2, 10 * pulse, 0, Math.PI * 2);
          ctx.stroke();
          circle(ctx, rect.x + BLOCK / 2, rect.y + BLOCK / 2, 4, '#5eead4');
          continue;
        }
        fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8, `hsl(${hue(val, s.turn)} 75% 52%)`);
        text(ctx, String(val), rect.x + BLOCK / 2, rect.y + BLOCK / 2 + 1, {
          size: val > 99 ? 15 : 18,
          weight: 850,
        });
      }
    }
    // danger line hint when blocks are close
    if (s.grid[ROWS - 2]!.some((v2) => v2 > 0)) {
      ctx.fillStyle = `rgba(239,68,68,${0.15 + Math.sin(s.time * 6) * 0.1})`;
      ctx.fillRect(0, FLOOR - 6, W, 6);
    }
    if (!busy() && !s.over) {
      // aim guide
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 1; i < guideDots; i++) {
        const d = i * 22;
        let x = s.x + Math.cos(s.aim) * d;
        const y = FLOOR - BALL_R + Math.sin(s.aim) * d;
        if (x < 0) x = -x;
        if (x > W) x = 2 * W - x;
        if (y < 40) break;
        ctx.globalAlpha = Math.max(0.08, s.aiming ? 0.9 - i * (0.8 / guideDots) : 0.35 - i * (0.3 / guideDots));
        circle(ctx, x, y, 3, guideColor);
      }
      ctx.globalAlpha = 1;
      circle(ctx, s.x, FLOOR - BALL_R, BALL_R, ballColor);
      text(ctx, `×${s.balls}`, s.x, FLOOR + 18, { size: 13, weight: 800, color: '#5eead4' });
    }
    for (const b of s.flying) circle(ctx, b.x, b.y, BALL_R, ballColor);
    particles.draw(ctx);
    floaters.draw(ctx);
    text(ctx, `Turn ${s.turn}`, 14, 22, { size: 15, weight: 800, align: 'left' });
    text(ctx, `Balls ${s.balls}`, W - 14, 22, { size: 15, weight: 800, align: 'right', color: '#5eead4' });
    if (s.turn === 1 && !s.aiming && !busy())
      prompt(ctx, 'Drag to aim, release to fire', W / 2, 470, s.time, 17);
    if (busy() && s.shotTime > 5)
      text(ctx, s.shotTime > 10 ? '⏩ ×3' : '⏩ ×2', W / 2, 22, { size: 13, color: '#94a3b8' });
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Bounce Barrage board"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
