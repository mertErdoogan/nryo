import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  createContinueGate,
  useGameLoop,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import type { GameProps } from '../../platform/types';
import {
  BALL_R,
  basketPoints,
  bounceOffPoint,
  GRAVITY,
  launchVelocity,
  RIM_HALF,
  RIM_R,
  type Ball,
} from './physics';

const W = 360;
const H = 640;
const FLOOR = H - 40;
const LIVES = 3;

export function HoopShot({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const [ballColor, seamColor] = lo.skin.colors;
  const lives = LIVES + lo.level('lives');
  const previewDots = 26 + 8 * lo.level('sight');
  const continueGate = useRef(createContinueGate(api)).current;
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const s = useRef({
    ball: { x: W / 2, y: FLOOR - BALL_R - 40, vx: 0, vy: 0 } as Ball,
    home: { x: W / 2, y: FLOOR - BALL_R - 40 },
    flying: false,
    flightTime: 0,
    touched: false,
    scored: false,
    drag: null as null | { x0: number; y0: number; x: number; y: number },
    hoop: { x: 200, y: 250, baseX: 200, baseY: 250, t: 0, side: 1 },
    score: 0,
    makes: 0,
    streak: 0,
    bestStreak: 0,
    misses: 0,
    shots: 0,
    spin: 0,
    netWave: 0,
    over: false,
    overTimer: 0,
    ended: false,
    waiting: false,
    time: 0,
  }).current;

  const placeHoop = () => {
    const x = rng.range(90, W - 90);
    const y = rng.range(160, 300);
    s.hoop = { x, y, baseX: x, baseY: y, t: rng.range(0, 6), side: x > W / 2 ? 1 : -1 };
    const hx = rng.range(70, W - 70);
    s.home = { x: hx, y: FLOOR - BALL_R - 40 };
  };

  const resetBall = () => {
    s.ball = { x: s.home.x, y: s.home.y, vx: 0, vy: 0 };
    s.flying = false;
    s.touched = false;
    s.scored = false;
    s.flightTime = 0;
  };

  const endAttempt = () => {
    if (!s.scored) {
      s.misses += 1;
      s.streak = 0;
      api.sfx('miss');
      api.haptic(40);
      fx.current.floaters.add(
        s.misses >= lives ? 'Game over' : `Miss! ${lives - s.misses} left`,
        W / 2,
        H / 2,
        '#fca5a5',
        22,
      );
      if (s.misses >= lives) {
        s.over = true;
        s.overTimer = 1;
        return;
      }
    } else placeHoop();
    resetBall();
  };

  const onDown = (p: StagePointer) => {
    if (s.flying || s.over) return;
    s.drag = { x0: p.x, y0: p.y, x: p.x, y: p.y };
  };
  const onMove = (p: StagePointer) => {
    if (!s.drag) return;
    s.drag.x = p.x;
    s.drag.y = p.y;
  };
  const onUp = () => {
    const d = s.drag;
    s.drag = null;
    if (!d || s.flying || s.over) return;
    const dx = d.x - d.x0;
    const dy = d.y - d.y0;
    if (Math.hypot(dx, dy) < 20) return;
    const v = launchVelocity(dx, dy);
    s.ball.vx = v.vx;
    s.ball.vy = v.vy;
    s.flying = true;
    s.shots += 1;
    api.sfx('jump');
  };

  useGameLoop((dt) => {
    const view_ = view.current;
    if (!view_) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;
    const h = s.hoop;
    // hoop movement ramps up with makes
    h.t += dt;
    if (s.makes >= 5)
      h.x = h.baseX + Math.sin(h.t * (s.makes >= 15 ? 1.6 : 0.9)) * Math.min(70, 30 + s.makes * 2);
    if (s.makes >= 15) h.y = h.baseY + Math.sin(h.t * 1.3) * 25;
    h.x = Math.max(60, Math.min(W - 60, h.x));
    const board = h.side > 0 ? h.x + RIM_HALF + 8 : h.x - RIM_HALF - 8;

    if (s.flying) {
      const b = s.ball;
      const steps = 3;
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        const prevY = b.y;
        b.vy += GRAVITY * sdt;
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        s.spin += b.vx * sdt * 0.05;
        for (const px of [h.x - RIM_HALF, h.x + RIM_HALF]) {
          if (bounceOffPoint(b, px, h.y, RIM_R, 0.55)) {
            if (!s.touched) api.sfx('tap');
            s.touched = true;
          }
        }
        // backboard (vertical segment)
        const top = h.y - 78;
        const bottom = h.y + 6;
        if (b.y > top - BALL_R && b.y < bottom + BALL_R && Math.abs(b.x - board) < BALL_R + 3) {
          const closestY = Math.max(top, Math.min(bottom, b.y));
          if (bounceOffPoint(b, board, closestY, 3, 0.65)) {
            s.touched = true;
            api.sfx('tick');
          }
        }
        if (b.x < BALL_R) {
          b.x = BALL_R;
          b.vx = Math.abs(b.vx) * 0.7;
        } else if (b.x > W - BALL_R) {
          b.x = W - BALL_R;
          b.vx = -Math.abs(b.vx) * 0.7;
        }
        // score: crossing the rim plane downward inside the hoop
        if (
          !s.scored &&
          prevY < h.y &&
          b.y >= h.y &&
          b.vy > 0 &&
          b.x > h.x - RIM_HALF + 4 &&
          b.x < h.x + RIM_HALF - 4
        ) {
          s.scored = true;
          s.makes += 1;
          s.streak += 1;
          s.bestStreak = Math.max(s.bestStreak, s.streak);
          const swish = !s.touched;
          const pts = basketPoints(swish, s.streak);
          if (swish) api.addCoins(1);
          s.score += pts;
          api.setScore(s.score);
          s.netWave = 1;
          floaters.add(
            swish ? `SWISH! +${pts}` : `+${pts}`,
            h.x,
            h.y - 40,
            swish ? '#fde047' : '#fff',
            swish ? 26 : 22,
          );
          if (s.streak === 3 || s.streak === 6)
            floaters.add(s.streak === 6 ? 'UNSTOPPABLE ×3' : 'ON FIRE ×2', W / 2, 120, '#fb923c', 24, 1.3);
          particles.burst(h.x, h.y + 20, {
            count: swish ? 30 : 16,
            colors: ['#fde047', '#fb923c', '#fff'],
            speed: 200,
            life: 0.6,
          });
          api.sfx(swish ? 'perfect' : 'score');
          api.haptic(20);
        }
        if (b.y > FLOOR - BALL_R) {
          b.y = FLOOR - BALL_R;
          b.vy = -Math.abs(b.vy) * 0.5;
          b.vx *= 0.8;
        }
      }
      s.flightTime += dt;
      const settled = b.y >= FLOOR - BALL_R - 2 && Math.abs(b.vy) < 80;
      if (s.flightTime > 4 || settled || (s.scored && b.y > h.y + 140) || b.y < -400) endAttempt();
    }
    if (s.over && !s.ended && !s.waiting) {
      s.overTimer -= dt;
      if (s.overTimer <= 0) {
        s.waiting = true;
        continueGate(
          () => {
            s.misses = lives - 2;
            s.over = false;
            s.waiting = false;
            resetBall();
            floaters.add('+2 balls', W / 2, H / 2, '#86efac', 26, 1.2);
          },
          () => {
            s.ended = true;
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Baskets', value: `${s.makes}/${s.shots}` },
                { label: 'Best streak', value: String(s.bestStreak) },
              ],
            });
          },
        );
      }
    }
    s.netWave = Math.max(0, s.netWave - dt * 2);
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = view_.ctx;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(1, '#431407');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // court floor
    ctx.fillStyle = '#9a3412';
    ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let x = 0; x < W; x += 40) ctx.fillRect(x, FLOOR, 2, H - FLOOR);
    ctx.save();
    shake.apply(ctx);
    // backboard
    fillRoundRect(ctx, board - 4, h.y - 82, 8, 92, 3, '#e2e8f0');
    ctx.fillStyle = '#64748b';
    ctx.fillRect(h.side > 0 ? board + 4 : board - 14, h.y - 30, 10, 6);
    // net (behind ball)
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    const netH = 36 + s.netWave * 10;
    for (let i = 0; i <= 6; i++) {
      const tx = h.x - RIM_HALF + (i / 6) * RIM_HALF * 2;
      const bx = h.x - RIM_HALF * 0.55 + (i / 6) * RIM_HALF * 1.1;
      ctx.beginPath();
      ctx.moveTo(tx, h.y);
      ctx.lineTo(bx, h.y + netH);
      ctx.stroke();
    }
    for (let j = 1; j <= 3; j++) {
      const f = j / 3;
      const hw = RIM_HALF * (1 - f * 0.45);
      ctx.beginPath();
      ctx.moveTo(h.x - hw, h.y + netH * f);
      ctx.lineTo(h.x + hw, h.y + netH * f);
      ctx.stroke();
    }
    // trajectory preview
    if (s.drag && !s.flying) {
      const v = launchVelocity(s.drag.x - s.drag.x0, s.drag.y - s.drag.y0);
      let x = s.ball.x;
      let y = s.ball.y;
      const vx = v.vx;
      let vy = v.vy;
      for (let i = 0; i < previewDots; i++) {
        vy += GRAVITY * 0.03;
        x += vx * 0.03;
        y += vy * 0.03;
        const k = i / previewDots;
        circle(ctx, x, y, 3.2 - k * 2, `rgba(255,255,255,${0.8 - k * 0.72})`);
      }
    }
    // ball
    const b = s.ball;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(s.spin);
    circle(ctx, 0, 0, BALL_R, ballColor);
    ctx.strokeStyle = seamColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.moveTo(-BALL_R, 0);
    ctx.lineTo(BALL_R, 0);
    ctx.moveTo(0, -BALL_R);
    ctx.lineTo(0, BALL_R);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-BALL_R * 1.1, 0, BALL_R * 0.8, -0.9, 0.9);
    ctx.arc(BALL_R * 1.1, 0, BALL_R * 0.8, Math.PI - 0.9, Math.PI + 0.9);
    ctx.stroke();
    ctx.restore();
    // rim in front
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(h.x - RIM_HALF, h.y);
    ctx.lineTo(h.x + RIM_HALF, h.y);
    ctx.stroke();
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    text(ctx, String(s.score), W / 2, 56, {
      size: 44,
      weight: 850,
      stroke: 'rgba(0,0,0,0.35)',
      strokeWidth: 6,
    });
    text(ctx, '🏀'.repeat(Math.max(0, lives - s.misses)), 14, 24, { size: 16, align: 'left' });
    if (s.streak >= 3)
      text(ctx, `🔥 ×${s.streak >= 6 ? 3 : 2}`, W - 14, 24, {
        size: 16,
        align: 'right',
        color: '#fb923c',
        weight: 800,
      });
    if (s.shots === 0 && !s.drag) prompt(ctx, 'Drag back and release to shoot', W / 2, H - 16, s.time, 16);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Hoop Shot court"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
