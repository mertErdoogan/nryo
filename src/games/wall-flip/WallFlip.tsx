import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  useGameLoop,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import { circleRect, rectsOverlap, TAU } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const WALL = 38;
const SIZE = 26;
const RUNNER_Y = 450;
const LEFT_X = WALL + SIZE / 2;
const RIGHT_X = W - WALL - SIZE / 2;
const JUMP_TIME = 0.24;

type Side = 'L' | 'R';
interface Spike {
  kind: 'spike';
  side: Side;
  y: number;
  h: number;
}
interface Saw {
  kind: 'saw';
  x: number;
  y: number;
  r: number;
  swing: number;
  phase: number;
}
interface Coin {
  kind: 'coin';
  x: number;
  y: number;
  taken: boolean;
}
type Obstacle = Spike | Saw | Coin;

export function WallFlip({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const fx = useRef({
    particles: new Particles(400, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const s = useRef({
    side: 'L' as Side,
    jumping: false,
    jumpT: 0,
    from: LEFT_X,
    to: LEFT_X,
    x: LEFT_X,
    started: false,
    dead: false,
    deadTimer: 0,
    ended: false,
    distance: 0,
    coins: 0,
    score: 0,
    speed: 250,
    obstacles: [] as Obstacle[],
    nextSpawn: -40,
    lastSpikeSide: 'R' as Side,
    time: 0,
    trail: [] as { x: number; y: number; a: number }[],
    scroll: 0,
  }).current;

  const flip = () => {
    if (s.dead || s.jumping) return;
    s.started = true;
    s.jumping = true;
    s.jumpT = 0;
    s.from = s.x;
    s.side = s.side === 'L' ? 'R' : 'L';
    s.to = s.side === 'L' ? LEFT_X : RIGHT_X;
    api.sfx('jump');
  };

  useKeyDown((code) => {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowUp') flip();
    else if (code === 'ArrowLeft' && s.side === 'R') flip();
    else if (code === 'ArrowRight' && s.side === 'L') flip();
  }, !paused);

  /** Spawns one "row" of obstacles above the screen at y. */
  const spawnRow = (y: number) => {
    const d = s.distance;
    const roll = rng.next();
    if (d > 600 && roll < 0.22) {
      s.obstacles.push({
        kind: 'saw',
        x: W / 2,
        y,
        r: 17,
        swing: d > 2500 ? 60 : 0,
        phase: rng.range(0, TAU),
      });
      return 170;
    }
    const side: Side = rng.chance(0.7) ? (s.lastSpikeSide === 'L' ? 'R' : 'L') : s.lastSpikeSide;
    const h = rng.range(80, 120 + Math.min(80, d / 40));
    s.obstacles.push({ kind: 'spike', side, y: y - h, h });
    s.lastSpikeSide = side;
    if (rng.chance(0.45)) {
      const coinSide = side === 'L' ? RIGHT_X : LEFT_X;
      for (let i = 0; i < 3; i++)
        s.obstacles.push({ kind: 'coin', x: coinSide, y: y - h / 2 - 30 + i * 30, taken: false });
    }
    // Minimum spacing leaves time for one flip at current speed.
    return Math.max(h + SIZE + s.speed * (JUMP_TIME + 0.22), 200 - Math.min(40, d / 100));
  };

  const die = () => {
    if (s.dead) return;
    s.dead = true;
    s.deadTimer = 0.9;
    fx.current.shake.add(12);
    fx.current.particles.burst(s.x, RUNNER_Y, {
      count: 36,
      colors: ['#22d3ee', '#a5f3fc', '#fff'],
      speed: 280,
      life: 0.8,
      shape: 'square',
    });
    api.sfx('explode');
    api.haptic([40, 30, 60]);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;

    if (s.started && !s.dead) {
      s.speed = Math.min(560, 250 + s.distance * 0.06);
      const dy = s.speed * dt;
      s.distance += dy;
      s.scroll += dy;
      for (const o of s.obstacles) o.y += dy;
      s.nextSpawn += dy;
      while (s.nextSpawn > -40) s.nextSpawn -= spawnRow(s.nextSpawn - 240);
      s.obstacles = s.obstacles.filter((o) => o.y < H + 200);
      const newScore = Math.floor(s.distance / 10) + s.coins * 5;
      if (newScore !== s.score) {
        s.score = newScore;
        api.setScore(s.score);
      }
    } else if (!s.started) {
      s.scroll += 40 * dt;
    }

    if (s.jumping) {
      s.jumpT += dt / JUMP_TIME;
      const t = Math.min(1, s.jumpT);
      s.x = s.from + (s.to - s.from) * (1 - (1 - t) * (1 - t));
      if (t >= 1) {
        s.jumping = false;
        s.x = s.to;
        particles.burst(s.x + (s.side === 'L' ? -SIZE / 2 : SIZE / 2), RUNNER_Y, {
          count: 6,
          color: '#a5f3fc',
          speed: 90,
          life: 0.3,
          size: 3,
        });
      }
    }

    if (!s.dead) {
      const runner = { x: s.x - SIZE / 2 + 3, y: RUNNER_Y - SIZE / 2 + 3, w: SIZE - 6, h: SIZE - 6 };
      for (const o of s.obstacles) {
        if (o.kind === 'spike') {
          const rect = { x: o.side === 'L' ? WALL : W - WALL - 22, y: o.y + 6, w: 22, h: o.h - 12 };
          if (rectsOverlap(runner, rect)) die();
        } else if (o.kind === 'saw') {
          const sx = o.x + Math.sin(s.time * 2 + o.phase) * o.swing;
          if (circleRect(sx, o.y, o.r - 3, runner)) die();
        } else if (!o.taken && Math.abs(o.x - s.x) < 22 && Math.abs(o.y - RUNNER_Y) < 22) {
          o.taken = true;
          s.coins += 1;
          floaters.add('+5', o.x, o.y - 10, '#fde047', 16, 0.6);
          api.sfx('coin');
        }
      }
      s.trail.push({ x: s.x, y: RUNNER_Y, a: 1 });
      if (s.trail.length > 14) s.trail.shift();
    } else if (!s.ended) {
      s.deadTimer -= dt;
      if (s.deadTimer <= 0) {
        s.ended = true;
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Height', value: `${Math.floor(s.distance / 10)} m` },
            { label: 'Coins', value: String(s.coins) },
          ],
        });
      }
    }
    for (const t of s.trail) {
      t.y += s.started && !s.dead ? s.speed * dt : 0;
      t.a -= dt * 3;
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    ctx.fillStyle = '#0b1026';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    // background grid lines scrolling
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.07)';
    ctx.lineWidth = 1;
    for (let y = (s.scroll * 0.5) % 40; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(WALL, y);
      ctx.lineTo(W - WALL, y);
      ctx.stroke();
    }
    // walls
    const wallGrad = ctx.createLinearGradient(0, 0, WALL, 0);
    wallGrad.addColorStop(0, '#1e1b4b');
    wallGrad.addColorStop(1, '#312e81');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, WALL, H);
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, WALL, H);
    ctx.restore();
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(WALL - 3, 0, 3, H);
    ctx.fillRect(W - WALL, 0, 3, H);
    for (let y = (s.scroll % 64) - 64; y < H; y += 64) {
      ctx.fillStyle = 'rgba(165, 243, 252, 0.12)';
      ctx.fillRect(8, y, WALL - 16, 32);
      ctx.fillRect(W - WALL + 8, y, WALL - 16, 32);
    }

    for (const o of s.obstacles) {
      if (o.kind === 'spike') {
        const baseX = o.side === 'L' ? WALL : W - WALL;
        const dir = o.side === 'L' ? 1 : -1;
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        const teeth = Math.max(2, Math.round(o.h / 20));
        const step = o.h / teeth;
        ctx.moveTo(baseX, o.y);
        for (let i = 0; i < teeth; i++) {
          ctx.lineTo(baseX + dir * 24, o.y + step * (i + 0.5));
          ctx.lineTo(baseX, o.y + step * (i + 1));
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(253, 164, 175, 0.35)';
        ctx.fillRect(o.side === 'L' ? baseX - 4 : baseX, o.y, 4, o.h);
      } else if (o.kind === 'saw') {
        const sx = o.x + Math.sin(s.time * 2 + o.phase) * o.swing;
        ctx.save();
        ctx.translate(sx, o.y);
        ctx.rotate(s.time * 10);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          const r = i % 2 === 0 ? o.r + 5 : o.r - 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        circle(ctx, 0, 0, 6, '#64748b');
        ctx.restore();
      } else if (!o.taken) {
        const pulse = 1 + Math.sin(s.time * 6 + o.y * 0.05) * 0.1;
        circle(ctx, o.x, o.y, 8 * pulse, '#fde047');
        circle(ctx, o.x - 2, o.y - 2, 3, '#fef9c3');
      }
    }

    for (const t of s.trail) {
      if (t.a <= 0) continue;
      ctx.globalAlpha = t.a * 0.25;
      fillRoundRect(ctx, t.x - SIZE / 2, t.y - SIZE / 2, SIZE, SIZE, 6, '#22d3ee');
    }
    ctx.globalAlpha = 1;
    if (!s.dead) {
      ctx.save();
      ctx.translate(s.x, RUNNER_Y);
      ctx.rotate(s.jumping ? s.jumpT * Math.PI * (s.side === 'R' ? 1 : -1) : 0);
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 16;
      fillRoundRect(ctx, -SIZE / 2, -SIZE / 2, SIZE, SIZE, 6, '#a5f3fc');
      ctx.shadowBlur = 0;
      fillRoundRect(ctx, -SIZE / 2 + 5, -SIZE / 2 + 5, SIZE - 10, SIZE - 10, 4, '#0891b2');
      ctx.restore();
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    text(ctx, String(s.score), W / 2, 56, {
      size: 44,
      weight: 800,
      stroke: 'rgba(0,0,0,0.4)',
      strokeWidth: 6,
    });
    if (!s.started) prompt(ctx, 'Tap to flip walls', W / 2, 560, s.time);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Wall Flip game area"
      onPointerDown={flip}
      cursor="pointer"
    />
  );
}
