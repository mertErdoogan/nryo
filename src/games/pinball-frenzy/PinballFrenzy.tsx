import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  circle,
  createContinueGate,
  fillRoundRect,
  shade,
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
const R = 9;
const GRAV = 820;
const SUB = 8;
const LANE_X = 330;

type Seg = [number, number, number, number];

const ARC: Seg[] = (() => {
  const out: Seg[] = [];
  const cx = 183;
  const cy = 140;
  const r = 163;
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / n) * Math.PI;
    const a1 = Math.PI + ((i + 1) / n) * Math.PI;
    out.push([cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r]);
  }
  return out;
})();
const WALLS: Seg[] = [
  ...ARC,
  [20, 140, 20, 470],
  [20, 470, 92, 546],
  [314, 620, 314, 200],
  [314, 470, 248, 546],
  [346, 640, 346, 140],
  [300, 610, 314, 610],
];
const GATE: Seg = [314, 200, 346, 166];
const SLINGS: Seg[] = [
  [52, 400, 88, 476],
  [282, 400, 246, 476],
];
const STANDUPS: Seg[] = [
  [22, 290, 22, 340],
  [312, 290, 312, 340],
];
const BUMPERS = [
  { x: 118, y: 215, r: 20 },
  { x: 232, y: 215, r: 20 },
  { x: 175, y: 292, r: 20 },
];
const LANES = [
  { x: 120, y: 112 },
  { x: 175, y: 96 },
  { x: 230, y: 112 },
];
const FLIP_LEN = 64;
const FLIPPERS = [
  { px: 96, py: 552, rest: 0.5, up: -0.42, dir: 1 },
  { px: 244, py: 552, rest: Math.PI - 0.5, up: Math.PI + 0.42, dir: -1 },
];

