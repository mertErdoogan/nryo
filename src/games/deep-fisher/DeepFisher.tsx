import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
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
const SURFACE = 120;
const PX_PER_M = 10;

interface Species {
  name: string;
  minDepth: number;
  value: number;
  size: number;
  color: string;
  fin: string;
  speed: number;
}
const SPECIES: Species[] = [
  { name: 'Sardine', minDepth: 0, value: 1, size: 12, color: '#cbd5e1', fin: '#94a3b8', speed: 70 },
  { name: 'Clownfish', minDepth: 20, value: 3, size: 14, color: '#f97316', fin: '#fff7ed', speed: 60 },
  { name: 'Tuna', minDepth: 60, value: 6, size: 22, color: '#1d4ed8', fin: '#fde047', speed: 90 },
  { name: 'Pufferfish', minDepth: 100, value: 10, size: 16, color: '#facc15', fin: '#a16207', speed: 40 },
  { name: 'Swordfish', minDepth: 160, value: 18, size: 28, color: '#475569', fin: '#94a3b8', speed: 120 },
  { name: 'Anglerfish', minDepth: 240, value: 30, size: 20, color: '#1e1b4b', fin: '#fde047', speed: 45 },
  { name: 'Oarfish', minDepth: 330, value: 50, size: 34, color: '#e11d48', fin: '#fda4af', speed: 55 },
];

interface Fish {
  sp: Species;
  x: number;
  y: number;
  dir: 1 | -1;
  hooked: boolean;
  shark: boolean;
}

type Phase = 'down' | 'up' | 'done';

