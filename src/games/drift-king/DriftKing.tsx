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
import type { CanvasView, StagePointer } from '../../engine';
import { angleDiff, clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const STEP = 30;
const UP = -Math.PI / 2;

interface Pt {
  x: number;
  y: number;
}

export function DriftKing({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const grip = 2.3 * (1 + 0.08 * lo.level('grip'));
  const driftMult = 1 + 0.12 * lo.level('drift');
  const magnet = 22 + 10 * lo.level('magnet');
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    road: [{ x: 0, y: 0 }] as Pt[],
    heading: UP,
    curve: 0,
    curveLeft: 8,
    coins: [] as { x: number; y: number; taken: boolean }[],
    trees: [] as { x: number; y: number; r: number }[],
    x: 0,
    y: -20,
    theta: UP,
    vx: 0,
    vy: 0,
    speed: 0,
    seg: 0,
    maxSeg: 0,
    driftPts: 0,
    comboT: 0,
    offT: 0,
    lastBank: 0,
    armor: lo.level('armor'),
    crashed: false,
    crashT: 0,
    waiting: false,
    started: false,
    score: 0,
    coinCount: 0,
    bestCombo: 1,
    clock: 0,
    skids: [] as { x: number; y: number; t: number }[],
    touches: new Map<number, number>(),
    camX: 0,
    camY: 0,
  }).current;

  const halfWidth = (i: number) => Math.max(44, 62 - i * 0.004);

  const extend = (upTo: number) => {
    while (s.road.length < upTo) {
      if (--s.curveLeft <= 0) {
        s.curveLeft = rng.int(5, 14);
        s.curve = rng.chance(0.25) ? 0 : rng.range(-0.11, 0.11) * Math.min(1, 0.5 + s.road.length / 600);
      }
      s.heading += s.curve;
      if (s.heading < UP - 1.15 || s.heading > UP + 1.15) {
        s.heading = clamp(s.heading, UP - 1.15, UP + 1.15);
        s.curve = -s.curve;
      }
      const last = s.road[s.road.length - 1]!;
      const p = { x: last.x + Math.cos(s.heading) * STEP, y: last.y + Math.sin(s.heading) * STEP };
      s.road.push(p);
      const i = s.road.length;
      if (i > 12 && i % 9 === 0 && rng.chance(0.55)) {
        const off = rng.range(-0.5, 0.5) * halfWidth(i);
        const nx = -Math.sin(s.heading);
        const ny = Math.cos(s.heading);
        s.coins.push({ x: p.x + nx * off, y: p.y + ny * off, taken: false });
      }
      if (rng.chance(0.5)) {
        const side = rng.chance(0.5) ? 1 : -1;
        const d = halfWidth(i) + rng.range(30, 110);
        s.trees.push({
          x: p.x - Math.sin(s.heading) * d * side,
          y: p.y + Math.cos(s.heading) * d * side,
          r: rng.range(12, 22),
        });
      }
    }
  };
  if (s.road.length === 1) extend(120);

  /** Distance from the car to the road centreline, searching near the current segment. */
  const nearest = () => {
    let best = Infinity;
    let bestI = s.seg;
    let dirA = UP;
    for (let i = Math.max(0, s.seg - 3); i < Math.min(s.road.length - 1, s.seg + 8); i++) {
      const a = s.road[i]!;
      const b = s.road[i + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = clamp(((s.x - a.x) * dx + (s.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      const d = Math.hypot(s.x - (a.x + dx * t), s.y - (a.y + dy * t));
      if (d < best) {
        best = d;
        bestI = i;
        dirA = Math.atan2(dy, dx);
      }
    }
    return { d: best, i: bestI, dir: dirA };
  };

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.touches.set(p.id, p.x < W / 2 ? -1 : 1);
  };
  const onUp = (p: StagePointer) => {
    s.touches.delete(p.id);
  };

  const crash = () => {
    s.crashed = true;
    s.waiting = true;
    fx.current.shake.add(16);
    fx.current.particles.burst(s.x, s.y, {
      count: 40,
      colors: ['#fde047', '#f97316', '#e5e7eb'],
      speed: 240,
      life: 0.7,
    });
    api.sfx('explode');
    api.haptic([70, 40, 90]);
    s.crashT = 0.7;
  };

  const afterCrash = () => {
    continueGate(
      () => {
        const n = nearest();
        const a = s.road[n.i]!;
        s.x = a.x;
        s.y = a.y;
        s.theta = n.dir;
        s.speed *= 0.6;
        s.vx = Math.cos(n.dir) * s.speed;
        s.vy = Math.sin(n.dir) * s.speed;
        s.crashed = false;
        s.waiting = false;
        s.comboT = 0;
      },
      () =>
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Distance', value: `${Math.floor((s.maxSeg * STEP) / 10)} m` },
            { label: 'Drift points', value: String(Math.floor(s.driftPts)) },
            { label: 'Best combo', value: `×${s.bestCombo}` },
            { label: 'Coins', value: String(s.coinCount) },
          ],
        }),
    );
  };

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
    steer = clamp(steer, -1, 1);
    if (steer !== 0) s.started = true;

    if (s.started && !s.crashed) {
      const vmax = Math.min(430, 250 + s.maxSeg * 0.35);
      s.speed = Math.min(vmax, s.speed + 160 * dt);
      s.theta += steer * 2.7 * dt * Math.min(1, s.speed / 150);
      const fxv = Math.cos(s.theta) * s.speed;
      const fyv = Math.sin(s.theta) * s.speed;
      const g = 1 - Math.exp(-grip * dt);
      s.vx += (fxv - s.vx) * g;
      s.vy += (fyv - s.vy) * g;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const velA = Math.atan2(s.vy, s.vx);
      const drift = Math.abs(angleDiff(velA, s.theta));
      const n = nearest();
      s.seg = n.i;
      if (n.i > s.maxSeg) s.maxSeg = n.i;
      extend(s.maxSeg + 80);
      const hw = halfWidth(n.i);
      if (n.d > hw - 9) {
        if (s.armor > 0) {
          s.armor -= 1;
          const a = s.road[n.i]!;
          s.x = a.x + (s.x - a.x) * 0.4;
          s.y = a.y + (s.y - a.y) * 0.4;
          s.theta = n.dir;
          s.vx = Math.cos(n.dir) * s.speed * 0.7;
          s.vy = Math.sin(n.dir) * s.speed * 0.7;
          shake.add(10);
          floaters.add('Bumper saved you!', W / 2, 200, '#93c5fd', 18);
          api.sfx('hit');
        } else crash();
      }
      if (drift > 0.2 && s.speed > 140) {
        s.comboT += dt;
        const mult = Math.min(6, 1 + Math.floor(s.comboT / 1.2));
        s.bestCombo = Math.max(s.bestCombo, mult);
        s.driftPts += dt * drift * s.speed * 0.12 * mult * driftMult;
        s.offT = 0;
        if (rng.chance(0.7)) {
          s.skids.push({ x: s.x - Math.cos(s.theta) * 14, y: s.y - Math.sin(s.theta) * 14, t: s.clock });
          if (s.skids.length > 500) s.skids.shift();
        }
        if (rng.chance(0.5))
          particles.burst(s.x - Math.cos(s.theta) * 16, s.y - Math.sin(s.theta) * 16, {
            count: 1,
            color: 'rgba(226,232,240,0.55)',
            speed: 40,
            life: 0.8,
            size: 12,
            drag: 3,
          });
      } else {
        s.offT += dt;
        if (s.offT > 0.35 && s.comboT > 0) {
          const mult = Math.min(6, 1 + Math.floor(s.comboT / 1.2));
          if (s.comboT > 0.8) {
            floaters.add(`Drift! ×${mult}`, W / 2, H * 0.4, '#e9d5ff', 20);
            api.sfx(mult >= 3 ? 'perfect' : 'score');
          }
          s.comboT = 0;
        }
      }
      for (const c of s.coins) {
        if (!c.taken && Math.hypot(c.x - s.x, c.y - s.y) < magnet) {
          c.taken = true;
          s.coinCount += 1;
          api.addCoins(1);
          api.sfx('coin');
        }
      }
      const next = Math.floor((s.maxSeg * STEP) / 10) + Math.floor(s.driftPts);
      if (next !== s.score) {
        s.score = next;
        api.setScore(next);
      }
    }
    if (s.crashT > 0) {
      s.crashT -= dt;
      if (s.crashT <= 0) afterCrash();
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // camera looks ahead in the direction of travel
    const lookX = s.x + Math.cos(s.theta) * 90;
    const lookY = s.y + Math.sin(s.theta) * 140;
    s.camX += (lookX - s.camX) * Math.min(1, dt * 4);
    s.camY += (lookY - s.camY) * Math.min(1, dt * 4);
    if (s.clock < 0.1) {
      s.camX = lookX;
      s.camY = lookY;
    }

    // ---------- render ----------
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    ctx.translate(W / 2 - s.camX, H * 0.55 - s.camY);
    const vis = (p: Pt, m = 80) => Math.abs(p.x - s.camX) < W / 2 + m && Math.abs(p.y - s.camY) < H * 0.7 + m;
    const from = Math.max(0, s.seg - 25);
    const to = Math.min(s.road.length, s.seg + 45);
    const path = () => {
      ctx.beginPath();
      for (let i = from; i < to; i++) {
        const p = s.road[i]!;
        if (i === from) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const hw = halfWidth(s.seg);
    path();
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = hw * 2 + 14;
    ctx.stroke();
    path();
    ctx.strokeStyle = '#f8fafc';
    ctx.setLineDash([16, 16]);
    ctx.stroke();
    ctx.setLineDash([]);
    path();
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = hw * 2;
    ctx.stroke();
    path();
    ctx.strokeStyle = 'rgba(250,250,250,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 22]);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const sk of s.skids) {
      const age = s.clock - sk.t;
      if (age > 6) continue;
      ctx.fillStyle = `rgba(10,10,10,${0.5 * (1 - age / 6)})`;
      ctx.fillRect(sk.x - 3, sk.y - 3, 6, 6);
    }
    for (const c of s.coins) if (!c.taken && vis(c)) drawCoin(ctx, c.x, c.y, 9, s.clock);
    for (const t of s.trees) {
      if (!vis(t)) continue;
      circle(ctx, t.x + 4, t.y + 5, t.r, 'rgba(0,0,0,0.25)');
      circle(ctx, t.x, t.y, t.r, '#166534');
      circle(ctx, t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.5, '#22c55e');
    }
    if (!s.crashed) {
      const [c0, c1, c2] = lo.skin.colors;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.theta + Math.PI / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-13, -21, 30, 46);
      fillRoundRect(ctx, -14, -24, 28, 48, 7, c0);
      fillRoundRect(ctx, -11, -14, 22, 10, 3, c1);
      fillRoundRect(ctx, -11, 8, 22, 8, 3, c1);
      ctx.fillStyle = c2;
      ctx.fillRect(-2, -24, 4, 48);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-12, -25, 6, 3);
      ctx.fillRect(6, -25, 6, 3);
      ctx.restore();
    }
    particles.draw(ctx);
    ctx.restore();
    floaters.draw(ctx);

    hudPill(ctx, 10, 10, `${Math.floor((s.maxSeg * STEP) / 10)} m`, { size: 14 });
    hudPill(ctx, W - 10, 10, String(s.coinCount), { align: 'right', coin: true, size: 14 });
    if (s.comboT > 0.3) {
      const mult = Math.min(6, 1 + Math.floor(s.comboT / 1.2));
      text(ctx, `DRIFT ×${mult}`, W / 2, 70, {
        size: 24 + mult * 2,
        weight: 900,
        color: '#e9d5ff',
        stroke: 'rgba(76,29,149,0.8)',
        strokeWidth: 6,
      });
    }
    if (s.armor > 0) hudPill(ctx, 10, 44, `🛡️ ${s.armor}`, { size: 12 });
    if (!s.started) prompt(ctx, 'Hold left / right to steer', W / 2, H * 0.3, s.clock, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Drift King game area"
      onPointerDown={onDown}
      onPointerUp={onUp}
    />
  );
}
