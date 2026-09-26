import { useRef } from 'react';
import { CanvasStage, FloatingText, Particles, Shake, useGameLoop, useKeyDown, useSeededRng } from '../../engine';
import type { CanvasView } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import type { GameProps } from '../../platform/types';
import { FLAP_VELOCITY, GRAVITY, gapForScore, hitsPillar, speedForScore, type Pillar } from './logic';

const W = 360;
const H = 640;
const FLOOR = H - 70;
const PILLAR_W = 62;
const SPACING = 215;
const BIRD_X = 110;
const R = 15;

export function SkyHopper({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const fx = useRef({ particles: new Particles(300, rng.next), floaters: new FloatingText(), shake: new Shake(rng.next) });
  const s = useRef({
    y: H * 0.42,
    vy: 0,
    started: false,
    dead: false,
    deadTimer: 0,
    ended: false,
    score: 0,
    pillars: [] as Pillar[],
    scroll: 0,
    time: 0,
    flapAnim: 0,
    clouds: Array.from({ length: 6 }, () => ({ x: rng.range(0, W), y: rng.range(40, 300), s: rng.range(0.6, 1.3) })),
  }).current;

  const spawn = (x: number) => {
    const gap = gapForScore(s.score + s.pillars.length);
    s.pillars.push({ x, gap, gapY: rng.range(110 + gap / 2, FLOOR - 40 - gap / 2), passed: false });
  };

  const flap = () => {
    if (s.dead) return;
    if (!s.started) {
      s.started = true;
      spawn(W + 60);
    }
    s.vy = FLAP_VELOCITY;
    s.flapAnim = 1;
    api.sfx('jump');
    fx.current.particles.burst(BIRD_X - 10, s.y + 6, { count: 5, color: '#ffffff', speed: 60, life: 0.35, size: 4, angle: Math.PI, spread: 1.2 });
  };

  const die = () => {
    if (s.dead) return;
    s.dead = true;
    s.deadTimer = 0.9;
    fx.current.shake.add(12);
    fx.current.particles.burst(BIRD_X, s.y, { count: 30, colors: ['#fde047', '#fb923c', '#fff'], speed: 260, life: 0.8 });
    api.sfx('hit');
    api.haptic([40, 30, 40]);
  };

  useKeyDown((code) => {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'Enter') flap();
  }, !paused);

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;
    s.flapAnim = Math.max(0, s.flapAnim - dt * 5);
    const speed = speedForScore(s.score);

    if (!s.started) {
      s.y = H * 0.42 + Math.sin(s.time * 3) * 10;
      s.scroll += speed * 0.5 * dt;
    } else {
      s.vy += GRAVITY * dt;
      s.y += s.vy * dt;
      if (s.y < R) {
        s.y = R;
        s.vy = Math.max(0, s.vy);
      }
      if (!s.dead) {
        s.scroll += speed * dt;
        for (const p of s.pillars) {
          p.x -= speed * dt;
          if (!p.passed && p.x + PILLAR_W < BIRD_X - R) {
            p.passed = true;
            s.score += 1;
            api.setScore(s.score);
            api.sfx('score');
            floaters.add('+1', BIRD_X, s.y - 30, '#fde047', 18);
            if (s.score % 10 === 0) {
              floaters.add(`${s.score}!`, W / 2, H * 0.3, '#fff', 34, 1.2);
              api.sfx('powerup');
            }
          }
          if (hitsPillar(BIRD_X, s.y, R - 2, p, PILLAR_W, FLOOR)) die();
        }
        s.pillars = s.pillars.filter((p) => p.x > -PILLAR_W - 10);
        const last = s.pillars[s.pillars.length - 1];
        if (!last || last.x < W + 60 - SPACING) spawn((last?.x ?? W) + SPACING);
      }
      if (s.y + R >= FLOOR) {
        s.y = FLOOR - R;
        s.vy = 0;
        die();
      }
    }
    if (s.dead && !s.ended) {
      s.deadTimer -= dt;
      if (s.deadTimer <= 0) {
        s.ended = true;
        api.gameOver({ score: s.score });
      }
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1e3a8a');
    sky.addColorStop(0.6, '#6d28d9');
    sky.addColorStop(1, '#db2777');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    circle(ctx, 280, 120, 46, 'rgba(253, 224, 71, 0.9)');
    circle(ctx, 280, 120, 70, 'rgba(253, 224, 71, 0.12)');

    ctx.save();
    shake.apply(ctx);
    for (const c of s.clouds) {
      const x = (((c.x - s.scroll * 0.15 * c.s) % (W + 120)) + W + 120) % (W + 120) - 60;
      ctx.globalAlpha = 0.25;
      circle(ctx, x, c.y, 22 * c.s, '#fff');
      circle(ctx, x + 22 * c.s, c.y + 4, 16 * c.s, '#fff');
      circle(ctx, x - 20 * c.s, c.y + 6, 14 * c.s, '#fff');
      ctx.globalAlpha = 1;
    }
    // distant hills
    ctx.fillStyle = 'rgba(30, 27, 75, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, FLOOR);
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, FLOOR - 50 - Math.sin((x + s.scroll * 0.3) / 50) * 22);
    ctx.lineTo(W, FLOOR);
    ctx.fill();

    for (const p of s.pillars) {
      const top = p.gapY - p.gap / 2;
      const bottom = p.gapY + p.gap / 2;
      const grad = ctx.createLinearGradient(p.x, 0, p.x + PILLAR_W, 0);
      grad.addColorStop(0, '#22d3ee');
      grad.addColorStop(1, '#0e7490');
      fillRoundRect(ctx, p.x, -10, PILLAR_W, top + 10, 8, grad);
      fillRoundRect(ctx, p.x, bottom, PILLAR_W, FLOOR - bottom + 10, 8, grad);
      fillRoundRect(ctx, p.x - 5, top - 22, PILLAR_W + 10, 22, 6, '#67e8f9');
      fillRoundRect(ctx, p.x - 5, bottom, PILLAR_W + 10, 22, 6, '#67e8f9');
    }

    // ground
    ctx.fillStyle = '#312e81';
    ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = '#4338ca';
    for (let x = -((s.scroll) % 40); x < W; x += 40) ctx.fillRect(x, FLOOR, 20, 8);

    // bird
    const tilt = s.started ? Math.max(-0.5, Math.min(1.2, s.vy / 600)) : Math.sin(s.time * 3) * 0.1;
    ctx.save();
    ctx.translate(BIRD_X, s.y);
    ctx.rotate(tilt);
    circle(ctx, 0, 0, R + 1, '#f59e0b');
    circle(ctx, 0, 0, R - 2, '#fde047');
    circle(ctx, 6, -5, 5, '#fff');
    circle(ctx, 7.5, -5, 2.4, '#111827');
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(22, 3);
    ctx.lineTo(12, 7);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    const wing = s.flapAnim > 0 ? -10 * s.flapAnim : 4 + Math.sin(s.time * 12) * 2;
    ctx.ellipse(-5, 3, 9, 6, wing * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    text(ctx, String(s.score), W / 2, 64, { size: 52, weight: 800, stroke: 'rgba(0,0,0,0.3)', strokeWidth: 6 });
    if (!s.started) prompt(ctx, 'Tap to flap', W / 2, H * 0.62, s.time, 22);
  }, !paused);

  return <CanvasStage ref={view} width={W} height={H} label="Sky Hopper game area" onPointerDown={flap} cursor="pointer" />;
}
