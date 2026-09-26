import { useRef } from 'react';
import {
  axisFromKeys,
  CanvasStage,
  FloatingText,
  makeStars,
  Particles,
  Shake,
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, prompt, text } from '../../engine/draw';
import { clamp, dist, TAU } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const SHIP_R = 13;

interface Meteor {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  shape: number[];
  near: boolean;
}

interface Pickup {
  kind: 'crystal' | 'shield';
  x: number;
  y: number;
  vy: number;
}

export function MeteorDodge({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const fx = useRef({
    particles: new Particles(500, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const s = useRef({
    x: W / 2,
    y: H - 120,
    targetX: W / 2,
    targetY: H - 120,
    drag: null as null | { id: number; px: number; py: number; sx: number; sy: number },
    started: false,
    dead: false,
    deadTimer: 0,
    ended: false,
    t: 0,
    time: 0,
    spawnTimer: 0.6,
    pickupTimer: 5,
    meteors: [] as Meteor[],
    pickups: [] as Pickup[],
    shield: false,
    shieldFlash: 0,
    crystals: 0,
    bonus: 0,
    score: 0,
    nearMisses: 0,
    stars: makeStars(rng, 70, W, H),
  }).current;

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.drag = { id: p.id, px: p.x, py: p.y, sx: s.targetX, sy: s.targetY };
    if (p.type === 'mouse') {
      s.targetX = p.x;
      s.targetY = p.y;
    }
  };
  const onMove = (p: StagePointer) => {
    if (p.type === 'mouse') {
      if (s.started) {
        s.targetX = p.x;
        s.targetY = p.y;
      }
      return;
    }
    if (!s.drag || s.drag.id !== p.id) return;
    // Relative drag so the finger never hides the ship.
    s.targetX = s.drag.sx + (p.x - s.drag.px) * 1.2;
    s.targetY = s.drag.sy + (p.y - s.drag.py) * 1.2;
  };
  const onUp = (p: StagePointer) => {
    if (s.drag?.id === p.id) s.drag = null;
  };

  const spawnMeteor = () => {
    const r = rng.range(11, 30 + Math.min(12, s.t / 6));
    const speed = rng.range(150, 260) * (1 + s.t * 0.018);
    const comet = s.t > 25 && rng.chance(0.15);
    const x = rng.range(-10, W + 10);
    const shape = Array.from({ length: 9 }, () => rng.range(0.75, 1.1));
    s.meteors.push({
      x,
      y: -r - 10,
      r: comet ? 10 : r,
      vx: comet ? (x < W / 2 ? 1 : -1) * speed * 0.45 : rng.range(-30, 30),
      vy: comet ? speed * 1.4 : speed,
      rot: rng.range(0, TAU),
      spin: rng.range(-2, 2),
      shape,
      near: false,
    });
  };

  const hit = (m: Meteor) => {
    const { particles, shake } = fx.current;
    if (s.shield) {
      s.shield = false;
      s.shieldFlash = 1;
      m.y = H + 200;
      particles.burst(s.x, s.y, { count: 24, colors: ['#60a5fa', '#bfdbfe'], speed: 220, life: 0.5 });
      shake.add(6);
      api.sfx('hit');
      api.haptic(30);
      return;
    }
    s.dead = true;
    s.deadTimer = 1;
    particles.burst(s.x, s.y, {
      count: 50,
      colors: ['#fb923c', '#fde047', '#fff', '#f43f5e'],
      speed: 300,
      life: 0.9,
    });
    shake.add(16);
    api.sfx('explode');
    api.haptic([60, 40, 80]);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;
    const axis = axisFromKeys(keys.current);
    if (axis.x || axis.y) {
      s.started = true;
      s.targetX = s.x + axis.x * 40;
      s.targetY = s.y + axis.y * 40;
    }
    s.targetX = clamp(s.targetX, SHIP_R, W - SHIP_R);
    s.targetY = clamp(s.targetY, H * 0.3, H - SHIP_R - 8);

    if (!s.dead) {
      const follow = Math.min(1, dt * 14);
      const maxStep = 520 * dt;
      s.x += clamp((s.targetX - s.x) * follow, -maxStep, maxStep);
      s.y += clamp((s.targetY - s.y) * follow, -maxStep, maxStep);
    }

    if (s.started && !s.dead) {
      s.t += dt;
      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0) {
        spawnMeteor();
        s.spawnTimer = Math.max(0.16, 0.75 - s.t * 0.012) * rng.range(0.6, 1.3);
      }
      s.pickupTimer -= dt;
      if (s.pickupTimer <= 0) {
        s.pickups.push({
          kind: !s.shield && rng.chance(0.3) ? 'shield' : 'crystal',
          x: rng.range(30, W - 30),
          y: -20,
          vy: 150,
        });
        s.pickupTimer = rng.range(3, 6);
      }
      const newScore = Math.floor(s.t * 10) + s.bonus;
      if (newScore !== s.score) {
        s.score = newScore;
        api.setScore(s.score);
      }
    }

    for (const m of s.meteors) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.rot += m.spin * dt;
      if (!s.dead) {
        const d = dist(m.x, m.y, s.x, s.y);
        if (d < m.r * 0.85 + SHIP_R * 0.8) hit(m);
        else if (d < m.r + SHIP_R + 14 && m.y > s.y && !m.near) {
          m.near = true;
          s.nearMisses += 1;
          s.bonus += 5;
          floaters.add('Close! +5', s.x, s.y - 30, '#fdba74', 14, 0.6);
        }
      }
    }
    s.meteors = s.meteors.filter((m) => m.y < H + 60 && m.x > -80 && m.x < W + 80);
    for (const p of s.pickups) {
      p.y += p.vy * dt;
      if (!s.dead && dist(p.x, p.y, s.x, s.y) < 26) {
        p.y = H + 100;
        if (p.kind === 'shield') {
          s.shield = true;
          floaters.add('Shield!', s.x, s.y - 30, '#93c5fd', 18);
          api.sfx('powerup');
        } else {
          s.crystals += 1;
          s.bonus += 25;
          floaters.add('+25', s.x, s.y - 30, '#f0abfc', 18);
          particles.burst(p.x, p.y, { count: 12, colors: ['#f0abfc', '#fff'], speed: 140, life: 0.4 });
          api.sfx('coin');
        }
      }
    }
    s.pickups = s.pickups.filter((p) => p.y < H + 40);

    if (s.dead && !s.ended) {
      s.deadTimer -= dt;
      if (s.deadTimer <= 0) {
        s.ended = true;
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Survived', value: `${s.t.toFixed(1)}s` },
            { label: 'Crystals', value: String(s.crystals) },
            { label: 'Close calls', value: String(s.nearMisses) },
          ],
        });
      }
    }
    s.shieldFlash = Math.max(0, s.shieldFlash - dt * 2);
    if (!s.dead && s.started && rng.chance(0.6)) {
      particles.burst(s.x, s.y + 14, {
        count: 1,
        colors: ['#fb923c', '#fde047'],
        speed: 80,
        life: 0.3,
        size: 4,
        angle: Math.PI / 2,
        spread: 0.6,
      });
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0f0a1e');
    bg.addColorStop(1, '#2a0f0a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    for (const st of s.stars) {
      st.y += st.speed * (s.started ? 60 : 15) * dt;
      if (st.y > H) st.y -= H;
      ctx.globalAlpha = st.alpha;
      circle(ctx, st.x, st.y, st.r, '#fff');
    }
    ctx.globalAlpha = 1;
    ctx.save();
    shake.apply(ctx);

    for (const p of s.pickups) {
      if (p.kind === 'shield') {
        circle(ctx, p.x, p.y, 13, 'rgba(96,165,250,0.35)');
        circle(ctx, p.x, p.y, 8, '#60a5fa');
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(s.time * 2);
        ctx.fillStyle = '#f0abfc';
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(8, 0);
        ctx.lineTo(0, 11);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    for (const m of s.meteors) {
      ctx.save();
      ctx.translate(m.x, m.y);
      if (m.r <= 10) {
        // comet trail
        const ang = Math.atan2(m.vy, m.vx);
        const g = ctx.createLinearGradient(0, 0, -Math.cos(ang) * 60, -Math.sin(ang) * 60);
        g.addColorStop(0, 'rgba(253,186,116,0.8)');
        g.addColorStop(1, 'rgba(253,186,116,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-Math.cos(ang) * 60, -Math.sin(ang) * 60);
        ctx.stroke();
      }
      ctx.rotate(m.rot);
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      m.shape.forEach((k, i) => {
        const a = (i / m.shape.length) * TAU;
        ctx.lineTo(Math.cos(a) * m.r * k, Math.sin(a) * m.r * k);
      });
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      m.shape.forEach((k, i) => {
        const a = (i / m.shape.length) * TAU;
        ctx.lineTo(Math.cos(a) * m.r * k * 0.8 - 2, Math.sin(a) * m.r * k * 0.8 - 2);
      });
      ctx.closePath();
      ctx.fill();
      circle(ctx, m.r * 0.25, m.r * 0.1, m.r * 0.2, '#92400e');
      circle(ctx, -m.r * 0.3, -m.r * 0.25, m.r * 0.14, '#92400e');
      ctx.restore();
    }

    if (!s.dead) {
      ctx.save();
      ctx.translate(s.x, s.y);
      const tilt = clamp((s.targetX - s.x) / 60, -0.4, 0.4);
      ctx.rotate(tilt);
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(13, 12);
      ctx.lineTo(0, 7);
      ctx.lineTo(-13, 12);
      ctx.closePath();
      ctx.fill();
      circle(ctx, 0, -3, 4, '#38bdf8');
      ctx.restore();
      if (s.shield) {
        ctx.strokeStyle = `rgba(96,165,250,${0.6 + Math.sin(s.time * 8) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 24, 0, TAU);
        ctx.stroke();
      }
    }
    if (s.shieldFlash > 0) {
      ctx.strokeStyle = `rgba(147,197,253,${s.shieldFlash})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 24 + (1 - s.shieldFlash) * 40, 0, TAU);
      ctx.stroke();
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    text(ctx, String(s.score), W / 2, 50, {
      size: 38,
      weight: 800,
      stroke: 'rgba(0,0,0,0.4)',
      strokeWidth: 5,
    });
    if (!s.started) prompt(ctx, 'Drag to steer — dodge the meteors', W / 2, H * 0.55, s.time, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Meteor Dodge game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      cursor="crosshair"
    />
  );
}
