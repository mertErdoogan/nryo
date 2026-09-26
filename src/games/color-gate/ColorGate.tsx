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
  prompt,
  useGameLoop,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView } from '../../engine';
import { TAU } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const CX = W / 2;
const BALL_R = 11;
const COLORS = ['#22d3ee', '#f472b6', '#facc15', '#8b5cf6'] as const;
const SPACING = 330;

type Kind = 'ring' | 'double' | 'bar' | 'cross';
interface Obstacle {
  kind: Kind;
  y: number;
  speed: number;
  rot: number;
  star: boolean;
  coin: boolean;
  switchY: number;
  switched: boolean;
  passed: boolean;
}

const norm = (a: number) => ((a % TAU) + TAU) % TAU;
const quarter = (a: number) => Math.floor(norm(a) / (Math.PI / 2)) % 4;

export function ColorGate({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const slow = 1 - 0.06 * lo.level('slow');
  const coinChance = 0.3 * (1 + 0.15 * lo.level('lucky'));
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;

  const make = (i: number): Obstacle => {
    const kinds: Kind[] = i < 2 ? ['ring'] : i < 6 ? ['ring', 'bar'] : ['ring', 'bar', 'double', 'cross'];
    const speed = (1.1 + Math.min(1.6, i * 0.06)) * (rng.chance(0.5) ? 1 : -1);
    return {
      kind: rng.pick(kinds),
      y: -i * SPACING - 80,
      speed,
      rot: rng.range(0, TAU),
      star: true,
      coin: rng.chance(coinChance),
      switchY: -i * SPACING - 80 - SPACING / 2,
      switched: false,
      passed: false,
    };
  };

  const s = useRef({
    obs: [] as Obstacle[],
    made: 0,
    y: 220,
    vy: 0,
    camY: 0,
    color: 0,
    stars: 0,
    coins: 0,
    shields: lo.level('shield'),
    invuln: 0,
    started: false,
    dead: false,
    deadT: 0,
    clock: 0,
    trail: [] as number[],
  }).current;
  if (s.obs.length === 0) {
    for (let i = 0; i < 4; i++) s.obs.push(make(s.made++));
  }

  const hop = () => {
    if (s.dead) return;
    s.started = true;
    s.vy = -500;
    api.sfx('tap');
  };
  useKeyDown((code) => {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') hop();
  }, !paused);

  const hit = () => {
    if (s.invuln > 0) return;
    if (s.shields > 0) {
      s.shields -= 1;
      s.invuln = 0.8;
      fx.current.floaters.add('Prism shield!', CX, s.y - s.camY - 40, '#e9d5ff', 18);
      api.sfx('hit');
      return;
    }
    s.dead = true;
    s.deadT = 0.8;
    fx.current.shake.add(12);
    fx.current.particles.burst(CX, s.y - s.camY, { count: 40, colors: [...COLORS], speed: 260, life: 0.8 });
    api.sfx('explode');
    api.haptic([60, 30, 60]);
  };

  /** Color of the obstacle segment the ball overlaps, or null when clear. */
  const touching = (o: Obstacle): number | null => {
    const dy = s.y - o.y;
    if (o.kind === 'ring' || o.kind === 'double') {
      const rings =
        o.kind === 'ring'
          ? [{ r: 92, rot: o.rot }]
          : [
              { r: 92, rot: o.rot },
              { r: 66, rot: -o.rot },
            ];
      for (const ring of rings) {
        if (Math.abs(Math.abs(dy) - ring.r) < 7 + BALL_R) {
          const ang = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
          return quarter(ang - ring.rot);
        }
      }
    } else if (o.kind === 'bar') {
      if (Math.abs(dy) < 7 + BALL_R) {
        const segW = W / 2;
        const off = (((o.rot * 60) % (segW * 4)) + segW * 4) % (segW * 4);
        return Math.floor(((CX - off + segW * 8) % (segW * 4)) / segW);
      }
    } else if (o.kind === 'cross') {
      // X centred left of the ball's path; arms sweep through it
      const cx = CX - 70;
      const dx = CX - cx;
      const dist = Math.hypot(dx, dy);
      if (dist < 100 + BALL_R) {
        const ang = Math.atan2(dy, dx);
        for (let a = 0; a < 4; a++) {
          const arm = o.rot + (a * Math.PI) / 2;
          const diff = Math.abs(((ang - arm + Math.PI * 3) % TAU) - Math.PI);
          if (diff * dist < 7 + BALL_R) return a;
        }
      }
    }
    return null;
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    for (const o of s.obs) o.rot += o.speed * slow * dt;

    if (s.started && !s.dead) {
      s.invuln = Math.max(0, s.invuln - dt);
      s.vy = Math.min(700, s.vy + 1350 * dt);
      s.y += s.vy * dt;
      s.camY = Math.min(s.camY, s.y - H * 0.55);
      if (s.y - s.camY > H + 20) {
        s.invuln = 0;
        s.shields = 0;
        hit();
      }
      for (const o of s.obs) {
        const c = touching(o);
        if (c !== null && c !== s.color) hit();
        if (o.star && Math.abs(s.y - o.y) < 18) {
          o.star = false;
          s.stars += 1;
          api.setScore(s.stars);
          api.sfx('score');
          floaters.add('+1', CX + 24, o.y - s.camY, '#fff', 18, 0.6);
        }
        if (o.coin && Math.abs(s.y - (o.switchY + 60)) < 18) {
          o.coin = false;
          s.coins += 1;
          api.addCoins(1);
          api.sfx('coin');
        }
        if (!o.switched && Math.abs(s.y - o.switchY) < 16) {
          o.switched = true;
          const next = s.obs.find((n) => n.y < o.switchY);
          const options = [0, 1, 2, 3].filter((k) => k !== s.color);
          s.color = next ? rng.pick(options) : options[0]!;
          particles.burst(CX, o.switchY - s.camY, { count: 16, colors: [...COLORS], speed: 160, life: 0.5 });
          api.sfx('swap');
        }
      }
      while (s.obs.length < 5 || s.obs[s.obs.length - 1]!.y > s.camY - H) s.obs.push(make(s.made++));
      s.obs = s.obs.filter((o) => o.y < s.camY + H + 200);
      s.trail.push(s.y);
      if (s.trail.length > 12) s.trail.shift();
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.dead = false;
            s.invuln = 2;
            s.vy = -500;
            s.y = Math.min(s.y, s.camY + H * 0.7);
          },
          () =>
            api.gameOver({
              score: s.stars,
              stats: [
                { label: 'Stars', value: String(s.stars) },
                { label: 'Coins', value: String(s.coins) },
              ],
            }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    ctx.lineCap = 'butt';
    for (const o of s.obs) {
      const y = o.y - s.camY;
      if (y < -160 || y > H + 160) continue;
      if (o.kind === 'ring' || o.kind === 'double') {
        const rings =
          o.kind === 'ring'
            ? [{ r: 92, rot: o.rot }]
            : [
                { r: 92, rot: o.rot },
                { r: 66, rot: -o.rot },
              ];
        for (const ring of rings) {
          for (let q = 0; q < 4; q++) {
            ctx.strokeStyle = COLORS[q]!;
            ctx.lineWidth = 14;
            ctx.beginPath();
            ctx.arc(
              CX,
              y,
              ring.r,
              ring.rot + (q * Math.PI) / 2 + 0.02,
              ring.rot + ((q + 1) * Math.PI) / 2 - 0.02,
            );
            ctx.stroke();
          }
        }
      } else if (o.kind === 'bar') {
        const segW = W / 2;
        const off = (((o.rot * 60) % (segW * 4)) + segW * 4) % (segW * 4);
        for (let k = -4; k < 4; k++) {
          ctx.fillStyle = COLORS[((k % 4) + 4) % 4]!;
          ctx.fillRect(off + k * segW, y - 7, segW - 2, 14);
        }
      } else {
        const cx = CX - 70;
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        for (let a = 0; a < 4; a++) {
          const arm = o.rot + (a * Math.PI) / 2;
          ctx.strokeStyle = COLORS[a]!;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(arm) * 8, y + Math.sin(arm) * 8);
          ctx.lineTo(cx + Math.cos(arm) * 100, y + Math.sin(arm) * 100);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
      if (o.star) {
        ctx.save();
        ctx.translate(CX, y);
        ctx.rotate(Math.sin(s.clock * 2) * 0.2);
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 6 : 14;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.fill();
        ctx.restore();
      }
      if (!o.switched) {
        const sy = o.switchY - s.camY;
        for (let q = 0; q < 4; q++) {
          ctx.fillStyle = COLORS[q]!;
          ctx.beginPath();
          ctx.moveTo(CX, sy);
          ctx.arc(CX, sy, 13, s.clock * 2 + (q * Math.PI) / 2, s.clock * 2 + ((q + 1) * Math.PI) / 2);
          ctx.fill();
        }
      }
      if (o.coin) drawCoin(ctx, CX, o.switchY + 60 - s.camY, 9, s.clock);
    }
    if (!s.dead) {
      const [t0, t1] = lo.skin.colors;
      s.trail.forEach((ty, i) => {
        ctx.globalAlpha = (i / s.trail.length) * 0.5;
        circle(ctx, CX, ty - s.camY + 6, BALL_R * (i / s.trail.length), i % 2 ? t0 : t1);
      });
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 12) % 2 ? 0.4 : 1;
      circle(ctx, CX, s.y - s.camY, BALL_R, COLORS[s.color]!);
      circle(ctx, CX - 3, s.y - s.camY - 3, 3.5, 'rgba(255,255,255,0.6)');
      if (s.shields > 0) {
        ctx.strokeStyle = 'rgba(233,213,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(CX, s.y - s.camY, BALL_R + 6, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();
    hudPill(ctx, 10, 10, `★ ${s.stars}`, { size: 16 });
    hudPill(ctx, W - 10, 10, String(s.coins), { align: 'right', coin: true, size: 14 });
    if (!s.started) prompt(ctx, 'Tap to hop', CX, H * 0.8, s.clock, 20);
  }, !paused);

  return <CanvasStage ref={view} width={W} height={H} label="Color Gate game area" onPointerDown={hop} />;
}
