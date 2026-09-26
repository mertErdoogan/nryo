import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  createContinueGate,
  drawCoin,
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const GRAVITY = 1350;
const JUMP = -740;
const SPRING = -1180;
const PW = 64;
const PH = 14;
const R = 16;

type Kind = 'normal' | 'moving' | 'crumble' | 'spring' | 'cloud';
interface Platform {
  x: number;
  y: number;
  kind: Kind;
  dir: number;
  broken: boolean;
  used: boolean;
}
interface Drone {
  x: number;
  y: number;
  dir: number;
}

export function SkyClimber({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const [bodyColor, shineColor, trimColor] = lo.skin.colors;
  const jump = JUMP * (1 + 0.04 * lo.level('jump'));
  const springChance = 0.12 + 0.04 * lo.level('springs');
  const magnet = R + 14 + 14 * lo.level('magnet');
  const continueGate = useRef(createContinueGate(api)).current;
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const fx = useRef({ particles: new Particles(300, rng.next), floaters: new FloatingText() });
  const s = useRef({
    x: W / 2,
    y: H - 120,
    vx: 0,
    vy: JUMP,
    cam: 0,
    platforms: [] as Platform[],
    drones: [] as Drone[],
    coins: [] as { x: number; y: number }[],
    coinCount: 0,
    invuln: 0,
    waiting: false,
    highest: H - 40,
    maxHeight: 0,
    touch: new Map<number, number>(),
    started: false,
    dead: false,
    deadTimer: 0,
    ended: false,
    time: 0,
    squash: 0,
    facing: 1,
  }).current;

  const spawnPlatform = (y: number) => {
    const height = (H - y) / 10;
    const roll = rng.next();
    let kind: Kind = 'normal';
    if (height > 150 && roll < springChance) kind = 'spring';
    else if (height > 300 && roll < 0.32) kind = 'moving';
    else if (height > 500 && roll < 0.45) kind = 'crumble';
    else if (height > 900 && roll < 0.55) kind = 'cloud';
    s.platforms.push({
      x: rng.range(8, W - PW - 8),
      y,
      kind,
      dir: rng.chance(0.5) ? 1 : -1,
      broken: false,
      used: false,
    });
    // Crumbling platforms never stand alone: add a safe one nearby.
    if (kind === 'crumble' || kind === 'cloud')
      s.platforms.push({
        x: rng.range(8, W - PW - 8),
        y: y - rng.range(20, 40),
        kind: 'normal',
        dir: 1,
        broken: false,
        used: false,
      });
    if (rng.chance(0.18)) s.coins.push({ x: rng.range(24, W - 24), y: y - rng.range(30, 50) });
    if (height > 1500 && rng.chance(0.06))
      s.drones.push({ x: rng.range(30, W - 30), y: y - 60, dir: rng.chance(0.5) ? 1 : -1 });
  };

  if (s.platforms.length === 0) {
    s.platforms.push({ x: W / 2 - PW / 2, y: H - 40, kind: 'normal', dir: 1, broken: false, used: false });
    let y = H - 40;
    while (y > -H) {
      y -= rng.range(55, 90);
      spawnPlatform(y);
    }
    s.highest = y;
  }

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.touch.set(p.id, p.x < W / 2 ? -1 : 1);
  };
  const onMove = (p: StagePointer) => {
    if (s.touch.has(p.id)) s.touch.set(p.id, p.x < W / 2 ? -1 : 1);
  };
  const onUp = (p: StagePointer) => s.touch.delete(p.id);

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters } = fx.current;
    s.time += dt;
    const k = keys.current;
    let dir = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    for (const d of s.touch.values()) dir += d;
    dir = Math.max(-1, Math.min(1, dir));
    if (dir) {
      s.started = true;
      s.facing = dir;
    }

    if (s.started && !s.dead) {
      s.vx += (dir * 420 - s.vx) * Math.min(1, dt * 9);
      s.vy += GRAVITY * dt;
      const prevY = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < -R) s.x += W + 2 * R;
      if (s.x > W + R) s.x -= W + 2 * R;

      const height = Math.max(0, Math.floor((H - 120 - s.y) / 10));
      for (const p of s.platforms) {
        if (p.kind === 'moving') {
          p.x += p.dir * (60 + Math.min(80, height / 40)) * dt;
          if (p.x < 4 || p.x > W - PW - 4) p.dir *= -1;
        }
        if (p.broken || s.vy <= 0) continue;
        const feet = s.y + R;
        const prevFeet = prevY + R;
        if (prevFeet <= p.y && feet >= p.y && s.x > p.x - 8 && s.x < p.x + PW + 8) {
          if (p.kind === 'crumble') {
            p.broken = true;
            particles.burst(p.x + PW / 2, p.y, {
              count: 12,
              colors: ['#a16207', '#78350f'],
              speed: 120,
              life: 0.5,
              gravity: 600,
              shape: 'square',
            });
            api.sfx('miss');
            continue;
          }
          s.y = p.y - R;
          s.vy = p.kind === 'spring' ? SPRING : jump;
          s.squash = 1;
          if (p.kind === 'spring') {
            api.sfx('powerup');
            floaters.add('Boing!', s.x, s.y - 30, '#fde047', 18, 0.7);
          } else api.sfx('jump');
          if (p.kind === 'cloud') {
            p.used = true;
            p.broken = true;
            particles.burst(p.x + PW / 2, p.y, { count: 10, color: '#fff', speed: 90, life: 0.5 });
          }
        }
      }
      for (const d of s.drones) {
        d.x += d.dir * 90 * dt;
        if (d.x < 20 || d.x > W - 20) d.dir *= -1;
        if (Math.hypot(d.x - s.x, d.y - s.y) < R + 14) {
          if (s.vy > 0 && s.y < d.y - 6) {
            // Stomp from above.
            d.y = 1e9;
            s.vy = jump;
            api.sfx('hit');
            floaters.add('Stomp!', s.x, s.y - 30, '#fca5a5', 16);
          } else if (s.invuln <= 0) {
            s.dead = true;
            s.deadTimer = 1;
            api.sfx('explode');
            api.haptic([60, 40, 80]);
          }
        }
      }
      for (const c of s.coins) {
        if (Math.hypot(c.x - s.x, c.y - s.y) < magnet) {
          floaters.add('+1', c.x, c.y - 16, '#fde047', 14, 0.6);
          c.y = 1e9;
          s.coinCount += 1;
          api.addCoins(1);
          api.sfx('coin');
        }
      }
      s.invuln = Math.max(0, s.invuln - dt);
      // camera follows upward only
      const target = s.y - H * 0.42;
      if (target < s.cam) s.cam = target;
      while (s.highest > s.cam - 100) {
        s.highest -= rng.range(55 + Math.min(60, height / 60), 90 + Math.min(55, height / 50));
        spawnPlatform(s.highest);
      }
      s.platforms = s.platforms.filter((p) => p.y < s.cam + H + 40);
      s.drones = s.drones.filter((d) => d.y < s.cam + H + 40);
      s.coins = s.coins.filter((c) => c.y < s.cam + H + 40);
      const score = Math.max(s.maxHeight, height);
      if (score > s.maxHeight) {
        s.maxHeight = score;
        api.setScore(score);
        if (score % 1000 < 3 && score >= 1000)
          floaters.add(
            `${Math.floor(score / 1000) * 1000}!`,
            W / 2,
            s.y - s.cam - 80 + s.cam,
            '#fff',
            30,
            1.2,
          );
      }
      if (s.y - s.cam > H + 40) {
        s.dead = true;
        s.deadTimer = 0.6;
        api.sfx('gameover');
      }
    } else if (!s.started) {
      s.y = H - 40 - R - Math.abs(Math.sin(s.time * 3.4)) * 110;
    }
    if (s.dead && !s.ended && !s.waiting) {
      s.deadTimer -= dt;
      if (s.deadTimer <= 0) {
        s.waiting = true;
        continueGate(
          () => {
            // A rescue spring appears under the hero.
            const y = s.cam + H * 0.75;
            s.platforms.push({ x: W / 2 - PW / 2, y, kind: 'spring', dir: 1, broken: false, used: false });
            s.drones = s.drones.filter((d) => Math.abs(d.y - s.y) > 260);
            s.x = W / 2;
            s.y = y - R;
            s.vx = 0;
            s.vy = SPRING;
            s.invuln = 2;
            s.dead = false;
            s.waiting = false;
            fx.current.floaters.add('Up you go!', W / 2, y - 80, '#86efac', 24, 1.2);
          },
          () => {
            s.ended = true;
            api.gameOver({
              score: s.maxHeight,
              stats: [
                { label: 'Height', value: `${s.maxHeight} m` },
                { label: 'Coins', value: String(s.coinCount) },
              ],
            });
          },
        );
      }
    }
    s.squash = Math.max(0, s.squash - dt * 5);
    particles.update(dt);
    floaters.update(dt);

    // ---- render
    const ctx = v.ctx;
    const skyTop = Math.min(1, s.maxHeight / 5000);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, `hsl(${220 + skyTop * 40} 70% ${45 - skyTop * 30}%)`);
    bg.addColorStop(1, `hsl(${200 + skyTop * 60} 80% ${70 - skyTop * 40}%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    if (skyTop > 0.3) {
      ctx.fillStyle = `rgba(255,255,255,${(skyTop - 0.3) * 0.8})`;
      for (let i = 0; i < 40; i++)
        ctx.fillRect(
          (i * 97) % W,
          (i * 53 - s.cam * 0.05) % H < 0 ? ((i * 53 - s.cam * 0.05) % H) + H : (i * 53 - s.cam * 0.05) % H,
          2,
          2,
        );
    }
    ctx.save();
    ctx.translate(0, -s.cam);
    for (const p of s.platforms) {
      if (p.broken) continue;
      const color =
        p.kind === 'moving'
          ? '#3b82f6'
          : p.kind === 'crumble'
            ? '#a16207'
            : p.kind === 'cloud'
              ? '#f8fafc'
              : '#22c55e';
      fillRoundRect(ctx, p.x, p.y, PW, PH, 7, color);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(p.x + 6, p.y + 2, PW - 12, 3);
      if (p.kind === 'crumble') {
        ctx.strokeStyle = '#451a03';
        ctx.beginPath();
        ctx.moveTo(p.x + 20, p.y);
        ctx.lineTo(p.x + 26, p.y + PH);
        ctx.moveTo(p.x + 44, p.y);
        ctx.lineTo(p.x + 38, p.y + PH);
        ctx.stroke();
      }
      if (p.kind === 'spring') {
        fillRoundRect(ctx, p.x + PW / 2 - 9, p.y - 10, 18, 10, 3, '#94a3b8');
        fillRoundRect(ctx, p.x + PW / 2 - 12, p.y - 14, 24, 5, 2, '#f43f5e');
      }
    }
    for (const d of s.drones) {
      circle(ctx, d.x, d.y, 14, '#e11d48');
      ctx.strokeStyle = '#fecdd3';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + s.time * 4;
        ctx.beginPath();
        ctx.moveTo(d.x + Math.cos(a) * 14, d.y + Math.sin(a) * 14);
        ctx.lineTo(d.x + Math.cos(a) * 20, d.y + Math.sin(a) * 20);
        ctx.stroke();
      }
      circle(ctx, d.x, d.y, 5, '#fff');
    }
    for (const c of s.coins) drawCoin(ctx, c.x, c.y, 9, s.time);
    // hero (squashes on landing)
    if (!s.dead || s.y - s.cam < H) {
      const sq = s.squash * 0.25;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(1 + sq, 1 - sq);
      if (s.invuln > 0 && Math.floor(s.time * 10) % 2 === 0) ctx.globalAlpha = 0.45;
      circle(ctx, 0, 0, R, bodyColor);
      circle(ctx, -4, -4, R * 0.55, shineColor);
      if (lo.skin.id !== 'blob') {
        // hat / helmet brim in the trim colour
        fillRoundRect(ctx, -R * 0.8, -R - 2, R * 1.6, 6, 3, trimColor);
        if (lo.skin.id === 'astro') circle(ctx, 0, -2, R * 0.75, 'rgba(186,230,253,0.35)');
      }
      circle(ctx, s.facing * 5, -3, 4, '#fff');
      circle(ctx, s.facing * 6, -3, 2, '#111');
      circle(ctx, s.facing * -3, -3, 4, '#fff');
      circle(ctx, s.facing * -2, -3, 2, '#111');
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();
    text(ctx, `${s.maxHeight} m`, W / 2, 40, {
      size: 32,
      weight: 850,
      stroke: 'rgba(0,0,0,0.3)',
      strokeWidth: 6,
    });
    if (!s.started) prompt(ctx, 'Hold left or right to start', W / 2, H * 0.35, s.time, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Sky Climber"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
