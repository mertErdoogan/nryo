import { useRef } from 'react';
import { CanvasStage, FloatingText, Particles, Shake, useGameLoop, useKeyDown, useSeededRng } from '../../engine';
import type { CanvasView } from '../../engine';
import { fillRoundRect, hsl, prompt, text } from '../../engine/draw';
import type { GameProps } from '../../platform/types';
import { resolveDrop, speedForLevel, type Slab } from './logic';

const W = 360;
const H = 640;
const BLOCK_H = 26;
const BASE_W = 200;
const PERFECT_TOLERANCE = 5;

interface Placed extends Slab {
  level: number;
}

interface Debris extends Slab {
  y: number;
  vy: number;
  vx: number;
  rot: number;
  hue: number;
}

export function StackTower({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const state = useRef({
    hue0: rng.int(0, 359),
    stack: [{ x: (W - BASE_W) / 2, w: BASE_W, level: 0 }] as Placed[],
    moving: { x: -BASE_W, w: BASE_W, dir: 1 },
    debris: [] as Debris[],
    camera: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfects: 0,
    started: false,
    over: false,
    overTimer: 0,
    time: 0,
    flash: 0,
  });
  const fx = useRef({ particles: new Particles(400, rng.next), floaters: new FloatingText(), shake: new Shake(rng.next) });

  const levelY = (level: number) => H - 120 - level * BLOCK_H;
  const colorFor = (level: number, light = 55) => hsl(state.current.hue0 + level * 7, 80, light);

  const spawnNext = () => {
    const s = state.current;
    const top = s.stack[s.stack.length - 1]!;
    const fromLeft = s.stack.length % 2 === 1;
    s.moving = { x: fromLeft ? -top.w : W, w: top.w, dir: fromLeft ? 1 : -1 };
  };

  const drop = () => {
    const s = state.current;
    if (s.over) return;
    s.started = true;
    const top = s.stack[s.stack.length - 1]!;
    const level = s.stack.length;
    const result = resolveDrop(top, s.moving, PERFECT_TOLERANCE);
    const y = levelY(level);
    if (result.kind === 'miss') {
      s.debris.push({ ...s.moving, y, vy: 0, vx: s.moving.dir * 60, rot: 0, hue: level });
      s.over = true;
      s.overTimer = 0.9;
      fx.current.shake.add(10);
      api.sfx('miss');
      api.haptic([30, 40, 60]);
      return;
    }
    if (result.kind === 'perfect') {
      s.combo += 1;
      s.perfects += 1;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      let placed = result.placed;
      if (s.combo >= 3) {
        const grow = Math.min(10, BASE_W - placed.w);
        placed = { x: placed.x - grow / 2, w: placed.w + grow };
      }
      s.stack.push({ ...placed, level });
      s.score += 2;
      s.flash = 1;
      fx.current.particles.burst(placed.x + placed.w / 2, y, {
        count: 22,
        colors: ['#fff', colorFor(level, 75)],
        speed: 160,
        life: 0.6,
      });
      fx.current.floaters.add(s.combo > 1 ? `Perfect ×${s.combo}` : 'Perfect!', W / 2, y - 30, '#fde68a', 22);
      api.sfx('perfect');
      api.haptic(15);
    } else {
      s.combo = 0;
      s.stack.push({ ...result.placed, level });
      s.debris.push({ ...result.debris, y, vy: 0, vx: s.moving.dir * 40, rot: 0, hue: level });
      s.score += 1;
      api.sfx('tap');
    }
    api.setScore(s.score);
    spawnNext();
  };

  useKeyDown((code) => {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowDown') drop();
  }, !paused);

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const s = state.current;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;

    if (!s.over) {
      const speed = speedForLevel(s.stack.length) * (s.started ? 1 : 0.75);
      s.moving.x += s.moving.dir * speed * dt;
      if (s.moving.x + s.moving.w > W + 10 && s.moving.dir > 0) s.moving.dir = -1;
      if (s.moving.x < -10 && s.moving.dir < 0) s.moving.dir = 1;
    } else {
      s.overTimer -= dt;
      if (s.overTimer <= 0 && s.overTimer > -1) {
        s.overTimer = -2;
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Blocks', value: String(s.stack.length - 1) },
            { label: 'Perfects', value: String(s.perfects) },
            { label: 'Best combo', value: `×${s.maxCombo}` },
          ],
        });
      }
    }

    for (const d of s.debris) {
      d.vy += 900 * dt;
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      d.rot += d.vx * 0.004 * dt * 60;
    }
    s.debris = s.debris.filter((d) => d.y < -s.camera + H + 200);

    const targetCam = Math.max(0, s.stack.length * BLOCK_H - H * 0.42);
    s.camera += (targetCam - s.camera) * Math.min(1, dt * 5);
    s.flash = Math.max(0, s.flash - dt * 3);
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    const hue = s.hue0 + s.stack.length * 3;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, hsl(hue + 200, 45, 14));
    bg.addColorStop(1, hsl(hue + 240, 55, 6));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    shake.apply(ctx);
    ctx.translate(0, s.camera);

    const drawBlock = (slab: Slab, level: number, y: number, alpha = 1) => {
      ctx.globalAlpha = alpha;
      fillRoundRect(ctx, slab.x, y - BLOCK_H, slab.w, BLOCK_H, 4, colorFor(level));
      ctx.fillStyle = colorFor(level, 70);
      ctx.fillRect(slab.x + 2, y - BLOCK_H, Math.max(0, slab.w - 4), 5);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(slab.x + 2, y - 5, Math.max(0, slab.w - 4), 4);
      ctx.globalAlpha = 1;
    };

    // Ground
    const groundY = levelY(0);
    ctx.fillStyle = hsl(hue + 220, 30, 18);
    ctx.fillRect(-20, groundY, W + 40, 400);

    const firstVisible = Math.max(0, Math.floor((s.camera - 200) / BLOCK_H) - 2);
    for (let i = firstVisible; i < s.stack.length; i++) {
      const b = s.stack[i]!;
      drawBlock(b, b.level, levelY(b.level));
    }
    if (s.flash > 0) {
      const top = s.stack[s.stack.length - 1]!;
      ctx.strokeStyle = `rgba(255,255,255,${s.flash})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(top.x - 3, levelY(top.level) - BLOCK_H - 3, top.w + 6, BLOCK_H + 6);
    }
    if (!s.over) drawBlock(s.moving, s.stack.length, levelY(s.stack.length));
    for (const d of s.debris) {
      ctx.save();
      ctx.translate(d.x + d.w / 2, d.y - BLOCK_H / 2);
      ctx.rotate(d.rot);
      ctx.translate(-(d.x + d.w / 2), -(d.y - BLOCK_H / 2));
      drawBlock(d, d.hue, d.y, 0.9);
      ctx.restore();
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    text(ctx, String(s.score), W / 2, 70, { size: 56, weight: 800, stroke: 'rgba(0,0,0,0.25)', strokeWidth: 6 });
    if (s.combo >= 2) text(ctx, `Combo ×${s.combo}`, W / 2, 112, { size: 16, color: '#fde68a' });
    if (!s.started) prompt(ctx, 'Tap to drop the block', W / 2, H - 60, s.time);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Stack Tower game area"
      onPointerDown={drop}
      cursor="pointer"
    />
  );
}