export function PinballFrenzy({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const flipPower = 1 + 0.08 * lo.level('flipper');
  const saverTime = 3 * lo.level('saver') + 2;
  const [accent, bg, light] = lo.skin.colors;
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    x: LANE_X,
    y: 596,
    vx: 0,
    vy: 0,
    inLane: true,
    charge: 0,
    charging: false,
    gate: false,
    flip: FLIPPERS.map((f) => ({ a: f.rest, w: 0 })),
    touchFlip: [false, false],
    balls: 3 + lo.level('balls'),
    mult: 1 + lo.level('mult'),
    lanes: [false, false, false],
    flash: new Map<string, number>(),
    score: 0,
    saverT: 0,
    lost: false,
    over: false,
    clock: 0,
    coinScore: 0,
    started: false,
    spaceWas: false,
  }).current;

  const add = (pts: number, x: number, y: number) => {
    const v = pts * s.mult;
    s.score += v;
    api.setScore(s.score);
    s.coinScore += v;
    while (s.coinScore >= 5000) {
      s.coinScore -= 5000;
      api.addCoins(1);
    }
    if (pts >= 150) fx.current.floaters.add(`+${v}`, x, y - 16, light, 14, 0.6);
  };

  const resetBall = () => {
    s.x = LANE_X;
    s.y = 596;
    s.vx = 0;
    s.vy = 0;
    s.inLane = true;
    s.gate = false;
    s.charge = 0;
    s.lost = false;
  };

  const launch = () => {
    if (!s.inLane || s.y < 560) return;
    s.vy = -(1050 + 650 * s.charge);
    s.charge = 0;
    s.charging = false;
    s.saverT = saverTime;
    api.sfx('jump');
  };

  const onDown = (p: StagePointer) => {
    s.started = true;
    if (s.inLane && s.y > 560) {
      s.charging = true;
      return;
    }
    s.touchFlip[p.x < W / 2 ? 0 : 1] = true;
  };
  const onUp = (p: StagePointer) => {
    if (s.charging) {
      launch();
      return;
    }
    s.touchFlip[p.x < W / 2 ? 0 : 1] = false;
  };

  const collideSeg = (
    seg: Seg,
    radius: number,
    e: number,
    surf?: (px: number, py: number) => [number, number],
  ) => {
    const [ax, ay, bx, by] = seg;
    const dx = bx - ax;
    const dy = by - ay;
    const t = clamp(((s.x - ax) * dx + (s.y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    const px = ax + dx * t;
    const py = ay + dy * t;
    const ox = s.x - px;
    const oy = s.y - py;
    const d = Math.hypot(ox, oy);
    if (d >= radius || d === 0) return false;
    const nx = ox / d;
    const ny = oy / d;
    s.x += nx * (radius - d);
    s.y += ny * (radius - d);
    const [svx, svy] = surf ? surf(px, py) : [0, 0];
    const rvx = s.vx - svx;
    const rvy = s.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      s.vx = svx + rvx - (1 + e) * vn * nx;
      s.vy = svy + rvy - (1 + e) * vn * ny;
    }
    return true;
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    const leftDown = s.touchFlip[0] || k.has('ArrowLeft') || k.has('KeyZ') || k.has('KeyA');
    const rightDown =
      s.touchFlip[1] || k.has('ArrowRight') || k.has('KeyM') || k.has('Slash') || k.has('KeyD');
    const spaceDown = k.has('Space') || k.has('ArrowDown');
    if (leftDown || rightDown || spaceDown) s.started = true;
    if (spaceDown && s.inLane && s.y > 560) s.charging = true;
    if (s.spaceWas && !spaceDown && s.charging) launch();
    s.spaceWas = spaceDown;
    if (s.charging) s.charge = Math.min(1, s.charge + dt * 1.2);

    if (!s.over && !s.lost) {
      s.saverT = Math.max(0, s.saverT - dt);
      const h = dt / SUB;
      for (let step = 0; step < SUB; step++) {
        // flippers
        FLIPPERS.forEach((f, i) => {
          const st = s.flip[i]!;
          const pressed = i === 0 ? leftDown : rightDown;
          const target = pressed ? f.up : f.rest;
          const speed = pressed ? 26 : 16;
          const prev = st.a;
          const diff = target - st.a;
          st.a += clamp(diff, -speed * h, speed * h);
          st.w = (st.a - prev) / h;
        });
        if (s.inLane && s.y >= 596 && s.vy >= 0) {
          s.y = 596;
          s.vy = 0;
          s.x = LANE_X;
          continue;
        }
        s.vy += GRAV * h;
        s.x += s.vx * h;
        s.y += s.vy * h;
        if (s.inLane && s.x < 312) {
          s.inLane = false;
          s.gate = true;
        }
        for (const w of WALLS) collideSeg(w, R, 0.45);
        if (s.gate) collideSeg(GATE, R, 0.45);
        for (const sl of SLINGS)
          if (collideSeg(sl, R, 0.6)) {
            const [ax, ay, bx, by] = sl;
            let nx = -(by - ay);
            let ny = bx - ax;
            const len = Math.hypot(nx, ny);
            nx /= len;
            ny /= len;
            if (nx * (s.x - ax) + ny * (s.y - ay) < 0) {
              nx = -nx;
              ny = -ny;
            }
            s.vx += nx * 260;
            s.vy += ny * 260;
            s.flash.set(`sl${sl[0]}`, 0.12);
            add(20, s.x, s.y);
            api.sfx('tap');
          }
        STANDUPS.forEach((st, i) => {
          if (collideSeg(st, R, 0.5)) {
            if ((s.flash.get(`st${i}`) ?? 0) <= 0) {
              add(500, s.x, s.y);
              api.sfx('score');
            }
            s.flash.set(`st${i}`, 0.4);
          }
        });
        for (const [i, b] of BUMPERS.entries()) {
          const dx = s.x - b.x;
          const dy = s.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < b.r + R && d > 0) {
            const nx = dx / d;
            const ny = dy / d;
            s.x = b.x + nx * (b.r + R);
            s.y = b.y + ny * (b.r + R);
            s.vx = nx * 560 + s.vx * 0.15;
            s.vy = ny * 560 + s.vy * 0.15;
            s.flash.set(`b${i}`, 0.15);
            add(100, b.x, b.y);
            shake.add(2);
            particles.burst(b.x + nx * b.r, b.y + ny * b.r, {
              count: 6,
              color: light,
              speed: 120,
              life: 0.3,
            });
            api.sfx('hit');
          }
        }
        FLIPPERS.forEach((f, i) => {
          const st = s.flip[i]!;
          const tx = f.px + Math.cos(st.a) * FLIP_LEN;
          const ty = f.py + Math.sin(st.a) * FLIP_LEN;
          collideSeg([f.px, f.py, tx, ty], R + 7, 0.35, (px, py) => [
            -(py - f.py) * st.w * flipPower,
            (px - f.px) * st.w * flipPower,
          ]);
        });
        const sp = Math.hypot(s.vx, s.vy);
        if (sp > 1900) {
          s.vx *= 1900 / sp;
          s.vy *= 1900 / sp;
        }
      }
      LANES.forEach((l, i) => {
        if (!s.lanes[i] && Math.hypot(s.x - l.x, s.y - l.y) < 16) {
          s.lanes[i] = true;
          add(150, l.x, l.y);
          api.sfx('coin');
          if (s.lanes.every(Boolean)) {
            s.lanes = [false, false, false];
            s.mult = Math.min(8, s.mult + 1);
            floaters.add(`Multiplier ×${s.mult}!`, W / 2, 180, light, 22, 1.4);
            api.sfx('levelup');
            api.addCoins(2);
          }
        }
      });
      if (s.y > H + 30) {
        if (s.saverT > 0) {
          floaters.add('Ball saved!', W / 2, 420, '#86efac', 22, 1.2);
          api.sfx('powerup');
          resetBall();
        } else {
          s.balls -= 1;
          s.lost = true;
          api.sfx('miss');
          api.haptic(60);
          if (s.balls > 0) {
            floaters.add(`${s.balls} ball${s.balls > 1 ? 's' : ''} left`, W / 2, 420, '#fff', 20, 1.2);
            resetBall();
          } else {
            s.over = true;
            continueGate(
              () => {
                s.over = false;
                s.balls = 1;
                resetBall();
              },
              () =>
                api.gameOver({
                  score: s.score,
                  stats: [{ label: 'Best multiplier', value: `×${s.mult}` }],
                }),
            );
          }
        }
      }
    }
    for (const [key, t] of s.flash) s.flash.set(key, t - dt);
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    const glow = (seg: Seg, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(seg[0], seg[1]);
      ctx.lineTo(seg[2], seg[3]);
      ctx.stroke();
    };
    ctx.fillStyle = shade(bg, 0.08);
    ctx.beginPath();
    ctx.moveTo(20, 470);
    ctx.lineTo(20, 140);
    for (const a of ARC) ctx.lineTo(a[2], a[3]);
    ctx.lineTo(346, 640);
    ctx.lineTo(20, 640);
    ctx.fill();
    for (const wseg of WALLS) glow(wseg, accent, 4);
    if (s.gate) glow(GATE, light, 3);
    SLINGS.forEach((sl) => glow(sl, (s.flash.get(`sl${sl[0]}`) ?? 0) > 0 ? '#fff' : '#22d3ee', 6));
    STANDUPS.forEach((st, i) => glow(st, (s.flash.get(`st${i}`) ?? 0) > 0 ? '#fff' : '#f472b6', 7));
    LANES.forEach((l, i) => {
      circle(ctx, l.x, l.y, 9, s.lanes[i] ? light : 'rgba(255,255,255,0.12)');
      ctx.strokeStyle = light;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 12, 0, Math.PI * 2);
      ctx.stroke();
    });
    BUMPERS.forEach((b, i) => {
      const lit = (s.flash.get(`b${i}`) ?? 0) > 0;
      circle(ctx, b.x, b.y, b.r + 4, lit ? '#fff' : shade(accent, -0.3));
      circle(ctx, b.x, b.y, b.r, lit ? light : accent);
      circle(ctx, b.x, b.y, b.r * 0.45, light);
    });
    FLIPPERS.forEach((f, i) => {
      const st = s.flip[i]!;
      const tx = f.px + Math.cos(st.a) * FLIP_LEN;
      const ty = f.py + Math.sin(st.a) * FLIP_LEN;
      glow([f.px, f.py, tx, ty], '#fde047', 14);
      circle(ctx, f.px, f.py, 6, '#a16207');
    });
    // plunger
    fillRoundRect(ctx, 320, 606 + s.charge * 24, 20, 30, 4, '#94a3b8');
    circle(ctx, s.x, s.y, R, '#e5e7eb');
    circle(ctx, s.x - 3, s.y - 3, 3, '#fff');
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    // HUD
    text(ctx, s.score.toLocaleString('en'), W / 2, 22, { size: 22, weight: 900, color: light });
    text(ctx, `×${s.mult}`, 40, 22, { size: 18, weight: 900, color: accent });
    for (let i = 0; i < s.balls; i++) circle(ctx, W - 30 - i * 16, 22, 5, '#e5e7eb');
    if (s.saverT > 0 && !s.inLane)
      text(ctx, 'BALL SAVER', W / 2, 620, {
        size: 11,
        weight: 900,
        color: '#86efac',
        alpha: 0.6 + Math.sin(s.clock * 10) * 0.4,
      });
    if (s.inLane && s.y > 560 && !s.over)
      text(ctx, s.charging ? 'Release to launch!' : 'Hold to pull the plunger', W / 2 - 10, 440, {
        size: 14,
        weight: 800,
        alpha: 0.7 + Math.sin(s.clock * 5) * 0.3,
      });
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Pinball Frenzy game area"
      onPointerDown={onDown}
      onPointerUp={onUp}
    />
  );
}
