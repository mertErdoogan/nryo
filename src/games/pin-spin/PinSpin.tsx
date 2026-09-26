import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  useGameLoop,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import { angleDiff, TAU } from '../../lib/math';
import type { GameProps } from '../../platform/types';
import { angularVelocity, collides, normalizeAngle, planLevel, type LevelPlan } from './logic';

const W = 360;
const H = 640;
const CX = 180;
const CY = 230;
const R = 74;
const PIN_LEN = 66;
const LAUNCH_Y = 560;
const PIN_SPEED = 1700;

export function PinSpin({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const fx = useRef({
    particles: new Particles(400, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });

  const makeLevel = (level: number) => {
    const plan = planLevel(level);
    const stuck: number[] = [];
    let guard = 0;
    while (stuck.length < plan.preStuck && guard++ < 200) {
      const a = rng.range(0, TAU);
      if (!collides(a, stuck, 0.45)) stuck.push(a);
    }
    const gems: { angle: number; alive: boolean }[] = [];
    guard = 0;
    while (gems.length < plan.gems && guard++ < 200) {
      const a = rng.range(0, TAU);
      if (!collides(a, stuck, 0.5) && !gems.some((g) => Math.abs(angleDiff(g.angle, a)) < 0.6))
        gems.push({ angle: a, alive: true });
    }
    return { plan, stuck, gems, pinsLeft: plan.pins, rotation: rng.range(0, TAU), t: 0 };
  };

  const s = useRef({
    level: 1,
    ...makeLevel(1),
    flying: null as null | { y: number },
    falling: null as null | { x: number; y: number; vx: number; vy: number; rot: number },
    clearTimer: 0,
    shatter: 0,
    dead: false,
    deadTimer: 0,
    ended: false,
    score: 0,
    time: 0,
    thrown: 0,
    hitFlash: 0,
  }).current;

  const throwPin = () => {
    if (s.dead || s.flying || s.clearTimer > 0 || s.pinsLeft <= 0) return;
    s.flying = { y: LAUNCH_Y };
    s.pinsLeft -= 1;
    api.sfx('shoot');
  };

  useKeyDown((code) => {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowUp') throwPin();
  }, !paused);

  const impact = () => {
    const { particles, floaters, shake } = fx.current;
    const angle = normalizeAngle(Math.PI / 2 - s.rotation);
    if (collides(angle, s.stuck)) {
      s.dead = true;
      s.deadTimer = 1;
      s.falling = { x: CX, y: CY + R + PIN_LEN / 2, vx: rng.range(-120, 120), vy: 260, rot: 0 };
      shake.add(14);
      api.sfx('hit');
      api.haptic([50, 30, 50]);
      return;
    }
    s.stuck.push(angle);
    s.thrown += 1;
    s.score += 1;
    s.hitFlash = 1;
    shake.add(2);
    particles.burst(CX, CY + R, {
      count: 8,
      colors: ['#e9d5ff', '#fff'],
      speed: 120,
      life: 0.35,
      size: 3,
      angle: Math.PI / 2,
      spread: 2,
    });
    api.sfx('tap');
    for (const g of s.gems) {
      if (g.alive && Math.abs(angleDiff(g.angle, angle)) < 0.22) {
        g.alive = false;
        s.score += 3;
        floaters.add('+3 gem', CX, CY + R + 40, '#fde047', 20);
        particles.burst(CX, CY + R, { count: 18, colors: ['#fde047', '#f472b6'], speed: 200, life: 0.6 });
        api.sfx('coin');
      }
    }
    if (s.pinsLeft === 0) {
      s.clearTimer = 1.1;
      s.shatter = 1;
      s.score += 5;
      floaters.add(
        s.plan.boss ? 'Boss cleared! +5' : `Level ${s.level} clear! +5`,
        CX,
        CY,
        '#86efac',
        24,
        1.2,
      );
      particles.burst(CX, CY, {
        count: 50,
        colors: ['#a78bfa', '#c4b5fd', '#fff', '#f0abfc'],
        speed: 320,
        life: 0.9,
        size: 6,
        shape: 'square',
      });
      api.sfx('win');
      api.haptic(30);
    }
    api.setScore(s.score);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;
    s.hitFlash = Math.max(0, s.hitFlash - dt * 6);

    if (s.clearTimer > 0) {
      s.clearTimer -= dt;
      s.shatter = Math.max(0, s.shatter - dt * 1.2);
      if (s.clearTimer <= 0) {
        s.level += 1;
        Object.assign(s, makeLevel(s.level));
        api.sfx('powerup');
      }
    } else if (!s.dead) {
      s.t += dt;
      s.rotation += angularVelocity(s.plan, s.t) * dt;
    }

    if (s.flying) {
      s.flying.y -= PIN_SPEED * dt;
      if (s.flying.y <= CY + R) {
        s.flying = null;
        impact();
      }
    }
    if (s.falling) {
      s.falling.vy += 1400 * dt;
      s.falling.x += s.falling.vx * dt;
      s.falling.y += s.falling.vy * dt;
      s.falling.rot += 8 * dt;
    }
    if (s.dead && !s.ended) {
      s.deadTimer -= dt;
      if (s.deadTimer <= 0) {
        s.ended = true;
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Level', value: String(s.level) },
            { label: 'Pins', value: String(s.thrown) },
          ],
        });
      }
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    const bg = ctx.createRadialGradient(CX, CY, 20, CX, CY, 520);
    bg.addColorStop(0, s.plan.boss ? '#4c0519' : '#2e1065');
    bg.addColorStop(1, '#0b0718');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    shake.apply(ctx);

    const drawPin = (x: number, y: number, rot: number, color = '#f5f3ff') => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      fillRoundRect(ctx, -3, 0, 6, PIN_LEN - 12, 3, color);
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(0, -8);
      ctx.lineTo(3, 0);
      ctx.fillStyle = color;
      ctx.fill();
      circle(ctx, 0, PIN_LEN - 8, 8, '#c084fc');
      ctx.restore();
    };

    // Target
    if (s.clearTimer <= 0 || s.shatter > 0.6) {
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(s.rotation);
      for (const a of s.stuck) {
        const tipX = Math.cos(a) * R;
        const tipY = Math.sin(a) * R;
        drawPin(tipX, tipY, a - Math.PI / 2);
      }
      const wood = ctx.createRadialGradient(0, 0, 8, 0, 0, R);
      wood.addColorStop(0, s.plan.boss ? '#fb7185' : '#c4b5fd');
      wood.addColorStop(1, s.plan.boss ? '#9f1239' : '#6d28d9');
      circle(ctx, 0, 0, R, wood);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, (R * i) / 4, 0, TAU);
        ctx.stroke();
      }
      for (const g of s.gems) {
        if (!g.alive) continue;
        ctx.save();
        ctx.translate(Math.cos(g.angle) * (R - 12), Math.sin(g.angle) * (R - 12));
        ctx.rotate(Math.PI / 4);
        fillRoundRect(ctx, -8, -8, 16, 16, 3, '#fde047');
        ctx.restore();
      }
      circle(ctx, 0, 0, 16, s.hitFlash > 0 ? '#fff' : 'rgba(255,255,255,0.3)');
      ctx.restore();
    }

    if (s.flying) drawPin(CX, s.flying.y, 0);
    else if (!s.dead && s.pinsLeft > 0 && s.clearTimer <= 0) drawPin(CX, LAUNCH_Y, 0);
    if (s.falling) drawPin(s.falling.x, s.falling.y, s.falling.rot, '#fca5a5');

    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    // HUD: pins left (vertical stack bottom-left), level at top
    for (let i = 0; i < s.pinsLeft; i++) {
      fillRoundRect(
        ctx,
        22,
        H - 40 - i * 22,
        26,
        8,
        4,
        i === s.pinsLeft - 1 ? '#f5f3ff' : 'rgba(245,243,255,0.45)',
      );
    }
    text(ctx, s.plan.boss ? `BOSS · Level ${s.level}` : `Level ${s.level}`, CX, 40, {
      size: 18,
      color: s.plan.boss ? '#fda4af' : '#ddd6fe',
    });
    text(ctx, String(s.score), CX, 80, { size: 40, weight: 800 });
    if (s.thrown === 0 && s.level === 1 && !s.flying) prompt(ctx, 'Tap to throw', CX, 470, s.time);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Pin Spin game area"
      onPointerDown={throwPin}
      cursor="pointer"
    />
  );
}

export type { LevelPlan };
