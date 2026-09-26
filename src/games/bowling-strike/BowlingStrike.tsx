import { useRef, useState } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  circle,
  fillRoundRect,
  text,
  useGameLoop,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';
import { frameScores, marks, position } from './logic';
import styles from './BowlingStrike.module.css';

const W = 360;
const H = 640;
const LANE_L = 112;
const LANE_R = 248;
const BALL_R = 11;
const PIN_R = 7;
const START_Y = 560;
const HEAD_Y = 196;

interface Pin {
  x: number;
  y: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  down: boolean;
  gone: boolean;
}

const rack = (): Pin[] => {
  const pins: Pin[] = [];
  for (let row = 0; row < 4; row++)
    for (let j = 0; j <= row; j++) {
      const x = W / 2 + (j - row / 2) * 25;
      const y = HEAD_Y - row * 21;
      pins.push({ x, y, ox: x, oy: y, vx: 0, vy: 0, down: false, gone: false });
    }
  return pins;
};

type Phase = 'position' | 'rolling' | 'result' | 'over';

export function BowlingStrike({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const ballMass = 6 * (1 + 0.12 * lo.level('weight'));
  const hookMul = 1 + 0.15 * lo.level('hook');
  const guide = lo.level('guide');
  const fx = useRef({
    particles: new Particles(200, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const [bumperState, setBumperState] = useState<'available' | 'loading' | 'used'>('available');
  const s = useRef({
    phase: 'position' as Phase,
    pins: rack(),
    ball: { x: W / 2, y: START_Y, vx: 0, vy: 0, spin: 0, gutter: false },
    rolls: [] as number[],
    path: [] as { x: number; y: number; t: number }[],
    dragMode: null as null | 'move' | 'throw',
    settleT: 0,
    resultT: 0,
    resultText: '',
    bumpers: -1,
    strikes: 0,
    spares: 0,
    clock: 0,
  }).current;

  const onDown = (p: StagePointer) => {
    if (s.phase !== 'position') return;
    s.path = [{ x: p.x, y: p.y, t: s.clock }];
    s.dragMode = null;
  };
  const onMove = (p: StagePointer) => {
    if (s.phase !== 'position' || s.path.length === 0) return;
    const a = s.path[0]!;
    if (s.dragMode === null) {
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) s.dragMode = 'move';
      else if (dy < -14) s.dragMode = 'throw';
    }
    if (s.dragMode === 'move') {
      const last = s.path[s.path.length - 1]!;
      s.ball.x = clamp(s.ball.x + (p.x - last.x), LANE_L + BALL_R, LANE_R - BALL_R);
    }
    s.path.push({ x: p.x, y: p.y, t: s.clock });
  };
  const onUp = (p: StagePointer) => {
    if (s.phase !== 'position' || s.path.length === 0) return;
    s.path.push({ x: p.x, y: p.y, t: s.clock });
    if (s.dragMode === 'throw') {
      const a = s.path[0]!;
      const b = s.path[s.path.length - 1]!;
      const recent = s.path.filter((q) => b.t - q.t < 0.15);
      const r0 = recent[0] ?? a;
      const dtSwipe = Math.max(0.03, b.t - r0.t);
      const speed = clamp(Math.hypot(b.x - r0.x, b.y - r0.y) / dtSwipe, 300, 1400);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      let dev = 0;
      for (const q of s.path) {
        const d = ((q.x - a.x) * dy - (q.y - a.y) * dx) / L;
        if (Math.abs(d) > Math.abs(dev)) dev = d;
      }
      const v = 380 + (speed - 300) * 0.45;
      s.ball.vx = (dx / Math.max(40, -dy)) * v * 0.55;
      s.ball.vy = -v;
      s.ball.spin = clamp(-dev / 45, -1.2, 1.2) * hookMul;
      s.phase = 'rolling';
      api.sfx('swap');
    }
    s.path = [];
    s.dragMode = null;
  };

  const requestBumpers = async () => {
    if (bumperState !== 'available' || s.phase !== 'position') return;
    setBumperState('loading');
    const ok = await api.watchAd('Bumpers for this frame');
    if (ok) {
      s.bumpers = position(s.rolls).frame;
      setBumperState('used');
      api.sfx('powerup');
    } else setBumperState('available');
  };

  const nextRoll = () => {
    const pos = position(s.rolls);
    if (pos.done) {
      s.phase = 'over';
      const totals = frameScores(s.rolls);
      const final = totals[9] ?? 0;
      api.setScore(final);
      api.gameOver({
        score: final,
        won: final >= 150,
        stats: [
          { label: 'Strikes', value: String(s.strikes) },
          { label: 'Spares', value: String(s.spares) },
        ],
      });
      return;
    }
    if (pos.standing === 10) s.pins = rack();
    else {
      s.pins = s.pins.filter((p) => !p.down && !p.gone);
      for (const p of s.pins) {
        p.x = p.ox;
        p.y = p.oy;
        p.vx = 0;
        p.vy = 0;
      }
    }
    s.ball = { x: W / 2, y: START_Y, vx: 0, vy: 0, spin: 0, gutter: false };
    s.phase = 'position';
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const pos = position(s.rolls);
    const bumpersOn = s.bumpers === pos.frame;

    if (s.phase === 'rolling') {
      const SUB = 4;
      const h = dt / SUB;
      for (let k = 0; k < SUB; k++) {
        const b = s.ball;
        if (!b.gutter) {
          const progress = clamp((START_Y - b.y) / (START_Y - HEAD_Y), 0, 1);
          b.vx += b.spin * 150 * progress * h;
        }
        b.x += b.vx * h;
        b.y += b.vy * h;
        b.vy *= 1 - 0.05 * h;
        if (!b.gutter && (b.x < LANE_L + BALL_R * 0.3 || b.x > LANE_R - BALL_R * 0.3)) {
          if (bumpersOn) {
            b.x = clamp(b.x, LANE_L + BALL_R, LANE_R - BALL_R);
            b.vx = -b.vx * 0.6;
            b.spin *= -0.3;
            api.sfx('tap');
          } else if (b.y > HEAD_Y - 70) {
            b.gutter = true;
            b.x = b.x < W / 2 ? LANE_L - 8 : LANE_R + 8;
            b.vx = 0;
            api.sfx('miss');
          }
        }
        // collisions
        const bodies = [
          {
            m: ballMass,
            o: b as { x: number; y: number; vx: number; vy: number },
            r: BALL_R,
            pin: null as Pin | null,
          },
        ].concat(s.pins.filter((p) => !p.gone).map((p) => ({ m: 1.6, o: p, r: PIN_R, pin: p })));
        for (let i = 0; i < bodies.length; i++)
          for (let j = i + 1; j < bodies.length; j++) {
            const A = bodies[i]!;
            const B = bodies[j]!;
            if (i === 0 && s.ball.gutter) continue;
            const dx = B.o.x - A.o.x;
            const dy = B.o.y - A.o.y;
            const d = Math.hypot(dx, dy);
            const min = A.r + B.r;
            if (d >= min || d === 0) continue;
            const nx = dx / d;
            const ny = dy / d;
            const t = A.m + B.m;
            A.o.x -= nx * (min - d) * (B.m / t);
            A.o.y -= ny * (min - d) * (B.m / t);
            B.o.x += nx * (min - d) * (A.m / t);
            B.o.y += ny * (min - d) * (A.m / t);
            const rel = (B.o.vx - A.o.vx) * nx + (B.o.vy - A.o.vy) * ny;
            if (rel < 0) {
              const imp = (-(1 + 0.75) * rel) / (1 / A.m + 1 / B.m);
              A.o.vx -= (imp / A.m) * nx;
              A.o.vy -= (imp / A.m) * ny;
              B.o.vx += (imp / B.m) * nx;
              B.o.vy += (imp / B.m) * ny;
              if (Math.abs(rel) > 60) api.sfx('hit');
            }
          }
        for (const p of s.pins) {
          if (p.gone) continue;
          p.x += p.vx * h;
          p.y += p.vy * h;
          p.vx *= 1 - 2.2 * h;
          p.vy *= 1 - 2.2 * h;
          if (!p.down && (Math.hypot(p.x - p.ox, p.y - p.oy) > 5 || Math.hypot(p.vx, p.vy) > 45)) {
            p.down = true;
            particles.burst(p.x, p.y, { count: 4, color: '#fff', speed: 60, life: 0.3 });
          }
          if (p.x < LANE_L - 4 || p.x > LANE_R + 4 || p.y < 92) {
            p.down = true;
            p.gone = true;
          }
        }
      }
      const moving = s.pins.some((p) => !p.gone && Math.hypot(p.vx, p.vy) > 6);
      if (s.ball.y < 80 || (Math.abs(s.ball.vy) < 20 && Math.abs(s.ball.vx) < 20)) {
        s.settleT += dt;
        if (!moving && s.settleT > 0.5) {
          const standingBefore = pos.standing;
          const knocked = s.pins.filter((p) => p.down).length;
          const fromThisRack = standingBefore === 10 ? knocked : Math.min(standingBefore, knocked);
          s.rolls.push(fromThisRack);
          s.settleT = 0;
          const strike =
            pos.roll === 0
              ? fromThisRack === 10
              : pos.frame === 9 && standingBefore === 10 && fromThisRack === 10;
          const spare = !strike && fromThisRack === standingBefore && pos.roll > 0;
          if (strike) {
            s.strikes += 1;
            s.resultText = 'STRIKE!';
            api.addCoins(3);
            api.sfx('win');
            shake.add(8);
          } else if (spare) {
            s.spares += 1;
            s.resultText = 'SPARE!';
            api.addCoins(1);
            api.sfx('perfect');
          } else
            s.resultText =
              fromThisRack === 0
                ? s.ball.gutter
                  ? 'Gutter ball'
                  : 'Miss'
                : `${fromThisRack} pin${fromThisRack === 1 ? '' : 's'}`;
          const totals = frameScores(s.rolls);
          const known = totals.filter((x): x is number => x !== null);
          if (known.length) api.setScore(known[known.length - 1]!);
          s.phase = 'result';
          s.resultT = 1.2;
        }
      } else s.settleT = 0;
    } else if (s.phase === 'result') {
      s.resultT -= dt;
      if (s.resultT <= 0) nextRoll();
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    ctx.fillStyle = '#292524';
    ctx.fillRect(LANE_L - 18, 0, 18, H);
    ctx.fillRect(LANE_R, 0, 18, H);
    const lane = ctx.createLinearGradient(LANE_L, 0, LANE_R, 0);
    lane.addColorStop(0, '#d97706');
    lane.addColorStop(0.5, '#f59e0b');
    lane.addColorStop(1, '#d97706');
    ctx.fillStyle = lane;
    ctx.fillRect(LANE_L, 0, LANE_R - LANE_L, H);
    ctx.strokeStyle = 'rgba(120,53,15,0.35)';
    ctx.lineWidth = 1;
    for (let x = LANE_L + 9; x < LANE_R; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.fillStyle = '#78350f';
    for (let i = 0; i < 7; i++) {
      const ax = LANE_L + 14 + i * 18;
      ctx.beginPath();
      ctx.moveTo(ax, 380);
      ctx.lineTo(ax + 5, 392);
      ctx.lineTo(ax - 5, 392);
      ctx.fill();
    }
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(LANE_L, 500, LANE_R - LANE_L, 3);
    if (bumpersOn) {
      ctx.fillStyle = '#f472b6';
      ctx.fillRect(LANE_L - 6, 0, 6, H);
      ctx.fillRect(LANE_R, 0, 6, H);
    }
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(LANE_L - 18, 64, LANE_R - LANE_L + 36, 28);
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, W, 64);
    for (const p of s.pins) {
      if (p.gone) continue;
      if (p.down) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2);
        fillRoundRect(ctx, -4, -10, 8, 20, 4, '#e7e5e4');
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-4, -5, 8, 2);
        ctx.restore();
      } else {
        circle(ctx, p.x, p.y + 2, PIN_R, 'rgba(0,0,0,0.25)');
        circle(ctx, p.x, p.y, PIN_R, '#fafaf9');
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PIN_R - 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (s.phase === 'position' && guide > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([4, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.ball.x, START_Y - 14);
      ctx.lineTo(s.ball.x, START_Y - 80 - guide * 90);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const [b0, b1, b2] = lo.skin.colors;
    const b = s.ball;
    circle(ctx, b.x, b.y + 3, BALL_R, 'rgba(0,0,0,0.3)');
    circle(ctx, b.x, b.y, BALL_R, b0);
    circle(ctx, b.x + 3, b.y + 2, BALL_R * 0.5, b1);
    const rot = s.clock * (s.phase === 'rolling' ? 10 : 0);
    for (let i = 0; i < 3; i++)
      circle(ctx, b.x + Math.cos(rot + i * 0.8) * 4, b.y + Math.sin(rot + i * 0.8) * 4 - 1, 1.8, b2);
    if (s.path.length > 1 && s.dragMode === 'throw') {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      s.path.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
      ctx.stroke();
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    // score sheet
    const totals = frameScores(s.rolls);
    const mk = marks(s.rolls);
    const cw = (W - 12) / 10;
    for (let f = 0; f < 10; f++) {
      const x = 6 + f * cw;
      fillRoundRect(
        ctx,
        x + 1,
        6,
        cw - 2,
        38,
        4,
        f === pos.frame && s.phase !== 'over' ? 'rgba(252,211,77,0.3)' : 'rgba(0,0,0,0.45)',
      );
      text(ctx, mk[f]!.join(' '), x + cw / 2, 17, { size: 10, weight: 800, color: '#fde68a' });
      const t = totals[f];
      text(ctx, t === null || t === undefined ? '' : String(t), x + cw / 2, 34, { size: 12, weight: 900 });
    }
    text(ctx, `Frame ${pos.frame + 1} · Roll ${pos.roll + 1}`, W / 2, 55, {
      size: 12,
      weight: 700,
      color: '#e2e8f0',
    });
    if (s.phase === 'result')
      text(ctx, s.resultText, W / 2, 300, {
        size: 34,
        weight: 900,
        color: '#fde047',
        stroke: 'rgba(0,0,0,0.5)',
        strokeWidth: 6,
      });
    if (s.phase === 'position' && s.rolls.length === 0)
      text(ctx, 'Drag sideways to aim · swipe up to roll', W / 2, 610, {
        size: 13,
        weight: 700,
        alpha: 0.6 + Math.sin(s.clock * 4) * 0.3,
      });
  }, !paused);

  return (
    <div className={styles.wrap}>
      <CanvasStage
        ref={view}
        width={W}
        height={H}
        label="Bowling Strike game area"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      />
      {bumperState !== 'used' && (
        <button
          type="button"
          className={styles.bumpers}
          onClick={() => void requestBumpers()}
          disabled={bumperState === 'loading' || paused}
        >
          🛡️ Bumpers <span>ad</span>
        </button>
      )}
    </div>
  );
}
