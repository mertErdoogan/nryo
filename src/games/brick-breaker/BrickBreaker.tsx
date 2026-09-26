import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  createContinueGate,
  useGameLoop,
  useHeldKeys,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import { clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';
import { BRICK_H, BRICK_W, buildLevel, collideCircleRect, paddleBounce, type Brick } from './logic';

const W = 360;
const H = 600;
const PADDLE_Y = 556;
const PADDLE_H = 12;
const BALL_R = 6;

type PowerKind = 'wide' | 'multi' | 'slow' | 'life';
const POWER_COLORS: Record<PowerKind, string> = {
  wide: '#60a5fa',
  multi: '#f472b6',
  slow: '#a3e635',
  life: '#f43f5e',
};
const POWER_LABEL: Record<PowerKind, string> = { wide: 'W', multi: 'M', slow: 'S', life: '♥' };

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  docked: boolean;
}

const HP_COLORS = ['#f472b6', '#c084fc', '#60a5fa'];

export function BrickBreaker({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const [paddleColor, glowColor, ballColor] = lo.skin.colors;
  const basePaddle = 72 + 6 * lo.level('paddle');
  const powerChance = 0.13 + 0.03 * lo.level('luck');
  const powerTime = 1 + 0.25 * lo.level('duration');
  const continueGate = useRef(createContinueGate(api)).current;
  const keys = useHeldKeys(!paused);
  const fx = useRef({
    particles: new Particles(500, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const s = useRef({
    level: 1,
    bricks: buildLevel(1, rng),
    balls: [{ x: W / 2, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, docked: true }] as Ball[],
    paddleX: W / 2,
    targetX: W / 2,
    wideTimer: 0,
    slowTimer: 0,
    powers: [] as { kind: PowerKind; x: number; y: number }[],
    lives: 3 + lo.level('lives'),
    waiting: false,
    score: 0,
    combo: 0,
    speedBoost: 0,
    clearTimer: 0,
    over: false,
    overTimer: 0,
    ended: false,
    time: 0,
    launchedOnce: false,
  }).current;

  const baseSpeed = () => (300 + s.level * 14 + s.speedBoost) * (s.slowTimer > 0 ? 0.7 : 1);
  const paddleW = () => (s.wideTimer > 0 ? basePaddle * 1.5 : basePaddle);

  const launch = () => {
    if (s.over || s.clearTimer > 0) return;
    for (const b of s.balls) {
      if (!b.docked) continue;
      const v = paddleBounce(rng.range(-0.35, 0.35), baseSpeed());
      b.vx = v.vx;
      b.vy = v.vy;
      b.docked = false;
      s.launchedOnce = true;
      api.sfx('jump');
    }
  };

  const onPointer = (p: StagePointer) => {
    s.targetX = p.x;
  };

  useKeyDown((code) => {
    if (code === 'Space' || code === 'ArrowUp' || code === 'Enter') launch();
    else return false;
  }, !paused);

  const addScore = (n: number) => {
    s.score += n;
    api.setScore(s.score);
  };

  const hitBrick = (brick: Brick) => {
    const { particles, floaters } = fx.current;
    if (brick.steel) {
      api.sfx('tick');
      return;
    }
    brick.hp -= 1;
    const cx = brick.x + BRICK_W / 2;
    const cy = brick.y + BRICK_H / 2;
    if (brick.hp > 0) {
      addScore(5);
      api.sfx('tap');
      return;
    }
    s.combo += 1;
    addScore(10 * brick.maxHp + (s.combo >= 3 ? s.combo * 5 : 0));
    if (s.combo >= 3 && s.combo % 3 === 0) floaters.add(`Combo ×${s.combo}`, cx, cy, '#fde047', 16, 0.8);
    particles.burst(cx, cy, {
      count: 12,
      colors: [HP_COLORS[brick.maxHp - 1] ?? '#fff', '#fff'],
      speed: 160,
      life: 0.5,
      shape: 'square',
      size: 5,
    });
    api.sfx('score');
    if (rng.chance(powerChance)) {
      const roll = rng.next();
      const kind: PowerKind = roll < 0.05 ? 'life' : roll < 0.4 ? 'wide' : roll < 0.72 ? 'multi' : 'slow';
      s.powers.push({ kind, x: cx, y: cy });
    }
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;
    s.wideTimer = Math.max(0, s.wideTimer - dt);
    s.slowTimer = Math.max(0, s.slowTimer - dt);

    const axis =
      (keys.current.has('ArrowRight') || keys.current.has('KeyD') ? 1 : 0) -
      (keys.current.has('ArrowLeft') || keys.current.has('KeyA') ? 1 : 0);
    if (axis) s.targetX = s.paddleX + axis * 30;
    const pw = paddleW();
    s.targetX = clamp(s.targetX, pw / 2, W - pw / 2);
    s.paddleX += clamp(s.targetX - s.paddleX, -900 * dt, 900 * dt);

    if (s.clearTimer > 0) {
      s.clearTimer -= dt;
      if (s.clearTimer <= 0) {
        s.level += 1;
        s.bricks = buildLevel(s.level, rng);
        s.balls = [{ x: s.paddleX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, docked: true }];
        s.powers = [];
        s.speedBoost = 0;
      }
    }

    if (!s.over) {
      for (const ball of s.balls) {
        if (ball.docked) {
          ball.x = s.paddleX;
          ball.y = PADDLE_Y - BALL_R - 1;
          continue;
        }
        const speed = baseSpeed();
        const cur = Math.hypot(ball.vx, ball.vy) || 1;
        ball.vx = (ball.vx / cur) * speed;
        ball.vy = (ball.vy / cur) * speed;
        const steps = Math.ceil((speed * dt) / 4);
        const sdt = dt / steps;
        for (let i = 0; i < steps; i++) {
          ball.x += ball.vx * sdt;
          ball.y += ball.vy * sdt;
          if (ball.x < BALL_R) {
            ball.x = BALL_R;
            ball.vx = Math.abs(ball.vx);
          } else if (ball.x > W - BALL_R) {
            ball.x = W - BALL_R;
            ball.vx = -Math.abs(ball.vx);
          }
          if (ball.y < BALL_R + 40) {
            ball.y = BALL_R + 40;
            ball.vy = Math.abs(ball.vy);
          }
          // paddle
          if (
            ball.vy > 0 &&
            collideCircleRect(ball.x, ball.y, BALL_R, s.paddleX - pw / 2, PADDLE_Y, pw, PADDLE_H)
          ) {
            const nv = paddleBounce((ball.x - s.paddleX) / (pw / 2), speed);
            ball.vx = nv.vx;
            ball.vy = nv.vy;
            ball.y = PADDLE_Y - BALL_R;
            s.combo = 0;
            s.speedBoost = Math.min(180, s.speedBoost + 3);
            api.sfx('tap');
            api.haptic(8);
          }
          // bricks
          for (const brick of s.bricks) {
            if (brick.hp <= 0) continue;
            const axisHit = collideCircleRect(ball.x, ball.y, BALL_R, brick.x, brick.y, BRICK_W, BRICK_H);
            if (!axisHit) continue;
            if (axisHit === 'x') {
              ball.vx = ball.x < brick.x + BRICK_W / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx);
            } else {
              ball.vy = ball.y < brick.y + BRICK_H / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy);
            }
            hitBrick(brick);
            break;
          }
        }
      }
      s.bricks = s.bricks.filter((b) => b.hp > 0);
      const lost = s.balls.filter((b) => b.y > H + 20);
      if (lost.length) {
        s.balls = s.balls.filter((b) => b.y <= H + 20);
        if (s.balls.length === 0) {
          s.lives -= 1;
          s.combo = 0;
          shake.add(8);
          api.sfx('miss');
          api.haptic(60);
          if (s.lives <= 0) {
            s.over = true;
            s.overTimer = 0.6;
          } else {
            s.balls = [{ x: s.paddleX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, docked: true }];
            s.wideTimer = 0;
            s.slowTimer = 0;
          }
        }
      }
      if (s.clearTimer <= 0 && s.bricks.every((b) => b.steel)) {
        const bonus = 200 * s.level;
        addScore(bonus);
        api.addCoins(1 + Math.floor(s.level / 2));
        floaters.add(`Wall ${s.level} cleared! +${bonus}`, W / 2, H / 2, '#86efac', 22, 1.4);
        particles.burst(W / 2, H / 2, {
          count: 60,
          colors: ['#f472b6', '#c084fc', '#60a5fa', '#fde047'],
          speed: 320,
          life: 1,
        });
        api.sfx('win');
        s.clearTimer = 1.5;
        s.balls = [];
      }
    } else if (!s.ended && !s.waiting) {
      s.overTimer -= dt;
      if (s.overTimer <= 0) {
        s.waiting = true;
        continueGate(
          () => {
            s.lives = 1;
            s.balls = [{ x: s.paddleX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, docked: true }];
            s.wideTimer = 8;
            s.over = false;
            s.waiting = false;
            fx.current.floaters.add('Extra ball!', W / 2, H / 2, '#86efac', 24, 1.2);
          },
          () => {
            s.ended = true;
            api.gameOver({ score: s.score, stats: [{ label: 'Wall reached', value: String(s.level) }] });
          },
        );
      }
    }

    for (const p of s.powers) {
      p.y += 130 * dt;
      if (p.y > PADDLE_Y - 8 && p.y < PADDLE_Y + PADDLE_H + 8 && Math.abs(p.x - s.paddleX) < pw / 2 + 12) {
        p.y = H + 100;
        api.sfx('powerup');
        floaters.add(
          { wide: 'Wide paddle!', multi: 'Multiball!', slow: 'Slow-mo!', life: '+1 life' }[p.kind],
          s.paddleX,
          PADDLE_Y - 30,
          POWER_COLORS[p.kind],
          16,
        );
        if (p.kind === 'wide') s.wideTimer = 12 * powerTime;
        else if (p.kind === 'slow') s.slowTimer = 8 * powerTime;
        else if (p.kind === 'life') s.lives = Math.min(5, s.lives + 1);
        else {
          const src = s.balls.find((b) => !b.docked) ?? s.balls[0];
          if (src) {
            for (const off of [-0.5, 0.5]) {
              const nv = paddleBounce(off, baseSpeed());
              s.balls.push({ x: src.x, y: src.y, vx: nv.vx, vy: nv.vy, docked: false });
            }
          }
        }
      }
    }
    s.powers = s.powers.filter((p) => p.y < H + 20);
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 38, W, 2);

    for (const b of s.bricks) {
      const color = b.steel ? '#94a3b8' : (HP_COLORS[b.hp - 1] ?? '#fff');
      fillRoundRect(ctx, b.x, b.y, BRICK_W, BRICK_H, 4, color);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(b.x + 3, b.y + 2, BRICK_W - 6, 3);
      if (b.steel) {
        ctx.strokeStyle = 'rgba(15,23,42,0.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(b.x + 2.5, b.y + 2.5, BRICK_W - 5, BRICK_H - 5);
      } else if (b.maxHp > 1 && b.hp < b.maxHp) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.moveTo(b.x + 8, b.y + 3);
        ctx.lineTo(b.x + 16, b.y + 10);
        ctx.lineTo(b.x + 12, b.y + 14);
        ctx.stroke();
      }
    }
    for (const p of s.powers) {
      fillRoundRect(ctx, p.x - 14, p.y - 8, 28, 16, 8, POWER_COLORS[p.kind]);
      text(ctx, POWER_LABEL[p.kind], p.x, p.y + 1, { size: 11, weight: 800, color: '#0f172a' });
    }
    const pwNow = paddleW();
    ctx.shadowColor = s.wideTimer > 0 ? '#60a5fa' : glowColor;
    ctx.shadowBlur = 16;
    fillRoundRect(
      ctx,
      s.paddleX - pwNow / 2,
      PADDLE_Y,
      pwNow,
      PADDLE_H,
      6,
      s.wideTimer > 0 ? '#93c5fd' : paddleColor,
    );
    ctx.shadowBlur = 0;
    for (const b of s.balls) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 10;
      circle(ctx, b.x, b.y, BALL_R, s.slowTimer > 0 ? '#bef264' : ballColor);
      ctx.shadowBlur = 0;
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    text(ctx, `Wall ${s.level}`, 14, 20, { size: 14, align: 'left', color: '#c4b5fd' });
    text(ctx, '♥'.repeat(Math.max(0, s.lives)), W - 14, 20, { size: 16, align: 'right', color: '#fb7185' });
    text(ctx, s.score.toLocaleString('en'), W / 2, 20, { size: 16, weight: 800 });
    if (!s.launchedOnce && !s.over) prompt(ctx, 'Tap to launch', W / 2, 460, s.time);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Brick Breaker game area"
      onPointerDown={(p) => {
        onPointer(p);
        launch();
      }}
      onPointerMove={onPointer}
    />
  );
}
