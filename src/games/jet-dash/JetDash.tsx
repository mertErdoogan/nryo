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
  hudPill,
  prompt,
  text,
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView } from '../../engine';
import { clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const H = 480;
const CEIL = 24;
const FLOOR = H - 40;
const PLAYER_X = 100;
const R = 14;
const PX_PER_M = 10;

interface Zapper {
  x: number;
  y: number;
  len: number;
  angle: number;
  spin: number;
}
interface Missile {
  y: number;
  x: number;
  warn: number;
}
interface Coin {
  x: number;
  y: number;
  taken: boolean;
  double: boolean;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export function JetDash({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const magnet = lo.level('magnet') > 0 ? 50 + 30 * lo.level('magnet') : 0;
  const lucky = 0.15 * lo.level('lucky');
  const fx = useRef({
    particles: new Particles(400, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    y: FLOOR - R,
    vy: 0,
    dist: 0,
    speed: 230,
    zappers: [] as Zapper[],
    missiles: [] as Missile[],
    coins: [] as Coin[],
    nextObstacle: 500,
    shields: lo.level('shield'),
    boost: lo.level('boost') * 150 * PX_PER_M,
    invuln: 0,
    dead: false,
    deadT: 0,
    started: false,
    holding: false,
    coinCount: 0,
    score: 0,
    clock: 0,
  }).current;

  const W = () => view.current?.width ?? 360;

  const spawn = () => {
    const w = W();
    const x = s.dist + w + 60;
    const m = s.dist / PX_PER_M;
    const r = rng.next();
    if (r < 0.55) {
      const len = rng.range(70, 150);
      const angle = rng.pick([0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]);
      const spin = m > 400 && rng.chance(0.3) ? rng.range(0.8, 1.8) * (rng.chance(0.5) ? 1 : -1) : 0;
      s.zappers.push({ x, y: rng.range(CEIL + len / 2, FLOOR - len / 2), len, angle, spin });
      if (m > 250 && rng.chance(0.35)) {
        const len2 = rng.range(70, 120);
        s.zappers.push({
          x: x + rng.range(140, 220),
          y: rng.range(CEIL + len2 / 2, FLOOR - len2 / 2),
          len: len2,
          angle: rng.pick([0, Math.PI / 2]),
          spin: 0,
        });
      }
    } else if (r < 0.75 && m > 120) {
      s.missiles.push({ y: s.y, x: w + 400, warn: 1.1 });
    } else {
      const rows = rng.int(2, 4);
      const cols = rng.int(4, 8);
      const y0 = rng.range(CEIL + 30, FLOOR - 30 - rows * 22);
      const wave = rng.chance(0.4);
      for (let c = 0; c < cols; c++)
        for (let rr = 0; rr < (wave ? 1 : rows); rr++)
          s.coins.push({
            x: x + c * 24,
            y: wave ? y0 + Math.sin(c * 0.8) * 40 + 40 : y0 + rr * 22,
            taken: false,
            double: rng.chance(lucky),
          });
    }
    s.nextObstacle = s.dist + Math.max(170, 330 - m * 0.08) * rng.range(0.8, 1.25);
  };

  const hit = () => {
    const { shake, particles } = fx.current;
    if (s.invuln > 0 || s.boost > 0) return;
    if (s.shields > 0) {
      s.shields -= 1;
      s.invuln = 1.2;
      shake.add(8);
      api.sfx('hit');
      fx.current.floaters.add('Shield popped!', PLAYER_X + 40, s.y - 30, '#93c5fd', 16);
      return;
    }
    s.dead = true;
    s.deadT = 1;
    shake.add(16);
    particles.burst(PLAYER_X, s.y, {
      count: 40,
      colors: ['#fde047', '#fff', lo.skin.colors[0]],
      speed: 260,
      life: 0.7,
    });
    api.sfx('explode');
    api.haptic([80, 40, 80]);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const width = v.width;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    const thrust = s.holding || k.has('Space') || k.has('ArrowUp') || k.has('KeyW');
    if (thrust) s.started = true;

    if (s.started && !s.dead) {
      const boosting = s.boost > 0;
      s.speed = boosting ? 900 : Math.min(520, 230 + s.dist * 0.004);
      const dx = s.speed * dt;
      s.dist += dx;
      if (boosting) {
        s.boost = Math.max(0, s.boost - dx);
        s.y += (H / 2 - s.y) * Math.min(1, dt * 3);
        s.vy = 0;
        if (s.boost === 0) s.invuln = 1;
      } else {
        s.vy += (thrust ? -1500 : 1150) * dt;
        s.vy = clamp(s.vy, -430, 520);
        s.y += s.vy * dt;
      }
      if (s.y < CEIL + R) {
        s.y = CEIL + R;
        s.vy = Math.max(0, s.vy);
      }
      if (s.y > FLOOR - R) {
        s.y = FLOOR - R;
        s.vy = Math.min(0, s.vy);
      }
      s.invuln = Math.max(0, s.invuln - dt);
      if (s.dist > s.nextObstacle) spawn();

      for (const z of s.zappers) {
        z.angle += z.spin * dt;
        const zx = z.x - s.dist;
        const hx = (Math.cos(z.angle) * z.len) / 2;
        const hy = (Math.sin(z.angle) * z.len) / 2;
        if (
          Math.abs(zx - PLAYER_X) < z.len &&
          segDist(PLAYER_X, s.y, zx - hx, z.y - hy, zx + hx, z.y + hy) < R + 6
        )
          hit();
      }
      s.zappers = s.zappers.filter((z) => z.x - s.dist > -200);
      for (const m of s.missiles) {
        if (m.warn > 0) {
          m.warn -= dt;
          m.y += (s.y - m.y) * Math.min(1, dt * 3);
          if (m.warn <= 0) {
            m.x = width + 30;
            api.sfx('shoot');
          }
        } else {
          m.x -= (s.speed + 520) * dt;
          if (Math.abs(m.x - PLAYER_X) < 22 && Math.abs(m.y - s.y) < 14) {
            m.x = -500;
            hit();
          }
        }
      }
      s.missiles = s.missiles.filter((m) => m.x > -100);
      for (const c of s.coins) {
        if (c.taken) continue;
        const cx = c.x - s.dist;
        const d = Math.hypot(cx - PLAYER_X, c.y - s.y);
        if (magnet && d < magnet) {
          c.x -= (cx - PLAYER_X) * Math.min(1, dt * 10);
          c.y += (s.y - c.y) * Math.min(1, dt * 10);
        }
        if (d < R + 10) {
          c.taken = true;
          const n = c.double ? 2 : 1;
          s.coinCount += n;
          api.addCoins(n);
          api.sfx('coin');
          if (c.double) floaters.add('×2', PLAYER_X + 20, s.y - 20, '#fde047', 14, 0.5);
        }
      }
      s.coins = s.coins.filter((c) => !c.taken && c.x - s.dist > -40);
      if (thrust && !boosting && rng.chance(0.9))
        particles.burst(PLAYER_X - 12, s.y + 18, {
          count: 2,
          colors: ['#fde68a', '#fb923c', '#f97316'],
          speed: 220,
          angle: Math.PI / 2 + 0.3,
          spread: 0.5,
          life: 0.3,
          size: 6,
        });
      if (boosting)
        particles.burst(PLAYER_X - 20, s.y, {
          count: 3,
          colors: ['#a5f3fc', '#fff'],
          speed: 300,
          angle: Math.PI,
          spread: 0.4,
          life: 0.3,
          size: 6,
        });
      const m = Math.floor(s.dist / PX_PER_M);
      if (m !== s.score) {
        s.score = m;
        api.setScore(m);
      }
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= dt;
      s.y = Math.min(FLOOR - R, s.y + 300 * dt);
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.dead = false;
            s.invuln = 2;
            s.vy = -200;
            s.missiles = [];
            s.zappers = s.zappers.filter((z) => z.x - s.dist > width * 0.9);
          },
          () =>
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Distance', value: `${s.score} m` },
                { label: 'Coins', value: String(s.coinCount) },
              ],
            }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, width, H);
    ctx.save();
    shake.apply(ctx);
    // background lab panels (parallax)
    const par = s.dist * 0.4;
    for (let i = -1; i < width / 160 + 2; i++) {
      const bx = i * 160 - (par % 160);
      fillRoundRect(ctx, bx + 16, 60, 120, 90, 8, '#262262');
      fillRoundRect(ctx, bx + 26, 70, 100, 70, 6, '#1a1745');
      ctx.fillStyle = '#312e81';
      ctx.fillRect(bx + 70, 180, 20, FLOOR - 180);
      ctx.fillStyle = 'rgba(56,189,248,0.25)';
      ctx.fillRect(bx + 36, 80 + ((i * 17) % 40), 50, 4);
    }
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, FLOOR, width, H - FLOOR);
    ctx.fillRect(0, 0, width, CEIL);
    ctx.fillStyle = '#475569';
    for (let x = -(s.dist % 40); x < width; x += 40) {
      ctx.fillRect(x, FLOOR, 20, 4);
      ctx.fillRect(x + 20, CEIL - 4, 20, 4);
    }
    for (const c of s.coins) {
      const cx = c.x - s.dist;
      if (cx > -20 && cx < width + 20) drawCoin(ctx, cx, c.y, c.double ? 10 : 8, s.clock + c.x * 0.01);
    }
    for (const z of s.zappers) {
      const zx = z.x - s.dist;
      if (zx < -200 || zx > width + 200) continue;
      const hx = (Math.cos(z.angle) * z.len) / 2;
      const hy = (Math.sin(z.angle) * z.len) / 2;
      ctx.strokeStyle = 'rgba(253,224,71,0.35)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(zx - hx, z.y - hy);
      ctx.lineTo(zx + hx, z.y + hy);
      ctx.stroke();
      ctx.strokeStyle = '#fef9c3';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const j = i === 0 || i === steps ? 0 : Math.sin(s.clock * 40 + i * 2) * 5;
        const px = zx - hx + hx * 2 * t - Math.sin(z.angle) * j;
        const py = z.y - hy + hy * 2 * t + Math.cos(z.angle) * j;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      circle(ctx, zx - hx, z.y - hy, 10, '#facc15');
      circle(ctx, zx + hx, z.y + hy, 10, '#facc15');
      circle(ctx, zx - hx, z.y - hy, 5, '#a16207');
      circle(ctx, zx + hx, z.y + hy, 5, '#a16207');
    }
    for (const m of s.missiles) {
      if (m.warn > 0) {
        const blink = Math.floor(s.clock * 10) % 2 === 0;
        fillRoundRect(ctx, width - 44, m.y - 16, 32, 32, 8, blink ? '#dc2626' : '#7f1d1d');
        text(ctx, '!', width - 28, m.y + 1, { size: 22, weight: 900 });
      } else {
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(m.x - 20, m.y);
        ctx.lineTo(m.x, m.y - 8);
        ctx.lineTo(m.x + 30, m.y - 8);
        ctx.lineTo(m.x + 30, m.y + 8);
        ctx.lineTo(m.x, m.y + 8);
        ctx.fill();
        particles.burst(m.x + 32, m.y, {
          count: 1,
          colors: ['#f97316', '#fde047'],
          speed: 120,
          angle: 0,
          spread: 0.4,
          life: 0.25,
          size: 5,
        });
      }
    }
    // player
    if (!s.dead || s.deadT > 0.7) {
      const [c0, c1, c2] = lo.skin.colors;
      ctx.save();
      ctx.translate(PLAYER_X, s.y);
      ctx.rotate(clamp(s.vy / 1600, -0.25, 0.3));
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 14) % 2 ? 0.45 : 1;
      fillRoundRect(ctx, -18, -10, 12, 26, 4, c1);
      fillRoundRect(ctx, -8, -14, 20, 28, 7, c0);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-4, 12, 5, 8);
      ctx.fillRect(5, 12, 5, 8);
      circle(ctx, 2, -21, 10, '#fcd34d');
      fillRoundRect(ctx, -2, -25, 13, 7, 3, '#0f172a');
      ctx.fillStyle = c2;
      ctx.fillRect(-16, -6, 8, 3);
      if (s.shields > 0 || s.boost > 0) {
        ctx.strokeStyle = s.boost > 0 ? 'rgba(165,243,252,0.9)' : 'rgba(147,197,253,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -2, 28, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    hudPill(ctx, 10, 32, `${s.score} m`, { size: 14 });
    hudPill(ctx, width - 10, 32, String(s.coinCount), { align: 'right', coin: true, size: 14 });
    if (!s.started) prompt(ctx, 'Hold to fly', width / 2, H * 0.45, s.clock, 22);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={360}
      height={H}
      fit="fill"
      minAspect={0.75}
      maxAspect={2.2}
      label="Jet Dash game area"
      onPointerDown={() => {
        s.holding = true;
        s.started = true;
      }}
      onPointerUp={() => {
        s.holding = false;
      }}
    />
  );
}
