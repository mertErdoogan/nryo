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
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const BX = W / 2;
const BY = 500;
const BALLOON_R = 20;

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  square: boolean;
  rot: number;
  vr: number;
}

export function RiseUp({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const shieldR = 26 * (1 + 0.12 * lo.level('shield'));
  const magnet = lo.level('magnet');
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    bodies: [] as Body[],
    coins: [] as { x: number; y: number; taken: boolean }[],
    sx: BX,
    sy: BY - 140,
    svx: 0,
    svy: 0,
    prevSx: BX,
    prevSy: BY - 140,
    drag: null as null | { id: number; px: number; py: number; sx: number; sy: number },
    height: 0,
    nextFormation: 0,
    armor: lo.level('armor'),
    invuln: 0,
    dead: false,
    deadT: 0,
    started: false,
    score: 0,
    coinCount: 0,
    clock: 0,
  }).current;

  const add = (x: number, y: number, r: number, square = false) =>
    s.bodies.push({ x, y, vx: 0, vy: 0, r, square, rot: 0, vr: 0 });

  const formation = () => {
    const y0 = -60;
    const lvl = Math.min(6, Math.floor(s.height / 1500));
    const pick = rng.int(0, 3 + Math.min(3, lvl));
    switch (pick) {
      case 0: {
        const gap = rng.int(1, 6);
        for (let i = 0; i < 8; i++) if (i !== gap) add(22 + i * 45, y0, 18, true);
        break;
      }
      case 1:
        for (let i = 0; i < 5 + lvl; i++)
          add(rng.range(20, W - 20), y0 - rng.range(0, 160), rng.range(10, 20));
        break;
      case 2:
        for (let i = 0; i < 6; i++) add(BX + rng.range(-10, 10), y0 - i * 34, 15, true);
        break;
      case 3:
        add(rng.range(80, W - 80), y0 - 20, 42);
        break;
      case 4:
        for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) add(90 + c * 36, y0 - r * 36, 15, true);
        break;
      case 5: {
        const side = rng.chance(0.5) ? 1 : -1;
        for (let i = 0; i < 7; i++) add(BX + side * (150 - i * 40), y0 - i * 30, 13);
        break;
      }
      default:
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          add(BX + Math.cos(a) * 70, y0 - 80 + Math.sin(a) * 70, 12);
        }
    }
    if (rng.chance(0.6)) {
      const cx = rng.range(40, W - 40);
      for (let i = 0; i < 4; i++) s.coins.push({ x: cx, y: y0 - 200 - i * 26, taken: false });
    }
    s.nextFormation = s.height + rng.range(260, 380) - lvl * 15;
  };

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.drag = { id: p.id, px: p.x, py: p.y, sx: s.sx, sy: s.sy };
  };
  const onMove = (p: StagePointer) => {
    if (s.drag?.id !== p.id) return;
    s.sx = clamp(s.drag.sx + (p.x - s.drag.px) * 1.25, shieldR, W - shieldR);
    s.sy = clamp(s.drag.sy + (p.y - s.drag.py) * 1.25, shieldR, H - shieldR);
  };
  const onUp = (p: StagePointer) => {
    if (s.drag?.id === p.id) s.drag = null;
  };

  const pop = () => {
    if (s.invuln > 0 || s.dead) return;
    if (s.armor > 0) {
      s.armor -= 1;
      s.invuln = 1.5;
      clearNear(170);
      fx.current.floaters.add('Tough balloon!', BX, BY - 60, '#fecaca', 18);
      api.sfx('hit');
      return;
    }
    s.dead = true;
    s.deadT = 0.8;
    fx.current.shake.add(12);
    fx.current.particles.burst(BX, BY, {
      count: 40,
      colors: [lo.skin.colors[0], lo.skin.colors[1], '#fff'],
      speed: 260,
      life: 0.7,
    });
    api.sfx('explode');
    api.haptic([60, 30, 60]);
  };

  const clearNear = (radius: number) => {
    for (const b of s.bodies) {
      const dx = b.x - BX;
      const dy = b.y - BY;
      const d = Math.hypot(dx, dy) || 1;
      if (d < radius) {
        b.vx += (dx / d) * 500;
        b.vy += (dy / d) * 500 - 200;
      }
    }
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    const ax = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    const ay = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (ax || ay) s.started = true;
    s.sx = clamp(s.sx + ax * 460 * dt, shieldR, W - shieldR);
    s.sy = clamp(s.sy + ay * 460 * dt, shieldR, H - shieldR);
    s.svx = (s.sx - s.prevSx) / Math.max(dt, 1e-3);
    s.svy = (s.sy - s.prevSy) / Math.max(dt, 1e-3);
    s.prevSx = s.sx;
    s.prevSy = s.sy;

    if (s.started && !s.dead) {
      s.invuln = Math.max(0, s.invuln - dt);
      const rise = Math.min(210, 95 + s.height * 0.02);
      s.height += rise * dt;
      if (s.height >= s.nextFormation) formation();
      for (const b of s.bodies) {
        b.x += b.vx * dt;
        b.y += (b.vy + rise) * dt;
        b.vx *= Math.max(0, 1 - dt * 1.2);
        b.vy *= Math.max(0, 1 - dt * 1.2);
        b.rot += b.vr * dt;
        b.vr *= Math.max(0, 1 - dt * 2);
        // shield push
        const dx = b.x - s.sx;
        const dy = b.y - s.sy;
        const d = Math.hypot(dx, dy) || 0.001;
        const overlap = shieldR + b.r - d;
        if (overlap > 0) {
          const nx = dx / d;
          const ny = dy / d;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const push = Math.max(0, s.svx * nx + s.svy * ny);
          b.vx += nx * (push * 1.1 + 60);
          b.vy += ny * (push * 1.1 + 60);
          b.vr += (rng.next() - 0.5) * 6;
        }
      }
      // body-body separation
      for (let i = 0; i < s.bodies.length; i++)
        for (let j = i + 1; j < s.bodies.length; j++) {
          const a = s.bodies[i]!;
          const b = s.bodies[j]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const overlap = a.r + b.r - d;
          if (overlap > 0) {
            const nx = dx / d;
            const ny = dy / d;
            const ma = a.r * a.r;
            const mb = b.r * b.r;
            const t = ma + mb;
            a.x -= nx * overlap * (mb / t);
            a.y -= ny * overlap * (mb / t);
            b.x += nx * overlap * (ma / t);
            b.y += ny * overlap * (ma / t);
            const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rel < 0) {
              const imp = (-rel * 0.9) / t;
              a.vx -= nx * imp * mb;
              a.vy -= ny * imp * mb;
              b.vx += nx * imp * ma;
              b.vy += ny * imp * ma;
            }
          }
        }
      for (const b of s.bodies) {
        if (Math.hypot(b.x - BX, b.y - (BY - 6)) < b.r + BALLOON_R - 3) pop();
      }
      s.bodies = s.bodies.filter((b) => b.y < H + 80 && b.x > -80 && b.x < W + 80);
      for (const c of s.coins) {
        c.y += rise * dt;
        if (c.taken) continue;
        const d = Math.hypot(c.x - BX, c.y - BY);
        if (magnet && d < 60 + magnet * 40) {
          c.x += (BX - c.x) * Math.min(1, dt * 3);
        }
        if (d < BALLOON_R + 12) {
          c.taken = true;
          s.coinCount += 1;
          api.addCoins(1);
          api.sfx('coin');
        }
      }
      s.coins = s.coins.filter((c) => !c.taken && c.y < H + 30);
      const m = Math.floor(s.height / 10);
      if (m !== s.score) {
        s.score = m;
        api.setScore(m);
      }
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.dead = false;
            s.invuln = 2;
            s.bodies = s.bodies.filter((b) => Math.hypot(b.x - BX, b.y - BY) > 260);
          },
          () =>
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Height', value: `${s.score} m` },
                { label: 'Coins', value: String(s.coinCount) },
              ],
            }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    const t = Math.min(1, s.height / 20000);
    sky.addColorStop(0, t > 0.5 ? '#1e1b4b' : '#7c3aed');
    sky.addColorStop(1, t > 0.5 ? '#312e81' : '#38bdf8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 6; i++) {
      const cy = ((i * 140 + s.height * 0.5) % (H + 120)) - 60;
      const cx = (i * 97) % W;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 50, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 30, cy - 8, 30, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    shake.apply(ctx);
    for (const c of s.coins) if (!c.taken) drawCoin(ctx, c.x, c.y, 9, s.clock + c.y * 0.01);
    for (const b of s.bodies) {
      if (b.square) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        fillRoundRect(ctx, -b.r, -b.r, b.r * 2, b.r * 2, 4, '#1e1b4b');
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.strokeRect(-b.r + 3, -b.r + 3, b.r * 2 - 6, b.r * 2 - 6);
        ctx.restore();
      } else {
        circle(ctx, b.x, b.y, b.r, '#1e1b4b');
        circle(ctx, b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 'rgba(255,255,255,0.12)');
      }
    }
    // balloon
    if (!s.dead) {
      const [c0, c1] = lo.skin.colors;
      const sway = Math.sin(s.clock * 2) * 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(BX + sway, BY + 20);
      ctx.quadraticCurveTo(BX - 8, BY + 60, BX + sway, BY + 100);
      ctx.stroke();
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 12) % 2 ? 0.45 : 1;
      if (lo.skin.id === 'heart') {
        ctx.fillStyle = c0;
        ctx.beginPath();
        ctx.moveTo(BX + sway, BY + 18);
        ctx.bezierCurveTo(BX + sway - 34, BY - 6, BX + sway - 18, BY - 34, BX + sway, BY - 18);
        ctx.bezierCurveTo(BX + sway + 18, BY - 34, BX + sway + 34, BY - 6, BX + sway, BY + 18);
        ctx.fill();
      } else {
        ctx.fillStyle = c0;
        ctx.beginPath();
        ctx.ellipse(BX + sway, BY - 4, BALLOON_R, BALLOON_R * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.moveTo(BX + sway - 5, BY + 22);
      ctx.lineTo(BX + sway + 5, BY + 22);
      ctx.lineTo(BX + sway, BY + 16);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(BX + sway - 7, BY - 12, 5, 8, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (s.armor > 0) {
        ctx.strokeStyle = 'rgba(254,202,202,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(BX, BY - 4, 34, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // shield
    circle(ctx, s.sx, s.sy, shieldR, 'rgba(248,250,252,0.92)');
    ctx.strokeStyle = lo.skin.colors[2] === '#f8fafc' ? '#c7d2fe' : lo.skin.colors[2];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, shieldR - 2, 0, Math.PI * 2);
    ctx.stroke();
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    hudPill(ctx, 10, 10, `${s.score} m`, { size: 14 });
    hudPill(ctx, W - 10, 10, String(s.coinCount), { align: 'right', coin: true, size: 14 });
    if (!s.started) prompt(ctx, 'Drag to move the shield', W / 2, H * 0.3, s.clock, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Rise Up game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
