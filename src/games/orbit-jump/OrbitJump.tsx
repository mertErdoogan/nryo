import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  circle,
  createContinueGate,
  drawCoin,
  hudPill,
  makeStars,
  prompt,
  shade,
  useGameLoop,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView } from '../../engine';
import { TAU } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const LAUNCH_SPEED = 470;
const PLANET_COLORS = [
  '#3b82f6',
  '#f97316',
  '#22c55e',
  '#a855f7',
  '#ef4444',
  '#14b8a6',
  '#eab308',
  '#ec4899',
];

interface Planet {
  x: number;
  y: number;
  r: number;
  spin: number;
  color: string;
  rocks: { a: number; dist: number; speed: number; r: number }[];
  visited: boolean;
}

export function OrbitJump({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const catchBonus = 8 * lo.level('gravity');
  const guide = lo.level('guide');
  const magnet = lo.level('magnet') > 0 ? 30 + 20 * lo.level('magnet') : 0;
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const stars = useRef(makeStars(rng, 70, W, H)).current;

  const makePlanet = (prev: Planet | null, i: number): Planet => {
    const r = rng.range(22, 38);
    const x = prev ? Math.max(60, Math.min(W - 60, prev.x + rng.range(-150, 150))) : W / 2;
    const y = prev ? prev.y - rng.range(170, 230 + Math.min(40, i)) : H - 170;
    const rocks: Planet['rocks'] = [];
    if (i > 4 && rng.chance(Math.min(0.6, 0.15 + i / 60)))
      for (let k = rng.int(1, 2); k > 0; k--)
        rocks.push({
          a: rng.range(0, TAU),
          dist: r + rng.range(48, 64),
          speed: rng.range(0.8, 1.6) * (rng.chance(0.5) ? 1 : -1),
          r: rng.range(6, 10),
        });
    return {
      x,
      y,
      r,
      spin: rng.range(1.6, 2.4 + Math.min(1.2, i / 25)) * (rng.chance(0.5) ? 1 : -1),
      color: rng.pick(PLANET_COLORS),
      rocks,
      visited: i === 0,
    };
  };

  const s = useRef({
    planets: [] as Planet[],
    coins: [] as { x: number; y: number; taken: boolean }[],
    on: 0 as number | null,
    theta: -Math.PI / 2,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    camY: 0,
    score: 0,
    coinCount: 0,
    shields: lo.level('shield'),
    invuln: 0,
    dead: false,
    deadT: 0,
    started: false,
    lastPlanet: 0,
    clock: 0,
    trail: [] as { x: number; y: number }[],
  }).current;
  if (s.planets.length === 0) {
    let prev: Planet | null = null;
    for (let i = 0; i < 6; i++) {
      const p = makePlanet(prev, i);
      if (prev && rng.chance(0.6)) {
        for (let k = 1; k <= 3; k++)
          s.coins.push({
            x: prev.x + ((p.x - prev.x) * k) / 4,
            y: prev.y + ((p.y - prev.y) * k) / 4,
            taken: false,
          });
      }
      s.planets.push(p);
      prev = p;
    }
    s.camY = s.planets[0]!.y - H * 0.7;
  }

  const orbitR = (p: Planet) => p.r + 24;

  const launch = () => {
    s.started = true;
    if (s.dead || s.on === null) return;
    s.vx = Math.cos(s.theta) * LAUNCH_SPEED;
    s.vy = Math.sin(s.theta) * LAUNCH_SPEED;
    s.lastPlanet = s.on;
    s.on = null;
    api.sfx('jump');
  };
  useKeyDown((code) => {
    if (code === 'Space' || code === 'ArrowUp' || code === 'Enter') launch();
  }, !paused);

  const die = (why: 'rock' | 'lost') => {
    if (why === 'rock' && s.invuln > 0) return;
    if (why === 'rock' && s.shields > 0) {
      s.shields -= 1;
      s.invuln = 1;
      fx.current.floaters.add('Deflected!', s.x, s.y - s.camY - 30, '#93c5fd', 16);
      api.sfx('hit');
      return;
    }
    s.dead = true;
    s.deadT = 0.8;
    fx.current.shake.add(10);
    fx.current.particles.burst(s.x, s.y - s.camY, {
      count: 30,
      colors: [lo.skin.colors[0], lo.skin.colors[1], '#fde047'],
      speed: 220,
      life: 0.7,
    });
    api.sfx(why === 'rock' ? 'explode' : 'miss');
    api.haptic([60, 30, 60]);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    for (const p of s.planets) for (const rk of p.rocks) rk.a += rk.speed * dt;

    if (!s.dead) {
      s.invuln = Math.max(0, s.invuln - dt);
      if (s.on !== null) {
        const p = s.planets[s.on]!;
        s.theta += p.spin * dt;
        s.x = p.x + Math.cos(s.theta) * orbitR(p);
        s.y = p.y + Math.sin(s.theta) * orbitR(p);
        const target = p.y - H * 0.65;
        s.camY += (target - s.camY) * Math.min(1, dt * 3);
      } else {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 16) s.trail.shift();
        for (let i = 0; i < s.planets.length; i++) {
          if (i === s.lastPlanet) continue;
          const p = s.planets[i]!;
          const d = Math.hypot(s.x - p.x, s.y - p.y);
          if (d < orbitR(p) + 8 + catchBonus) {
            s.on = i;
            s.theta = Math.atan2(s.y - p.y, s.x - p.x);
            s.trail = [];
            if (!p.visited) {
              p.visited = true;
              s.score += 1;
              api.setScore(s.score);
              floaters.add('+1', p.x, p.y - p.r - 30 - s.camY, '#bfdbfe', 20, 0.7);
              api.sfx('score');
            } else api.sfx('tap');
            particles.burst(s.x, s.y - s.camY, { count: 12, color: p.color, speed: 120, life: 0.4 });
            break;
          }
        }
        if (s.on === null && (s.x < -30 || s.x > W + 30 || s.y - s.camY > H + 30 || s.y - s.camY < -120))
          die('lost');
      }
      for (const p of s.planets)
        for (const rk of p.rocks) {
          const rx = p.x + Math.cos(rk.a) * rk.dist;
          const ry = p.y + Math.sin(rk.a) * rk.dist;
          if (Math.hypot(rx - s.x, ry - s.y) < rk.r + 7) die('rock');
        }
      for (const c of s.coins) {
        if (c.taken) continue;
        const d = Math.hypot(c.x - s.x, c.y - s.y);
        if (magnet && d < magnet) {
          c.x += (s.x - c.x) * Math.min(1, dt * 8);
          c.y += (s.y - c.y) * Math.min(1, dt * 8);
        }
        if (d < 18) {
          c.taken = true;
          s.coinCount += 1;
          api.addCoins(1);
          api.sfx('coin');
        }
      }
      // extend the galaxy
      while (s.planets[s.planets.length - 1]!.y > s.camY - H) {
        const prev = s.planets[s.planets.length - 1]!;
        const p = makePlanet(prev, s.planets.length);
        if (rng.chance(0.55))
          for (let k = 1; k <= 3; k++)
            s.coins.push({
              x: prev.x + ((p.x - prev.x) * k) / 4,
              y: prev.y + ((p.y - prev.y) * k) / 4,
              taken: false,
            });
        s.planets.push(p);
      }
    } else if (s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.dead = false;
            s.on = s.lastPlanet;
            s.theta = -Math.PI / 2;
            s.invuln = 1.5;
            s.trail = [];
            const p = s.planets[s.lastPlanet]!;
            for (const rk of p.rocks) rk.a += Math.PI;
          },
          () =>
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Planets', value: String(s.score) },
                { label: 'Coins', value: String(s.coinCount) },
              ],
            }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, W, H);
    for (const st of stars) {
      const y = (((st.y - s.camY * 0.2 * st.speed) % H) + H) % H;
      ctx.globalAlpha = st.alpha;
      ctx.fillStyle = '#fff';
      ctx.fillRect(st.x, y, st.r, st.r);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    shake.apply(ctx);
    ctx.translate(0, -s.camY);
    for (const p of s.planets) {
      if (p.y - s.camY < -120 || p.y - s.camY > H + 120) continue;
      ctx.strokeStyle = 'rgba(148,163,184,0.25)';
      ctx.setLineDash([4, 7]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, orbitR(p), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      circle(ctx, p.x, p.y, p.r + 6, shade(p.color, -0.5) + '55');
      circle(ctx, p.x, p.y, p.r, p.color);
      circle(ctx, p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.35, shade(p.color, 0.25));
      circle(ctx, p.x + p.r * 0.35, p.y + p.r * 0.2, p.r * 0.18, shade(p.color, -0.25));
      for (const rk of p.rocks) {
        const rx = p.x + Math.cos(rk.a) * rk.dist;
        const ry = p.y + Math.sin(rk.a) * rk.dist;
        circle(ctx, rx, ry, rk.r, '#78716c');
        circle(ctx, rx - 2, ry - 2, rk.r * 0.4, '#a8a29e');
      }
    }
    for (const c of s.coins) if (!c.taken) drawCoin(ctx, c.x, c.y, 8, s.clock + c.x);
    // aim guide
    if (guide > 0 && s.on !== null && !s.dead) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.setLineDash([3, 7]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(s.theta) * 70 * guide, s.y + Math.sin(s.theta) * 70 * guide);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!s.dead) {
      s.trail.forEach((t, i) => {
        ctx.globalAlpha = (i / s.trail.length) * 0.6;
        circle(ctx, t.x, t.y, 3 + (i / s.trail.length) * 3, '#fde047');
      });
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 12) % 2 ? 0.4 : 1;
      const [c0, c1, c2] = lo.skin.colors;
      const heading = s.on !== null ? s.theta : Math.atan2(s.vy, s.vx);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(heading + Math.PI / 2);
      ctx.fillStyle = c0;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.quadraticCurveTo(9, -2, 7, 10);
      ctx.lineTo(-7, 10);
      ctx.quadraticCurveTo(-9, -2, 0, -14);
      ctx.fill();
      ctx.fillStyle = c1;
      ctx.fillRect(-9, 4, 4, 8);
      ctx.fillRect(5, 4, 4, 8);
      circle(ctx, 0, -3, 3.5, c2);
      if (s.on === null) {
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.moveTo(-4, 10);
        ctx.lineTo(0, 18 + Math.random() * 6);
        ctx.lineTo(4, 10);
        ctx.fill();
      }
      ctx.restore();
      if (s.shields > 0) {
        ctx.strokeStyle = 'rgba(147,197,253,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 18, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    particles.draw(ctx);
    floaters.draw(ctx);
    hudPill(ctx, 10, 10, `🪐 ${s.score}`, { size: 16 });
    hudPill(ctx, W - 10, 10, String(s.coinCount), { align: 'right', coin: true, size: 14 });
    if (!s.started) prompt(ctx, 'Tap to launch', W / 2, H * 0.9, s.clock, 20);
  }, !paused);

  return <CanvasStage ref={view} width={W} height={H} label="Orbit Jump game area" onPointerDown={launch} />;
}