export function DeepFisher({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const maxDepth = (120 + 40 * lo.level('line')) * PX_PER_M;
  const capacity = 6 + 3 * lo.level('capacity');
  const sonar = lo.level('sonar');
  const valueMul = 1 + 0.12 * lo.level('value');
  const [lure, lure2, glow] = lo.skin.colors;
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;

  const makeFish = (): Fish[] => {
    const out: Fish[] = [];
    for (let y = SURFACE + 90; y < SURFACE + maxDepth + 300; y += rng.range(34, 60)) {
      const depthM = (y - SURFACE) / PX_PER_M;
      const pool = SPECIES.filter((sp) => sp.minDepth <= depthM);
      const sp = pool[Math.min(pool.length - 1, Math.floor(Math.pow(rng.next(), 0.7) * pool.length))]!;
      const shark = depthM > 60 && rng.chance(Math.min(0.1, 0.025 + depthM / 4000));
      out.push({ sp, x: rng.range(20, W - 20), y, dir: rng.chance(0.5) ? 1 : -1, hooked: false, shark });
    }
    return out;
  };

  const s = useRef({
    fish: makeFish(),
    phase: 'down' as Phase,
    x: W / 2,
    y: SURFACE,
    target: null as number | null,
    passes: sonar,
    caught: [] as Fish[],
    deepest: 0,
    camY: 0,
    started: false,
    waiting: false,
    endT: 0,
    clock: 0,
    drag: null as null | { id: number; px: number; sx: number },
  }).current;

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.drag = { id: p.id, px: p.x, sx: s.x };
  };
  const onMove = (p: StagePointer) => {
    if (s.drag?.id === p.id) s.target = clamp(s.drag.sx + (p.x - s.drag.px) * 1.3, 12, W - 12);
  };
  const onUp = (p: StagePointer) => {
    if (s.drag?.id === p.id) s.drag = null;
  };

  const value = () => Math.round(s.caught.reduce((sum, f) => sum + f.sp.value, 0) * valueMul);

  const finishTrip = (lostHalf: boolean) => {
    s.phase = 'done';
    s.endT = 1.4;
    if (lostHalf) s.caught = s.caught.slice(0, Math.floor(s.caught.length / 2));
    const v = value();
    api.setScore(v);
    fx.current.floaters.add(`Catch worth ${v}!`, W / 2, 200, '#fde047', 24, 1.6);
    api.sfx(v > 0 ? 'win' : 'gameover');
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    const steer =
      (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    if (steer) {
      s.started = true;
      s.target = null;
      s.x = clamp(s.x + steer * 300 * dt, 12, W - 12);
    } else if (s.target !== null) s.x += clamp(s.target - s.x, -500 * dt, 500 * dt);

    for (const f of s.fish) {
      if (f.hooked) continue;
      f.x += f.dir * f.sp.speed * (f.shark ? 1.4 : 1) * dt;
      if (f.x < 16 || f.x > W - 16) f.dir = f.dir > 0 ? -1 : 1;
    }

    if (s.started && !s.waiting) {
      if (s.phase === 'down') {
        s.y += Math.min(260, 120 + (s.y - SURFACE) * 0.15) * dt;
        s.deepest = Math.max(s.deepest, s.y - SURFACE);
        for (const f of s.fish) {
          if (f.hooked) continue;
          const size = f.shark ? 30 : f.sp.size;
          if (Math.abs(f.x - s.x) < size && Math.abs(f.y - s.y) < size * 0.5 + 6) {
            if (s.passes > 0 && !f.shark) {
              s.passes -= 1;
              f.y += 1000; // swims away
              floaters.add('Sonar pass', s.x, s.y - s.camY - 20, '#67e8f9', 14);
              continue;
            }
            s.phase = 'up';
            floaters.add('Bite! Reel in!', W / 2, s.y - s.camY - 40, '#fde047', 20);
            api.sfx('swap');
            break;
          }
        }
        if (s.y - SURFACE >= maxDepth) {
          s.phase = 'up';
          floaters.add('End of the line!', W / 2, s.y - s.camY - 40, '#fde047', 18);
          api.sfx('tick');
        }
      } else if (s.phase === 'up') {
        s.y -= 300 * dt;
        for (const f of s.fish) {
          if (f.hooked) continue;
          const size = f.shark ? 30 : f.sp.size;
          if (Math.abs(f.x - s.x) < size + 4 && Math.abs(f.y - s.y) < size * 0.5 + 8) {
            if (f.shark) {
              shake.add(12);
              particles.burst(s.x, s.y - s.camY, {
                count: 24,
                colors: ['#94a3b8', '#fff'],
                speed: 200,
                life: 0.6,
              });
              api.sfx('explode');
              api.haptic([60, 30, 60]);
              f.y += 2000;
              s.waiting = true;
              continueGate(
                () => {
                  s.waiting = false;
                  for (const g of s.fish) if (g.shark && Math.abs(g.y - s.y) < 400) g.y += 3000;
                  floaters.add('Line repaired!', W / 2, 200, '#86efac', 18);
                },
                () => {
                  s.waiting = false;
                  floaters.add('Snap! Half the catch got away', W / 2, 160, '#fca5a5', 16, 1.4);
                  finishTrip(true);
                },
              );
              break;
            }
            if (s.caught.length < capacity) {
              f.hooked = true;
              s.caught.push(f);
              api.sfx('coin');
              if (f.sp.value >= 10)
                floaters.add(
                  `${f.sp.name}! +${Math.round(f.sp.value * valueMul)}`,
                  s.x,
                  s.y - s.camY - 20,
                  '#fde047',
                  14,
                );
            }
          }
        }
        if (s.y <= SURFACE && s.phase === 'up') finishTrip(false);
      }
    }
    if (s.phase === 'done') {
      s.endT -= dt;
      if (s.endT <= 0 && s.endT > -1) {
        s.endT = -5;
        const val = value();
        api.addCoins(Math.floor(val / 6));
        const best = s.caught.reduce<Fish | null>((b, f) => (!b || f.sp.value > b.sp.value ? f : b), null);
        api.gameOver({
          score: val,
          stats: [
            { label: 'Fish caught', value: String(s.caught.length) },
            { label: 'Deepest', value: `${Math.floor(s.deepest / PX_PER_M)} m` },
            { label: 'Best catch', value: best ? best.sp.name : '—' },
          ],
        });
      }
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // camera
    const targetCam = Math.max(0, s.y - H * 0.4);
    s.camY += (targetCam - s.camY) * Math.min(1, dt * 6);

    // ---------- render ----------
    const depthT = clamp(s.camY / 3500, 0, 1);
    const sea = ctx.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, `hsl(199 ${80 - depthT * 30}% ${45 - depthT * 35}%)`);
    sea.addColorStop(1, `hsl(215 ${70 - depthT * 30}% ${25 - depthT * 18}%)`);
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    ctx.translate(0, -s.camY);
    // sky + boat
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(0, -400, W, SURFACE + 400);
    ctx.fillStyle = '#38bdf8';
    for (let x = 0; x < W; x += 20) {
      ctx.beginPath();
      ctx.arc(x + 10, SURFACE + Math.sin(s.clock * 2 + x) * 2, 11, 0, Math.PI);
      ctx.fill();
    }
    fillRoundRect(ctx, W / 2 - 60, SURFACE - 24, 120, 26, 10, '#b45309');
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 10, SURFACE - 24);
    ctx.lineTo(W / 2 - 10, SURFACE - 80);
    ctx.lineTo(W / 2 + 30, SURFACE - 30);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2 + 40, SURFACE - 20);
    ctx.lineTo(W / 2 + 70, SURFACE - 70);
    ctx.stroke();
    // depth markers
    for (let m = 50; m * PX_PER_M < maxDepth + 400; m += 50) {
      const y = SURFACE + m * PX_PER_M;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(0, y, 18, 2);
      text(ctx, `${m}m`, 22, y, { size: 10, align: 'left', color: 'rgba(255,255,255,0.5)' });
    }
    const lineEnd = SURFACE + maxDepth;
    ctx.fillStyle = 'rgba(248,113,113,0.5)';
    ctx.fillRect(0, lineEnd, W, 2);
    text(ctx, 'line limit', W - 10, lineEnd - 8, { size: 10, align: 'right', color: '#fca5a5' });
    // fish
    for (const f of s.fish) {
      if (f.hooked) continue;
      if (f.y - s.camY < -40 || f.y - s.camY > H + 40) continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(f.dir, 1);
      if (f.shark) {
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.ellipse(0, 0, 32, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-4, -8);
        ctx.lineTo(4, -24);
        ctx.lineTo(10, -8);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-30, 0);
        ctx.lineTo(-44, -12);
        ctx.lineTo(-44, 12);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(14, 2, 14, 4);
        circle(ctx, 20, -3, 2, '#111');
      } else {
        const sz = f.sp.size;
        ctx.fillStyle = f.sp.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, sz, sz * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = f.sp.fin;
        ctx.beginPath();
        ctx.moveTo(-sz * 0.9, 0);
        ctx.lineTo(-sz * 1.5, -sz * 0.45);
        ctx.lineTo(-sz * 1.5, sz * 0.45);
        ctx.fill();
        circle(ctx, sz * 0.5, -sz * 0.1, Math.max(1.5, sz * 0.1), '#0f172a');
        if (f.sp.name === 'Anglerfish') circle(ctx, sz * 1.2, -sz * 0.8, 3, '#fde047');
        if (f.sp.name === 'Swordfish') {
          ctx.strokeStyle = f.sp.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sz, 0);
          ctx.lineTo(sz * 1.8, -2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    // line + hook + catch
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(W / 2 + 70, SURFACE - 70);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    s.caught.forEach((f, i) => {
      const a = Math.sin(s.clock * 6 + i) * 0.4;
      ctx.save();
      ctx.translate(s.x + Math.sin(i * 2.1) * 10, s.y + 10 + i * 6);
      ctx.rotate(Math.PI / 2 + a);
      ctx.fillStyle = f.sp.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, f.sp.size * 0.7, f.sp.size * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    circle(ctx, s.x, s.y, 12, glow + '33');
    circle(ctx, s.x, s.y, 6, lure);
    circle(ctx, s.x, s.y - 2, 2.5, lure2);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(s.x + 2, s.y + 8, 5, 0, Math.PI);
    ctx.stroke();
    particles.draw(ctx);
    ctx.restore();
    floaters.draw(ctx);

    // HUD
    hudPill(ctx, 10, 10, `${Math.max(0, Math.floor((s.y - SURFACE) / PX_PER_M))} m`, { size: 14 });
    hudPill(ctx, W - 10, 10, `🐟 ${s.caught.length}/${capacity}`, { align: 'right', size: 13 });
    hudPill(ctx, W / 2, 10, `${value()}`, { align: 'center', size: 13, color: '#fde047' });
    if (s.phase === 'down' && s.passes > 0) hudPill(ctx, 10, 44, `📡 ${s.passes}`, { size: 12 });
    if (!s.started) prompt(ctx, 'Drag to steer — tap to drop the line', W / 2, H * 0.6, s.clock, 16);
    text(
      ctx,
      s.phase === 'down' ? 'Going down — avoid fish ▼' : s.phase === 'up' ? 'Reeling in — hook fish ▲' : '',
      W / 2,
      H - 20,
      { size: 12, weight: 800, color: '#e0f2fe' },
    );
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Deep Fisher game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
