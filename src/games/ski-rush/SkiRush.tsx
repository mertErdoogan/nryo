import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  createContinueGate,
  drawCoin,
  fillRoundRect,
  hudPill,
  prompt,
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const SKIER_Y = 190;

type Kind = 'tree' | 'rock' | 'gate' | 'ramp' | 'coin' | 'log';
interface Obj {
  kind: Kind;
  x: number;
  y: number;
  r: number;
  done: boolean;
  gap?: number;
}

export function SkiRush({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const turnRate = 2.6 * (1 + 0.1 * lo.level('skis'));
  const speedMul = 1 + 0.06 * lo.level('wax');
  const magnet = 20 + 12 * lo.level('magnet');
  const fx = useRef({
    particles: new Particles(400, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    x: W / 2,
    y: 0,
    angle: 0,
    speed: 0,
    objs: [] as Obj[],
    nextSpawn: 300,
    gates: 0,
    jumps: 0,
    coins: 0,
    bonus: 0,
    score: 0,
    air: 0,
    invuln: 0,
    shields: lo.level('helmet'),
    crashed: false,
    crashT: 0,
    started: false,
    clock: 0,
    trail: [] as { x: number; y: number }[],
    touches: new Map<number, number>(),
    drag: null as null | { id: number; px: number; a: number },
    target: null as number | null,
  }).current;

  const spawnRow = (y: number) => {
    const d = s.y / 10;
    const density = Math.min(0.85, 0.3 + d / 2500);
    const roll = rng.next();
    if (roll < 0.14) {
      const gap = Math.max(70, 110 - d / 60);
      const cx = rng.range(60 + gap / 2, W - 60 - gap / 2);
      s.objs.push({ kind: 'gate', x: cx, y, r: 6, done: false, gap });
    } else if (roll < 0.2 && d > 60) {
      s.objs.push({ kind: 'ramp', x: rng.range(50, W - 50), y, r: 26, done: false });
    } else if (roll < 0.34) {
      const cx = rng.range(40, W - 40);
      for (let i = 0; i < 4; i++) s.objs.push({ kind: 'coin', x: cx, y: y + i * 26, r: 9, done: false });
    }
    const n = rng.chance(density) ? rng.int(1, 2 + Math.floor(d / 700)) : 0;
    for (let i = 0; i < n; i++) {
      const kind: Kind = d > 150 && rng.chance(0.12) ? 'log' : rng.chance(0.75) ? 'tree' : 'rock';
      s.objs.push({
        kind,
        x: rng.range(10, W - 10),
        y: y + rng.range(-30, 30),
        r: kind === 'tree' ? 14 : kind === 'log' ? 40 : 12,
        done: false,
      });
    }
  };

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.drag = { id: p.id, px: p.x, a: s.angle };
    s.touches.set(p.id, p.x < W / 2 ? -1 : 1);
  };
  const onMove = (p: StagePointer) => {
    if (s.drag?.id === p.id && Math.abs(p.x - s.drag.px) > 14) {
      s.touches.delete(p.id);
      s.target = clamp(s.drag.a + (p.x - s.drag.px) / 90, -1.25, 1.25);
    }
  };
  const onUp = (p: StagePointer) => {
    s.touches.delete(p.id);
    if (s.drag?.id === p.id) s.drag = null;
  };

  const finish = () =>
    api.gameOver({
      score: s.score,
      stats: [
        { label: 'Distance', value: `${Math.floor(s.y / 10)} m` },
        { label: 'Gates', value: String(s.gates) },
        { label: 'Jumps', value: String(s.jumps) },
        { label: 'Coins', value: String(s.coins) },
      ],
    });

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    let steer =
      (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    for (const t of s.touches.values()) steer += t;
    if (steer !== 0) {
      s.started = true;
      s.target = null;
    }

    if (s.started && !s.crashed) {
      // angle: 0 = straight down, positive = towards the right
      if (s.target !== null) s.angle += clamp(s.target - s.angle, -turnRate * dt, turnRate * dt);
      else s.angle = clamp(s.angle + clamp(steer, -1, 1) * turnRate * dt, -1.3, 1.3);
      const vmax = (230 + Math.min(260, s.y / 60)) * speedMul;
      const want = vmax * (0.25 + 0.75 * Math.cos(s.angle));
      s.speed += (want - s.speed) * Math.min(1, dt * (want > s.speed ? 1.4 : 3));
      s.x += Math.sin(s.angle) * s.speed * dt;
      s.y += Math.cos(s.angle) * s.speed * dt;
      if (s.x < 12 || s.x > W - 12) {
        s.x = clamp(s.x, 12, W - 12);
        s.angle *= 0.5;
      }
      s.air = Math.max(0, s.air - dt);
      s.invuln = Math.max(0, s.invuln - dt);
      while (s.nextSpawn < s.y + H) {
        spawnRow(s.nextSpawn);
        s.nextSpawn += rng.range(70, 120);
      }
      for (const o of s.objs) {
        if (o.done) continue;
        const sy = o.y - s.y + SKIER_Y;
        if (o.kind === 'coin') {
          if (Math.hypot(o.x - s.x, sy - SKIER_Y) < magnet) {
            o.done = true;
            s.coins += 1;
            api.addCoins(1);
            api.sfx('coin');
          }
        } else if (o.kind === 'gate') {
          if (sy < SKIER_Y) {
            o.done = true;
            if (Math.abs(s.x - o.x) < o.gap! / 2) {
              s.gates += 1;
              s.bonus += 50;
              floaters.add('Gate +50', o.x, SKIER_Y + 30, '#93c5fd', 18);
              api.sfx('score');
            }
          }
        } else if (o.kind === 'ramp') {
          if (Math.abs(sy - SKIER_Y) < 14 && Math.abs(o.x - s.x) < o.r && s.air <= 0) {
            o.done = true;
            s.air = 0.9;
            s.jumps += 1;
            s.bonus += 30;
            floaters.add('Big air +30', s.x, SKIER_Y - 30, '#fde68a', 18);
            api.sfx('jump');
          }
        } else if (s.air <= 0 && s.invuln <= 0) {
          const hit =
            o.kind === 'log'
              ? Math.abs(sy - SKIER_Y) < 10 && Math.abs(o.x - s.x) < o.r
              : Math.hypot(o.x - s.x, sy - (SKIER_Y + 6)) < o.r + 6;
          if (hit) {
            o.done = true;
            shake.add(12);
            particles.burst(s.x, SKIER_Y, {
              count: 30,
              colors: ['#fff', '#e2e8f0', '#94a3b8'],
              speed: 200,
              life: 0.6,
            });
            api.haptic([60, 30, 60]);
            if (s.shields > 0) {
              s.shields -= 1;
              s.invuln = 1.2;
              s.speed *= 0.5;
              floaters.add('Helmet saved you!', W / 2, SKIER_Y + 60, '#fca5a5', 18);
              api.sfx('hit');
            } else {
              s.crashed = true;
              s.crashT = 0.8;
              api.sfx('explode');
            }
          }
        }
      }
      s.objs = s.objs.filter((o) => o.y > s.y - SKIER_Y - 80);
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 90) s.trail.shift();
      if (Math.abs(s.angle) > 0.5 && rng.chance(0.5) && s.air <= 0)
        particles.burst(s.x, SKIER_Y + 12, {
          count: 1,
          color: '#f8fafc',
          speed: 80,
          angle: s.angle > 0 ? Math.PI : 0,
          spread: 0.7,
          life: 0.4,
          size: 5,
        });
      const next = Math.floor((s.y / 10) * speedMul) + s.bonus;
      if (next !== s.score) {
        s.score = next;
        api.setScore(next);
      }
    } else if (s.crashed && s.crashT > 0) {
      s.crashT -= dt;
      if (s.crashT <= 0)
        continueGate(() => {
          s.crashed = false;
          s.invuln = 1.6;
          s.speed = 60;
          s.angle = 0;
          s.objs = s.objs.filter((o) => o.kind === 'coin' || o.y > s.y + 260);
        }, finish);
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    // snow texture
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < 18; i++) {
      const yy = ((((i * 97 - s.y) % (H + 60)) + H + 60) % (H + 60)) - 30;
      ctx.beginPath();
      ctx.ellipse((i * 53) % W, yy, 40, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // trail
    ctx.strokeStyle = 'rgba(148,163,184,0.5)';
    ctx.lineWidth = 3;
    for (const off of [-5, 5]) {
      ctx.beginPath();
      s.trail.forEach((p, i) => {
        const yy = p.y - s.y + SKIER_Y;
        if (i === 0) ctx.moveTo(p.x + off, yy);
        else ctx.lineTo(p.x + off, yy);
      });
      ctx.stroke();
    }
    const sorted = [...s.objs].sort((a, b) => a.y - b.y);
    for (const o of sorted) {
      const sy = o.y - s.y + SKIER_Y;
      if (sy < -60 || sy > H + 60) continue;
      if (o.kind === 'coin') {
        if (!o.done) drawCoin(ctx, o.x, sy, 9, s.clock);
      } else if (o.kind === 'tree') {
        ctx.fillStyle = 'rgba(15,23,42,0.15)';
        ctx.beginPath();
        ctx.ellipse(o.x + 6, sy + 12, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350f';
        ctx.fillRect(o.x - 3, sy + 2, 6, 10);
        ctx.fillStyle = '#166534';
        ctx.beginPath();
        ctx.moveTo(o.x, sy - 34);
        ctx.lineTo(o.x + 16, sy + 4);
        ctx.lineTo(o.x - 16, sy + 4);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(o.x, sy - 34);
        ctx.lineTo(o.x + 6, sy - 20);
        ctx.lineTo(o.x - 6, sy - 20);
        ctx.fill();
      } else if (o.kind === 'rock') {
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.ellipse(o.x, sy, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.ellipse(o.x - 3, sy - 6, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (o.kind === 'log') {
        fillRoundRect(ctx, o.x - o.r, sy - 7, o.r * 2, 14, 7, '#92400e');
        ctx.fillStyle = '#b45309';
        ctx.fillRect(o.x - o.r + 6, sy - 2, o.r * 2 - 12, 2);
      } else if (o.kind === 'gate') {
        for (const side of [-1, 1]) {
          const gx = o.x + (side * o.gap!) / 2;
          ctx.fillStyle = '#334155';
          ctx.fillRect(gx - 1.5, sy - 26, 3, 28);
          ctx.fillStyle = o.done ? '#94a3b8' : '#2563eb';
          ctx.beginPath();
          ctx.moveTo(gx, sy - 26);
          ctx.lineTo(gx + 16 * -side, sy - 20);
          ctx.lineTo(gx, sy - 14);
          ctx.fill();
        }
      } else if (o.kind === 'ramp') {
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.moveTo(o.x - o.r, sy + 8);
        ctx.lineTo(o.x + o.r, sy + 8);
        ctx.lineTo(o.x + o.r * 0.7, sy - 8);
        ctx.lineTo(o.x - o.r * 0.7, sy - 8);
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    // skier
    if (!s.crashed) {
      const [jacket, pants, accent] = lo.skin.colors;
      const lift = s.air > 0 ? Math.sin((s.air / 0.9) * Math.PI) * 18 : 0;
      ctx.save();
      ctx.translate(s.x, SKIER_Y - lift);
      if (lift > 0) {
        ctx.fillStyle = 'rgba(15,23,42,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, lift + 14, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 12) % 2 ? 0.4 : 1;
      ctx.rotate(-s.angle * 0.9);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(-6, 22);
      ctx.moveTo(6, -6);
      ctx.lineTo(6, 22);
      ctx.stroke();
      fillRoundRect(ctx, -8, -2, 16, 12, 4, pants);
      fillRoundRect(ctx, -9, -16, 18, 16, 6, jacket);
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath();
      ctx.arc(0, -21, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, -23, 7, Math.PI, 0);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = lo.skin.colors[0];
      ctx.beginPath();
      ctx.ellipse(s.x, SKIER_Y, 14, 8, s.clock * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    hudPill(ctx, 10, 10, `${Math.floor(s.y / 10)} m`, { size: 14 });
    hudPill(ctx, W - 10, 10, String(s.coins), { align: 'right', coin: true, size: 14 });
    if (s.shields > 0) hudPill(ctx, 10, 44, `⛑️ ${s.shields}`, { size: 12 });
    if (!s.started) prompt(ctx, 'Hold left / right to carve', W / 2, H * 0.55, s.clock, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Ski Rush game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
