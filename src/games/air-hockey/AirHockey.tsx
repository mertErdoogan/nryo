import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import { clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';
import { aiSkill, strike, type Disc } from './physics';

const W = 360;
const H = 600;
const T = { x: 16, y: 16, w: W - 32, h: H - 32 };
const GOAL_W = 120;
const WIN = 5;
const MAX_PUCK = 950;

export function AirHockey({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const s = useRef({
    puck: { x: W / 2, y: H / 2 + 60, vx: 0, vy: 0, r: 17 } as Disc,
    me: { x: W / 2, y: H - 90, vx: 0, vy: 0, r: 26 } as Disc,
    ai: { x: W / 2, y: 90, vx: 0, vy: 0, r: 26 } as Disc,
    target: { x: W / 2, y: H - 90 },
    my: 0,
    their: 0,
    level: 1,
    wins: 0,
    goals: 0,
    pause: 0.8,
    serveTo: 1,
    over: false,
    overTimer: 0,
    ended: false,
    started: false,
    time: 0,
    banner: 'Match 1 · first to 5',
    bannerT: 2,
  }).current;

  const onPointer = (p: StagePointer) => {
    s.started = true;
    s.target = { x: p.x, y: p.y - (p.type === 'touch' ? 30 : 0) };
  };

  const resetPuck = (towardPlayer: boolean) => {
    s.puck = { x: W / 2, y: towardPlayer ? H / 2 + 70 : H / 2 - 70, vx: 0, vy: 0, r: 17 };
    s.pause = 0.9;
  };

  const goal = (playerScored: boolean) => {
    const { particles, floaters, shake } = fx.current;
    shake.add(10);
    particles.burst(s.puck.x, playerScored ? T.y : T.y + T.h, {
      count: 40,
      colors: playerScored ? ['#22d3ee', '#fff'] : ['#fb7185', '#fff'],
      speed: 260,
      life: 0.8,
    });
    if (playerScored) {
      s.my += 1;
      s.goals += 1;
      floaters.add('GOAL!', W / 2, H / 2 - 40, '#67e8f9', 34, 1.1);
      api.sfx('score');
    } else {
      s.their += 1;
      floaters.add('Conceded', W / 2, H / 2 + 40, '#fda4af', 24, 1);
      api.sfx('miss');
      api.haptic(60);
    }
    api.setScore(s.goals * 100 + s.wins * 500);
    if (s.my >= WIN) {
      s.wins += 1;
      s.level += 1;
      s.my = 0;
      s.their = 0;
      api.setScore(s.goals * 100 + s.wins * 500);
      s.banner = `Match won! Next: level ${s.level} AI`;
      s.bannerT = 2.2;
      api.sfx('win');
      resetPuck(true);
      s.pause = 2;
      return;
    }
    if (s.their >= WIN) {
      s.over = true;
      s.overTimer = 1.3;
      s.banner = 'Match lost';
      s.bannerT = 2;
      api.sfx('gameover');
      return;
    }
    resetPuck(!playerScored);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;
    s.bannerT = Math.max(0, s.bannerT - dt);
    const k = keys.current;
    const ax = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    const ay = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (ax || ay) {
      s.started = true;
      s.target = { x: s.me.x + ax * 60, y: s.me.y + ay * 60 };
    }

    // player mallet
    const me = s.me;
    const tx = clamp(s.target.x, T.x + me.r, T.x + T.w - me.r);
    const ty = clamp(s.target.y, H / 2 + me.r, T.y + T.h - me.r);
    const maxStep = 1400 * dt;
    const mx = clamp(tx - me.x, -maxStep, maxStep);
    const my = clamp(ty - me.y, -maxStep, maxStep);
    me.vx = mx / Math.max(dt, 1e-3);
    me.vy = my / Math.max(dt, 1e-3);
    me.x += mx;
    me.y += my;

    if (!s.over) {
      // AI mallet
      const ai = s.ai;
      const skill = aiSkill(s.level);
      const puck = s.puck;
      let gx: number;
      let gy: number;
      if (puck.y < H / 2 + 20 && (puck.vy < 120 || puck.y < ai.y + 40)) {
        // attack: get behind the puck and drive it downward
        gx = puck.x + (puck.x - W / 2) * 0.1;
        gy = puck.y - puck.r - ai.r + (puck.y > ai.y ? 20 : -30);
        if (rng.chance(1 - skill.aggression) && puck.vy > 0) gy = 90;
      } else {
        // defend: shadow the puck in front of the goal
        gx = W / 2 + (puck.x - W / 2) * 0.7;
        gy = 80;
      }
      gx = clamp(gx, T.x + ai.r, T.x + T.w - ai.r);
      gy = clamp(gy, T.y + ai.r, H / 2 - ai.r);
      const step = skill.speed * dt;
      const dx = clamp(gx - ai.x, -step, step);
      const dy = clamp(gy - ai.y, -step, step);
      ai.vx = dx / Math.max(dt, 1e-3);
      ai.vy = dy / Math.max(dt, 1e-3);
      ai.x += dx;
      ai.y += dy;

      if (s.pause > 0) s.pause -= dt;
      else if (s.started) {
        const steps = 4;
        const sdt = dt / steps;
        for (let i = 0; i < steps; i++) {
          puck.x += puck.vx * sdt;
          puck.y += puck.vy * sdt;
          const inGoalX = Math.abs(puck.x - W / 2) < GOAL_W / 2 - 4;
          if (puck.x < T.x + puck.r) {
            puck.x = T.x + puck.r;
            puck.vx = Math.abs(puck.vx) * 0.92;
            api.sfx('tick');
          } else if (puck.x > T.x + T.w - puck.r) {
            puck.x = T.x + T.w - puck.r;
            puck.vx = -Math.abs(puck.vx) * 0.92;
            api.sfx('tick');
          }
          if (puck.y < T.y + puck.r && !inGoalX) {
            puck.y = T.y + puck.r;
            puck.vy = Math.abs(puck.vy) * 0.92;
            api.sfx('tick');
          } else if (puck.y > T.y + T.h - puck.r && !inGoalX) {
            puck.y = T.y + T.h - puck.r;
            puck.vy = -Math.abs(puck.vy) * 0.92;
            api.sfx('tick');
          }
          if (puck.y < T.y - puck.r) {
            goal(true);
            break;
          }
          if (puck.y > T.y + T.h + puck.r) {
            goal(false);
            break;
          }
          if (strike(puck, me, MAX_PUCK)) {
            api.sfx('tap');
            api.haptic(12);
            particles.burst(puck.x, puck.y, { count: 5, color: '#67e8f9', speed: 120, life: 0.25 });
          }
          if (strike(puck, ai, MAX_PUCK * 0.9)) {
            api.sfx('tap');
            particles.burst(puck.x, puck.y, { count: 5, color: '#fda4af', speed: 120, life: 0.25 });
          }
        }
        const damp = Math.exp(-0.35 * dt);
        puck.vx *= damp;
        puck.vy *= damp;
      }
    } else if (!s.ended) {
      s.overTimer -= dt;
      if (s.overTimer <= 0) {
        s.ended = true;
        api.gameOver({
          score: s.goals * 100 + s.wins * 500,
          won: s.wins > 0,
          stats: [
            { label: 'Matches won', value: String(s.wins) },
            { label: 'Goals', value: String(s.goals) },
            { label: 'AI level reached', value: String(s.level) },
          ],
        });
      }
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    fillRoundRect(ctx, T.x - 8, T.y - 8, T.w + 16, T.h + 16, 30, '#1e293b');
    fillRoundRect(ctx, T.x, T.y, T.w, T.h, 24, '#e0f2fe');
    ctx.fillStyle = 'rgba(14,165,233,0.12)';
    for (let y = T.y + 20; y < T.y + T.h; y += 22)
      for (let x = T.x + 20; x < T.x + T.w; x += 22) ctx.fillRect(x, y, 2, 2);
    ctx.strokeStyle = 'rgba(225,29,72,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(T.x, H / 2);
    ctx.lineTo(T.x + T.w, H / 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(14,165,233,0.5)';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 50, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, T.y, 70, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, T.y + T.h, 70, Math.PI, Math.PI * 2);
    ctx.stroke();
    fillRoundRect(ctx, W / 2 - GOAL_W / 2, T.y - 10, GOAL_W, 12, 4, '#0f172a');
    fillRoundRect(ctx, W / 2 - GOAL_W / 2, T.y + T.h - 2, GOAL_W, 12, 4, '#0f172a');
    // puck
    circle(ctx, s.puck.x + 2, s.puck.y + 3, s.puck.r, 'rgba(0,0,0,0.2)');
    circle(ctx, s.puck.x, s.puck.y, s.puck.r, '#111827');
    circle(ctx, s.puck.x, s.puck.y, s.puck.r * 0.6, '#374151');
    // mallets
    for (const [m, c1, c2] of [
      [s.ai, '#e11d48', '#fda4af'],
      [s.me, '#0891b2', '#a5f3fc'],
    ] as const) {
      circle(ctx, m.x + 2, m.y + 4, m.r, 'rgba(0,0,0,0.2)');
      circle(ctx, m.x, m.y, m.r, c1);
      circle(ctx, m.x, m.y, m.r * 0.62, c2);
      circle(ctx, m.x, m.y, m.r * 0.32, c1);
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    // scoreboard on the side
    fillRoundRect(ctx, W - 58, H / 2 - 46, 42, 92, 12, 'rgba(15,23,42,0.85)');
    text(ctx, String(s.their), W - 37, H / 2 - 22, { size: 24, weight: 850, color: '#fda4af' });
    text(ctx, String(s.my), W - 37, H / 2 + 24, { size: 24, weight: 850, color: '#67e8f9' });
    text(ctx, `AI Lv ${s.level}`, 28, H / 2 - 14, { size: 11, weight: 700, align: 'left', color: '#be123c' });
    text(ctx, `Wins ${s.wins}`, 28, H / 2 + 16, { size: 11, weight: 700, align: 'left', color: '#0e7490' });
    if (s.bannerT > 0)
      text(ctx, s.banner, W / 2, H / 2 - 90, {
        size: 18,
        weight: 800,
        color: '#0f172a',
        alpha: Math.min(1, s.bannerT),
      });
    if (!s.started) prompt(ctx, 'Drag your mallet to play', W / 2, H - 150, s.time, 17);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Air Hockey table"
      onPointerDown={onPointer}
      onPointerMove={onPointer}
    />
  );
}
