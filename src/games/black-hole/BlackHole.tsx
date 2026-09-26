import { useRef } from 'react';
import {
  CanvasStage,
  FloatingStick,
  FloatingText,
  Particles,
  circle,
  createContinueGate,
  fillRoundRect,
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
const WORLD = 1600;
const BLOCK = 200;
const ROAD = 44;
const BOT_NAMES = ['Gobbler', 'Nomzilla', 'Chompy', 'Vortex'];
const BOT_COLORS = ['#f97316', '#22c55e', '#ec4899', '#eab308'];

type Kind = 'person' | 'cone' | 'hydrant' | 'bench' | 'tree' | 'car' | 'bus' | 'house' | 'tower';
const SIZES: Record<Kind, number> = {
  person: 5,
  cone: 5,
  hydrant: 6,
  bench: 9,
  tree: 12,
  car: 15,
  bus: 24,
  house: 36,
  tower: 54,
};
interface Obj {
  kind: Kind;
  x: number;
  y: number;
  r: number;
  color: string;
  falling: number;
  into: Hole | null;
  vx: number;
  vy: number;
}
interface Hole {
  name: string;
  x: number;
  y: number;
  r: number;
  mass: number;
  color: string;
  bot: boolean;
  alive: boolean;
  respawn: number;
  target: { x: number; y: number } | null;
  think: number;
}

const radiusFor = (base: number, mass: number) => Math.sqrt(base * base + mass * 0.9);

export function BlackHole({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const baseR = 18 * (1 + 0.12 * lo.level('size'));
  const speedMul = 1 + 0.08 * lo.level('speed');
  const roundTime = 120 + 10 * lo.level('time');
  const magnet = lo.level('magnet');
  const fx = useRef({ particles: new Particles(300, rng.next), floaters: new FloatingText() });
  const continueGate = useRef(createContinueGate(api)).current;
  const stick = useRef(new FloatingStick(56)).current;

  const build = () => {
    const objs: Obj[] = [];
    const add = (kind: Kind, x: number, y: number, color: string) =>
      objs.push({ kind, x, y, r: SIZES[kind], color, falling: 0, into: null, vx: 0, vy: 0 });
    for (let bx = 0; bx < WORLD; bx += BLOCK)
      for (let by = 0; by < WORLD; by += BLOCK) {
        const x0 = bx + ROAD / 2;
        const y0 = by + ROAD / 2;
        const inner = BLOCK - ROAD;
        const style = rng.int(0, 3);
        if (style === 0) {
          add(
            rng.chance(0.4) ? 'tower' : 'house',
            x0 + inner / 2,
            y0 + inner / 2,
            rng.pick(['#e2e8f0', '#fca5a5', '#bfdbfe', '#fde68a']),
          );
        } else if (style === 1) {
          for (const [dx, dy] of [
            [0.28, 0.28],
            [0.72, 0.28],
            [0.28, 0.72],
            [0.72, 0.72],
          ] as const)
            add(
              'house',
              x0 + inner * dx,
              y0 + inner * dy,
              rng.pick(['#fecaca', '#fef3c7', '#dbeafe', '#dcfce7']),
            );
        } else {
          // park
          for (let i = 0; i < 7; i++)
            add('tree', x0 + rng.range(14, inner - 14), y0 + rng.range(14, inner - 14), '#16a34a');
          for (let i = 0; i < 3; i++)
            add('bench', x0 + rng.range(10, inner - 10), y0 + rng.range(10, inner - 10), '#a16207');
        }
        for (let i = 0; i < 4; i++)
          add(
            'person',
            x0 + rng.range(0, inner),
            by + rng.range(4, ROAD / 2 - 2),
            rng.pick(['#f472b6', '#60a5fa', '#facc15', '#a78bfa']),
          );
        add(
          rng.chance(0.5) ? 'cone' : 'hydrant',
          bx + rng.range(4, ROAD / 2),
          y0 + rng.range(0, inner),
          rng.chance(0.5) ? '#f97316' : '#dc2626',
        );
        if (rng.chance(0.6))
          add(
            rng.chance(0.2) ? 'bus' : 'car',
            x0 + rng.range(20, inner - 20),
            by + ROAD / 2 + 2,
            rng.pick(['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#e5e7eb']),
          );
      }
    return objs;
  };

  const s = useRef({
    objs: build(),
    holes: [] as Hole[],
    time: roundTime,
    started: false,
    over: false,
    clock: 0,
    camScale: 1,
    eaten: 0,
    holesEaten: 0,
  }).current;
  if (s.holes.length === 0) {
    s.holes.push({
      name: 'You',
      x: WORLD / 2 + ROAD / 2 - BLOCK / 2,
      y: WORLD / 2 + 1,
      r: baseR,
      mass: 0,
      color: lo.skin.colors[1],
      bot: false,
      alive: true,
      respawn: 0,
      target: null,
      think: 0,
    });
    for (let i = 0; i < 4; i++)
      s.holes.push({
        name: `${BOT_NAMES[i]} (bot)`,
        x: rng.range(100, WORLD - 100),
        y: rng.range(100, WORLD - 100),
        r: 18,
        mass: 0,
        color: BOT_COLORS[i]!,
        bot: true,
        alive: true,
        respawn: 0,
        target: null,
        think: 0,
      });
  }
  const me = s.holes[0]!;

  const onDown = (p: StagePointer) => {
    s.started = true;
    stick.down(p.id, p.x, p.y);
  };
  const onMove = (p: StagePointer) => stick.move(p.id, p.x, p.y);
  const onUp = (p: StagePointer) => stick.up(p.id);

  const finish = () => {
    const ranking = [...s.holes].sort((a, b) => b.mass - a.mass);
    const rank = ranking.indexOf(me) + 1;
    api.gameOver({
      score: Math.floor(me.mass),
      won: rank === 1,
      stats: [
        { label: 'Rank', value: `#${rank} of ${s.holes.length}` },
        { label: 'Things swallowed', value: String(s.eaten) },
        { label: 'Holes eaten', value: String(s.holesEaten) },
      ],
    });
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters } = fx.current;
    s.clock += dt;
    const k = keys.current;
    let mx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let my = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    const sv = stick.vector();
    if (sv.x || sv.y) {
      mx = sv.x;
      my = sv.y;
    }
    if (mx || my) s.started = true;

    if (s.started && !s.over) {
      s.time -= dt;
      for (const h of s.holes) {
        if (!h.alive) {
          h.respawn -= dt;
          if (h.respawn <= 0) {
            h.alive = true;
            h.r = 18;
            h.mass = h.mass * 0.3;
            h.r = radiusFor(18, h.mass);
            h.x = rng.range(100, WORLD - 100);
            h.y = rng.range(100, WORLD - 100);
          }
          continue;
        }
        const sp = (150 - Math.min(60, h.r * 0.35)) * (h.bot ? 0.85 : speedMul);
        let dx = 0;
        let dy = 0;
        if (!h.bot) {
          const mag = Math.min(1, Math.hypot(mx, my));
          if (mag > 0.05) {
            dx = (mx / Math.hypot(mx, my)) * mag;
            dy = (my / Math.hypot(mx, my)) * mag;
          }
        } else {
          h.think -= dt;
          if (h.think <= 0 || !h.target) {
            h.think = rng.range(0.6, 1.4);
            // flee a much bigger hole nearby, otherwise head for food
            const threat = s.holes.find(
              (o) => o !== h && o.alive && o.r > h.r * 1.15 && Math.hypot(o.x - h.x, o.y - h.y) < o.r + 160,
            );
            if (threat) h.target = { x: h.x + (h.x - threat.x), y: h.y + (h.y - threat.y) };
            else {
              const prey = s.holes.find(
                (o) => o !== h && o.alive && h.r > o.r * 1.2 && Math.hypot(o.x - h.x, o.y - h.y) < 260,
              );
              if (prey) h.target = { x: prey.x, y: prey.y };
              else {
                let best: Obj | null = null;
                let bd = Infinity;
                for (const o of s.objs) {
                  if (o.falling || o.r >= h.r * 0.9) continue;
                  const d = Math.hypot(o.x - h.x, o.y - h.y) - o.r * 4;
                  if (d < bd) {
                    bd = d;
                    best = o;
                  }
                }
                h.target = best
                  ? { x: best.x, y: best.y }
                  : { x: rng.range(100, WORLD - 100), y: rng.range(100, WORLD - 100) };
              }
            }
          }
          const tx = h.target.x - h.x;
          const ty = h.target.y - h.y;
          const d = Math.hypot(tx, ty) || 1;
          dx = tx / d;
          dy = ty / d;
        }
        h.x = clamp(h.x + dx * sp * dt, h.r, WORLD - h.r);
        h.y = clamp(h.y + dy * sp * dt, h.r, WORLD - h.r);
      }
      // swallowing objects
      for (const o of s.objs) {
        if (o.falling > 0) {
          o.falling += dt;
          const h = o.into!;
          o.x += (h.x - o.x) * Math.min(1, dt * 8);
          o.y += (h.y - o.y) * Math.min(1, dt * 8);
          continue;
        }
        for (const h of s.holes) {
          if (!h.alive || o.r >= h.r * 0.92) continue;
          const d = Math.hypot(o.x - h.x, o.y - h.y);
          if (!h.bot && magnet && d < h.r * (1.4 + magnet * 0.25) && d > h.r * 0.5) {
            o.x += ((h.x - o.x) / d) * 30 * magnet * dt;
            o.y += ((h.y - o.y) / d) * 30 * magnet * dt;
          }
          if (d < h.r - o.r * 0.4) {
            o.falling = 0.001;
            o.into = h;
            h.mass += o.r * o.r * 1.2;
            h.r = radiusFor(18, h.mass);
            if (!h.bot) {
              s.eaten += 1;
              api.setScore(Math.floor(me.mass));
              if (o.r >= 24) {
                floaters.add(
                  `+${Math.round(o.r * o.r * 1.2)}`,
                  W / 2,
                  H / 2 - me.r * s.camScale - 20,
                  '#c7d2fe',
                  16,
                  0.6,
                );
                api.sfx('score');
              } else api.sfx('tick');
              if (rng.chance(o.r >= 24 ? 0.8 : 0.06)) api.addCoins(o.r >= 36 ? 2 : 1);
            }
            break;
          }
        }
      }
      s.objs = s.objs.filter((o) => o.falling < 0.4);
      // holes eating holes
      for (const a of s.holes)
        for (const b of s.holes) {
          if (a === b || !a.alive || !b.alive) continue;
          if (a.r > b.r * 1.15 && Math.hypot(a.x - b.x, a.y - b.y) < a.r - b.r * 0.5) {
            a.mass += b.mass * 0.6 + 200;
            a.r = radiusFor(18, a.mass);
            if (b === me) {
              s.over = true;
              api.sfx('gameover');
              api.haptic([80, 40, 80]);
              floaters.add(`${a.name} swallowed you!`, W / 2, H / 2 - 60, '#fca5a5', 18, 1.5);
              continueGate(() => {
                s.over = false;
                me.alive = true;
                me.x = clamp(me.x + 300, 100, WORLD - 100);
                me.y = clamp(me.y + 300, 100, WORLD - 100);
              }, finish);
              b.alive = false;
            } else {
              b.alive = false;
              b.respawn = 3;
              if (a === me) {
                s.holesEaten += 1;
                api.setScore(Math.floor(me.mass));
                floaters.add(`Ate ${b.name}!`, W / 2, H / 2 - 60, '#86efac', 18, 1.2);
                api.sfx('powerup');
                api.addCoins(3);
              }
            }
          }
        }
      // refill the city slowly with small stuff
      if (s.objs.length < 400 && rng.chance(dt * 6)) {
        const kind = rng.pick(['person', 'cone', 'car', 'tree', 'bench'] as const);
        s.objs.push({
          kind,
          x: rng.range(20, WORLD - 20),
          y: rng.range(20, WORLD - 20),
          r: SIZES[kind],
          color: rng.pick(['#f472b6', '#60a5fa', '#facc15', '#16a34a']),
          falling: 0,
          into: null,
          vx: 0,
          vy: 0,
        });
      }
      if (s.time <= 0) {
        s.time = 0;
        s.over = true;
        continueGate(() => {
          s.over = false;
          s.time = 20;
          floaters.add('+20 seconds', W / 2, 120, '#86efac', 22, 1.2);
        }, finish);
      }
    }
    particles.update(dt);
    floaters.update(dt);

    // ---------- render ----------
    const target = clamp(1.25 - me.r / 150, 0.38, 1.1);
    s.camScale += (target - s.camScale) * Math.min(1, dt * 2);
    const sc = s.camScale;
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    ctx.translate(-me.x, -me.y);
    const vx0 = me.x - W / 2 / sc - 60;
    const vx1 = me.x + W / 2 / sc + 60;
    const vy0 = me.y - H / 2 / sc - 60;
    const vy1 = me.y + H / 2 / sc + 60;
    ctx.fillStyle = '#334155';
    ctx.fillRect(-400, -400, WORLD + 800, WORLD + 800);
    for (let bx = 0; bx < WORLD; bx += BLOCK)
      for (let by = 0; by < WORLD; by += BLOCK) {
        if (bx > vx1 || bx + BLOCK < vx0 || by > vy1 || by + BLOCK < vy0) continue;
        ctx.fillStyle = '#64748b';
        ctx.fillRect(bx, by, BLOCK, BLOCK);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(bx + ROAD / 2, by + ROAD / 2, BLOCK - ROAD, BLOCK - ROAD);
        ctx.fillStyle = 'rgba(248,250,252,0.5)';
        for (let i = 8; i < BLOCK; i += 30) ctx.fillRect(bx + i, by - 1, 14, 2);
      }
    // holes (under objects)
    for (const h of s.holes) {
      if (!h.alive) continue;
      const [inner] = h.bot ? ['#0b0b0b'] : [lo.skin.colors[0]];
      circle(ctx, h.x, h.y, h.r + 4, h.color);
      circle(ctx, h.x, h.y, h.r, inner);
      const g = ctx.createRadialGradient(h.x, h.y, h.r * 0.2, h.x, h.y, h.r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const o of s.objs) {
      if (o.x < vx0 || o.x > vx1 || o.y < vy0 || o.y > vy1) continue;
      const shrink = o.falling > 0 ? Math.max(0, 1 - o.falling * 2.5) : 1;
      const r = o.r * shrink;
      if (o.kind === 'house' || o.kind === 'tower') {
        fillRoundRect(ctx, o.x - r, o.y - r, r * 2, r * 2, 3, o.color);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(o.x - r, o.y + r * 0.6, r * 2, r * 0.4);
        if (o.kind === 'tower') {
          ctx.fillStyle = 'rgba(30,41,59,0.3)';
          for (let i = -r + 6; i < r - 6; i += 10) ctx.fillRect(o.x - r + 6, o.y + i, r * 2 - 12, 4);
        }
      } else if (o.kind === 'car' || o.kind === 'bus') {
        fillRoundRect(ctx, o.x - r, o.y - r * 0.45, r * 2, r * 0.9, 4, o.color);
        ctx.fillStyle = 'rgba(15,23,42,0.5)';
        ctx.fillRect(o.x + r * 0.3, o.y - r * 0.35, r * 0.4, r * 0.7);
      } else if (o.kind === 'tree') {
        circle(ctx, o.x, o.y, r, '#15803d');
        circle(ctx, o.x - r * 0.3, o.y - r * 0.3, r * 0.5, '#22c55e');
      } else if (o.kind === 'bench') fillRoundRect(ctx, o.x - r, o.y - r * 0.35, r * 2, r * 0.7, 2, o.color);
      else circle(ctx, o.x, o.y, r, o.color);
    }
    for (const h of s.holes) {
      if (!h.alive) continue;
      text(ctx, h.bot ? h.name : 'You', h.x, h.y - h.r - 12, {
        size: 12 / Math.max(0.6, sc),
        weight: 800,
        color: '#fff',
        stroke: 'rgba(0,0,0,0.5)',
        strokeWidth: 3,
      });
    }
    ctx.restore();
    particles.draw(ctx);
    floaters.draw(ctx);
    stick.draw(ctx);

    // HUD
    const low = s.time < 15;
    fillRoundRect(ctx, W / 2 - 40, 10, 80, 32, 12, low ? 'rgba(220,38,38,0.75)' : 'rgba(0,0,0,0.5)');
    const m = Math.floor(Math.max(0, s.time) / 60);
    const sec = Math.floor(Math.max(0, s.time) % 60);
    text(ctx, `${m}:${String(sec).padStart(2, '0')}`, W / 2, 27, { size: 18, weight: 900 });
    const ranking = [...s.holes].sort((a, b) => b.mass - a.mass);
    ranking.slice(0, 5).forEach((h, i) => {
      text(ctx, `${i + 1}. ${h.bot ? h.name : 'You'} · ${Math.floor(h.mass)}`, 10, 56 + i * 16, {
        size: 11,
        align: 'left',
        weight: h.bot ? 600 : 900,
        color: h.bot ? '#e2e8f0' : '#fde047',
        stroke: 'rgba(0,0,0,0.5)',
        strokeWidth: 3,
      });
    });
    hudPill(ctx, W - 10, 10, `${Math.floor(me.mass)}`, { align: 'right', size: 13 });
    if (!s.started) prompt(ctx, 'Drag to move your hole', W / 2, H * 0.75, s.clock, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Black Hole game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
