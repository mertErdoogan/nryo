import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  circle,
  createContinueGate,
  drawCoin,
  fillRoundRect,
  hsl,
  hudPill,
  prompt,
  text,
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const FLOOR = 590;
const CANNON_Y = FLOOR - 18;
const GRAV = 520;
const SIZES = [0, 16, 26, 38, 50];
const BOUNCE_V = [0, 430, 520, 600, 660];

interface Rock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hp: number;
  maxHp: number;
  hue: number;
  entering: boolean;
  flash: number;
}

export function BallBlast({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const fireRate = 9 * (1 + 0.12 * lo.level('rate'));
  const damage = 1 * (1 + 0.2 * lo.level('damage'));
  const barrels = 1 + lo.level('barrels');
  const fx = useRef({
    particles: new Particles(400, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    x: W / 2,
    target: null as number | null,
    rocks: [] as Rock[],
    bullets: [] as { x: number; y: number }[],
    coins: [] as { x: number; y: number; vy: number; vx: number; t: number }[],
    fireT: 0,
    level: 1,
    toSpawn: [] as number[],
    spawnT: 1,
    levelHp: 0,
    levelDone: 0,
    armor: lo.level('armor'),
    invuln: 0,
    dead: false,
    deadT: 0,
    started: false,
    banner: 2,
    dmg: 0,
    coinCount: 0,
    clock: 0,
    drag: null as null | { id: number; px: number; sx: number },
  }).current;

  const hpFor = (size: number, level: number) =>
    Math.max(1, Math.round(4 * Math.pow(1.28, level) * size * (0.8 + rng.next() * 0.4)));

  const startLevel = (level: number) => {
    s.level = level;
    const count = 2 + Math.floor(level / 2);
    s.toSpawn = Array.from({ length: count }, () =>
      rng.int(level < 3 ? 2 : 2, Math.min(4, 2 + Math.floor(level / 3))),
    );
    s.spawnT = 1;
    s.banner = 1.8;
    s.levelHp = s.toSpawn.reduce(
      (sum, size) => sum + hpFor(size, level) * (size === 1 ? 1 : size === 2 ? 1.6 : size === 3 ? 2.2 : 2.8),
      0,
    );
    s.levelDone = 0;
  };
  if (s.toSpawn.length === 0 && s.rocks.length === 0 && s.levelHp === 0) startLevel(1);

  const spawnRock = (size: number) => {
    const fromLeft = rng.chance(0.5);
    const hp = hpFor(size, s.level);
    s.rocks.push({
      x: fromLeft ? -SIZES[size]! : W + SIZES[size]!,
      y: rng.range(120, 220),
      vx: (fromLeft ? 1 : -1) * rng.range(60, 90),
      vy: 0,
      size,
      hp,
      maxHp: hp,
      hue: rng.range(0, 360),
      entering: true,
      flash: 0,
    });
  };

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.drag = { id: p.id, px: p.x, sx: s.x };
  };
  const onMove = (p: StagePointer) => {
    if (s.drag?.id === p.id) s.target = clamp(s.drag.sx + (p.x - s.drag.px) * 1.2, 22, W - 22);
  };
  const onUp = (p: StagePointer) => {
    if (s.drag?.id === p.id) s.drag = null;
  };

  const hitPlayer = () => {
    if (s.invuln > 0 || s.dead) return;
    if (s.armor > 0) {
      s.armor -= 1;
      s.invuln = 1.5;
      fx.current.floaters.add('Armor!', s.x, CANNON_Y - 50, '#93c5fd', 18);
      api.sfx('hit');
      return;
    }
    s.dead = true;
    s.deadT = 0.9;
    fx.current.shake.add(16);
    fx.current.particles.burst(s.x, CANNON_Y, {
      count: 40,
      colors: [lo.skin.colors[0], '#fde047', '#fff'],
      speed: 280,
      life: 0.8,
    });
    api.sfx('explode');
    api.haptic([80, 40, 80]);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    const dir =
      (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    if (dir) {
      s.started = true;
      s.target = null;
      s.x = clamp(s.x + dir * 380 * dt, 22, W - 22);
    } else if (s.target !== null) s.x += clamp(s.target - s.x, -900 * dt, 900 * dt);

    if (s.started && !s.dead) {
      s.invuln = Math.max(0, s.invuln - dt);
      s.banner = Math.max(0, s.banner - dt);
      // fire
      s.fireT -= dt;
      while (s.fireT <= 0) {
        s.fireT += 1 / fireRate;
        for (let b = 0; b < barrels; b++)
          s.bullets.push({ x: s.x + (b - (barrels - 1) / 2) * 9, y: CANNON_Y - 30 });
      }
      for (const b of s.bullets) b.y -= 820 * dt;
      // spawn
      if (s.toSpawn.length > 0) {
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          spawnRock(s.toSpawn.shift()!);
          s.spawnT = 3.2;
        }
      }
      // rocks
      for (const r of s.rocks) {
        const rad = SIZES[r.size]!;
        r.flash = Math.max(0, r.flash - dt);
        if (r.entering) {
          r.x += r.vx * dt;
          if (r.x > rad && r.x < W - rad) r.entering = false;
        } else {
          r.vy += GRAV * dt;
          r.x += r.vx * dt;
          r.y += r.vy * dt;
          if (r.x < rad) {
            r.x = rad;
            r.vx = Math.abs(r.vx);
          } else if (r.x > W - rad) {
            r.x = W - rad;
            r.vx = -Math.abs(r.vx);
          }
          if (r.y > FLOOR - rad) {
            r.y = FLOOR - rad;
            r.vy = -BOUNCE_V[r.size]!;
            if (r.size >= 3) shake.add(2);
          }
        }
        // bullets
        for (const b of s.bullets) {
          if (b.y < -20) continue;
          if (Math.hypot(b.x - r.x, b.y - r.y) < rad + 3) {
            b.y = -100;
            r.hp -= damage;
            r.flash = 0.05;
            s.dmg += damage;
            s.levelDone += Math.min(damage, r.hp + damage);
          }
        }
        // cannon
        if (Math.abs(r.x - s.x) < rad + 16 && r.y + rad > CANNON_Y - 22) hitPlayer();
      }
      s.bullets = s.bullets.filter((b) => b.y > -20);
      const alive: Rock[] = [];
      for (const r of s.rocks) {
        if (r.hp > 0) {
          alive.push(r);
          continue;
        }
        particles.burst(r.x, r.y, {
          count: 14 + r.size * 6,
          color: hsl(r.hue, 80, 60),
          speed: 200,
          life: 0.6,
        });
        api.sfx(r.size >= 3 ? 'explode' : 'hit');
        if (r.size > 1) {
          for (const d of [-1, 1]) {
            const hp = Math.max(1, Math.ceil(r.maxHp / 2.4));
            alive.push({
              x: r.x + d * 8,
              y: r.y,
              vx: d * 90,
              vy: -300,
              size: r.size - 1,
              hp,
              maxHp: hp,
              hue: r.hue + 30,
              entering: false,
              flash: 0,
            });
          }
        }
        if (rng.chance(0.4 + r.size * 0.1))
          s.coins.push({ x: r.x, y: r.y, vx: rng.range(-60, 60), vy: -200, t: 0 });
      }
      s.rocks = alive;
      for (const c of s.coins) {
        c.t += dt;
        c.vy += 900 * dt;
        c.x += c.vx * dt;
        c.y = Math.min(FLOOR - 8, c.y + c.vy * dt);
        if (c.y >= FLOOR - 8) c.vx *= 0.9;
        if (Math.abs(c.x - s.x) < 26 && c.y > CANNON_Y - 40) {
          c.t = 99;
          s.coinCount += 1;
          api.addCoins(1);
          api.sfx('coin');
        }
      }
      s.coins = s.coins.filter((c) => c.t < 6);
      api.setScore(Math.floor(s.dmg));
      if (s.toSpawn.length === 0 && s.rocks.length === 0) {
        floaters.add(`Level ${s.level} clear!`, W / 2, 260, '#86efac', 24, 1.4);
        api.addCoins(3 + s.level);
        s.coinCount += 3 + s.level;
        api.sfx('levelup');
        startLevel(s.level + 1);
      }
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.dead = false;
            s.invuln = 2.5;
            for (const r of s.rocks) {
              r.y = Math.min(r.y, 160);
              r.vy = -100;
            }
          },
          () =>
            api.gameOver({
              score: Math.floor(s.dmg),
              stats: [
                { label: 'Level reached', value: String(s.level) },
                { label: 'Coins', value: String(s.coinCount) },
              ],
            }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#312e81');
    bg.addColorStop(1, '#0ea5e9');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, FLOOR, W, 4);
    ctx.fillStyle = lo.skin.colors[2];
    for (const b of s.bullets) fillRoundRect(ctx, b.x - 2, b.y - 7, 4, 14, 2, lo.skin.colors[2]);
    for (const c of s.coins) drawCoin(ctx, c.x, c.y, 8, s.clock + c.x);
    for (const r of s.rocks) {
      const rad = SIZES[r.size]!;
      circle(ctx, r.x, r.y, rad, r.flash > 0 ? '#fff' : hsl(r.hue, 75, 55));
      circle(ctx, r.x - rad * 0.3, r.y - rad * 0.35, rad * 0.35, 'rgba(255,255,255,0.18)');
      text(ctx, String(Math.ceil(r.hp)), r.x, r.y + 1, {
        size: Math.max(12, rad * 0.8),
        weight: 900,
        stroke: 'rgba(0,0,0,0.3)',
      });
    }
    if (!s.dead) {
      const [c0, c1] = lo.skin.colors;
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 12) % 2 ? 0.4 : 1;
      for (let b = 0; b < barrels; b++)
        fillRoundRect(ctx, s.x - 6 + (b - (barrels - 1) / 2) * 9, CANNON_Y - 34, 12, 26, 4, c0);
      fillRoundRect(ctx, s.x - 24, CANNON_Y - 12, 48, 16, 7, c1);
      circle(ctx, s.x - 15, CANNON_Y + 6, 8, '#0f172a');
      circle(ctx, s.x + 15, CANNON_Y + 6, 8, '#0f172a');
      circle(ctx, s.x - 15, CANNON_Y + 6, 3, '#64748b');
      circle(ctx, s.x + 15, CANNON_Y + 6, 3, '#64748b');
      ctx.globalAlpha = 1;
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    // level progress
    const prog = s.levelHp > 0 ? Math.min(1, s.levelDone / s.levelHp) : 0;
    fillRoundRect(ctx, 70, 14, W - 140, 12, 6, 'rgba(0,0,0,0.35)');
    fillRoundRect(ctx, 70, 14, (W - 140) * prog, 12, 6, '#fde047');
    text(ctx, `Lv ${s.level}`, 40, 20, { size: 14, weight: 800 });
    text(ctx, `Lv ${s.level + 1}`, W - 40, 20, { size: 14, weight: 800, alpha: 0.6 });
    hudPill(ctx, W - 10, 36, String(s.coinCount), { align: 'right', coin: true, size: 13 });
    if (s.banner > 0 && s.started)
      text(ctx, `Level ${s.level}`, W / 2, 200, {
        size: 34,
        weight: 900,
        alpha: Math.min(1, s.banner),
        stroke: 'rgba(0,0,0,0.3)',
      });
    if (!s.started) prompt(ctx, 'Drag to move · it fires by itself', W / 2, H * 0.45, s.clock, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Ball Blast game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
