import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  createContinueGate,
  drawCoin,
  useGameLoop,
  useKeyDown,
  useSeededRng,
} from '../../engine';
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
  const lo = api.loadout;
  const [bodyColor, bellyColor, wingColor] = lo.skin.colors;
  const gravity = GRAVITY * (1 - 0.04 * lo.level('glide'));
  const magnet = R + 10 + 12 * lo.level('magnet');
  const coinChance = 0.35 + 0.1 * lo.level('luck');
  const continueGate = useRef(createContinueGate(api)).current;
  const view = useRef<CanvasView | null>(null);
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const s = useRef({
    y: H * 0.42,
    vy: 0,
    started: false,
    dead: false,
    deadTimer: 0,
    ended: false,
    score: 0,
    pillars: [] as Pillar[],
    coins: [] as { x: number; y: number }[],
    shields: lo.level('shield'),
    invuln: 0,
    waiting: false,
    coinCount: 0,
    scroll: 0,
    time: 0,
    flapAnim: 0,
    clouds: Array.from({ length: 6 }, () => ({
      x: rng.range(0, W),
      y: rng.range(40, 300),
      s: rng.range(0.6, 1.3),
    })),
  }).current;

  const spawn = (x: number) => {
    const gap = gapForScore(s.score + s.pillars.length);
    const gapY = rng.range(110 + gap / 2, FLOOR - 40 - gap / 2);
    s.pillars.push({ x, gap, gapY, passed: false });
    if (rng.chance(coinChance)) s.coins.push({ x: x + PILLAR_W / 2, y: gapY });
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
    fx.current.particles.burst(BIRD_X - 10, s.y + 6, {
      count: 5,
      color: '#ffffff',
      speed: 60,
      life: 0.35,
      size: 4,
      angle: Math.PI,
      spread: 1.2,
    });
  };

  const die = (floor = false) => {
    if (s.dead || s.invuln > 0) return;
    if (s.shields > 0 && !floor) {
      s.shields -= 1;
      s.invuln = 1.2;
      fx.current.floaters.add('Shield!', BIRD_X, s.y - 34, '#67e8f9', 20, 0.9);
      fx.current.particles.burst(BIRD_X, s.y, { count: 20, colors: ['#67e8f9', '#fff'], speed: 200, life: 0.5 });
      api.sfx('hit');
      return;
    }
    s.dead = true;
    s.deadTimer = 0.9;
    fx.current.shake.add(12);
    fx.current.particles.burst(BIRD_X, s.y, {
      count: 30,
      colors: ['#fde047', '#fb923c', '#fff'],
      speed: 260,
      life: 0.8,
    });
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
      s.vy += gravity * dt;
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
        for (const c of s.coins) {
          c.x -= speed * dt;
          const dx = BIRD_X - c.x;
          const dy = s.y - c.y;
          if (dx * dx + dy * dy < magnet * magnet) {
            floaters.add('+1', c.x, c.y - 20, '#fde047', 14);
            c.x = -100;
            s.coinCount += 1;
            api.addCoins(1);
            api.sfx('coin');
          }
        }
        s.coins = s.coins.filter((c) => c.x > -20);
        s.invuln = Math.max(0, s.invuln - dt);
        s.pillars = s.pillars.filter((p) => p.x > -PILLAR_W - 10);
        const last = s.pillars[s.pillars.length - 1];
        if (!last || last.x < W + 60 - SPACING) spawn((last?.x ?? W) + SPACING);
      }
      if (s.y + R >= FLOOR) {
        s.y = FLOOR - R;
        s.vy = s.invuln > 0 ? FLAP_VELOCITY : 0;
        die(true);
      }
    }
    if (s.dead && !s.ended && !s.waiting) {
      s.deadTimer -= dt;
      if (s.deadTimer <= 0) {
        s.waiting = true;
        continueGate(
          () => {
            // Clear the pillar that got us and hover in the next gap.
            s.pillars = s.pillars.filter((p) => p.x > BIRD_X + 150 || p.x + PILLAR_W < BIRD_X - 60);
            const next = s.pillars.find((p) => p.x > BIRD_X);
            s.y = next ? next.gapY : H * 0.42;
            s.vy = FLAP_VELOCITY * 0.6;
            s.dead = false;
            s.waiting = false;
            s.invuln = 2;
            fx.current.floaters.add('Fly on!', W / 2, H * 0.3, '#86efac', 30, 1.2);
          },
          () => {
            s.ended = true;
            api.gameOver({ score: s.score, stats: [{ label: 'Coins', value: String(s.coinCount) }] });
          },
        );
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
      const x = ((((c.x - s.scroll * 0.15 * c.s) % (W + 120)) + W + 120) % (W + 120)) - 60;
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

    for (const c of s.coins) drawCoin(ctx, c.x, c.y, 10, s.time);

    // ground
    ctx.fillStyle = '#312e81';
    ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = '#4338ca';
    for (let x = -(s.scroll % 40); x < W; x += 40) ctx.fillRect(x, FLOOR, 20, 8);

    // bird
    const tilt = s.started ? Math.max(-0.5, Math.min(1.2, s.vy / 600)) : Math.sin(s.time * 3) * 0.1;
    ctx.save();
    ctx.translate(BIRD_X, s.y);
    ctx.rotate(tilt);
    if (s.invuln > 0 && Math.floor(s.time * 10) % 2 === 0) ctx.globalAlpha = 0.4;
    if (s.shields > 0 && !s.dead) circle(ctx, 0, 0, R + 7, 'rgba(103,232,249,0.25)');
    if (lo.skin.id === 'phoenix') circle(ctx, -4, 0, R + 5, 'rgba(249,115,22,0.3)');
    circle(ctx, 0, 0, R + 1, bodyColor);
    circle(ctx, 0, 0, R - 2, bellyColor);
    circle(ctx, 6, -5, 5, '#fff');
    circle(ctx, 7.5, -5, 2.4, '#111827');
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(22, 3);
    ctx.lineTo(12, 7);
    ctx.fill();
    ctx.fillStyle = wingColor;
    ctx.beginPath();
    const wing = s.flapAnim > 0 ? -10 * s.flapAnim : 4 + Math.sin(s.time * 12) * 2;
    ctx.ellipse(-5, 3, 9, 6, wing * 0.08, 0, Math.PI * 2);
    ctx.fill();
    if (lo.skin.id === 'royal') {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(-8, -R + 1);
      ctx.lineTo(-6, -R - 9);
      ctx.lineTo(-2, -R - 3);
      ctx.lineTo(2, -R - 10);
      ctx.lineTo(4, -R - 3);
      ctx.lineTo(8, -R - 9);
      ctx.lineTo(9, -R + 1);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    text(ctx, String(s.score), W / 2, 64, {
      size: 52,
      weight: 800,
      stroke: 'rgba(0,0,0,0.3)',
      strokeWidth: 6,
    });
    if (!s.started) prompt(ctx, 'Tap to flap', W / 2, H * 0.62, s.time, 22);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Sky Hopper game area"
      onPointerDown={flap}
      cursor="pointer"
    />
  );
}
