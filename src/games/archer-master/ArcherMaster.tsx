import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  circle,
  createContinueGate,
  drawCoin,
  fillRoundRect,
  hudPill,
  prompt,
  text,
  useGameLoop,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const H = 480;
const GROUND = 420;
const BOW_X = 60;
const BOW_Y = 330;
const GRAV = 520;

interface Target {
  x: number;
  y: number;
  r: number;
  moving: number;
  phase: number;
}
interface Arrow {
  x: number;
  y: number;
  vx: number;
  vy: number;
  stuck: boolean;
  stuckT: number;
  offX: number;
  offY: number;
}

export function ArcherMaster({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const guide = 0.35 + 0.22 * lo.level('guide');
  const quiver = 10 + 2 * lo.level('quiver');
  const windMul = Math.pow(0.8, lo.level('fletch'));
  const maxPower = 780 * (1 + 0.08 * lo.level('power'));
  const fx = useRef({ particles: new Particles(300, rng.next), floaters: new FloatingText() });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    target: null as Target | null,
    balloons: [] as { x: number; y: number; vy: number; popped: boolean }[],
    arrow: null as Arrow | null,
    arrows: quiver,
    wind: 0,
    round: 0,
    score: 0,
    streak: 0,
    bullseyes: 0,
    coins: 0,
    drag: null as null | { id: number; x0: number; y0: number; x: number; y: number },
    over: false,
    started: false,
    clock: 0,
    nextRoundT: 0,
  }).current;

  const width = () => view.current?.width ?? 360;

  const newRound = () => {
    s.round += 1;
    const w = width();
    const diff = Math.min(1, s.round / 25);
    s.target = {
      x: rng.range(w * 0.55, w - 30),
      y: rng.range(170, GROUND - 60),
      r: Math.max(20, 34 - diff * 12),
      moving: s.round > 5 && rng.chance(0.3 + diff * 0.4) ? rng.range(25, 60 + diff * 40) : 0,
      phase: rng.range(0, 6),
    };
    s.wind = s.round > 2 ? rng.range(-1, 1) * (40 + diff * 110) : 0;
    if (rng.chance(0.35))
      s.balloons.push({
        x: rng.range(w * 0.4, w - 40),
        y: GROUND + 20,
        vy: -rng.range(30, 55),
        popped: false,
      });
  };
  if (!s.target) newRound();

  const velocity = () => {
    const d = s.drag!;
    const dx = d.x0 - d.x;
    const dy = d.y0 - d.y;
    const len = Math.hypot(dx, dy);
    const power = clamp(len / 150, 0, 1) * maxPower;
    const a = Math.atan2(dy, dx);
    return { vx: Math.cos(a) * power, vy: Math.sin(a) * power, power: power / maxPower, a };
  };

  const onDown = (p: StagePointer) => {
    if (s.over || s.arrow) return;
    s.started = true;
    s.drag = { id: p.id, x0: p.x, y0: p.y, x: p.x, y: p.y };
  };
  const onMove = (p: StagePointer) => {
    if (s.drag?.id === p.id) {
      s.drag.x = p.x;
      s.drag.y = p.y;
    }
  };
  const onUp = (p: StagePointer) => {
    if (s.drag?.id !== p.id) return;
    const v = velocity();
    s.drag = null;
    if (v.power < 0.15 || s.arrows <= 0) return;
    s.arrows -= 1;
    s.arrow = { x: BOW_X, y: BOW_Y, vx: v.vx, vy: v.vy, stuck: false, stuckT: 0, offX: 0, offY: 0 };
    api.sfx('swap');
  };

  const outOfArrows = () => {
    s.over = true;
    api.sfx('gameover');
    continueGate(
      () => {
        s.over = false;
        s.arrows += 5;
        fx.current.floaters.add('+5 arrows', width() / 2, 140, '#bef264', 22, 1.2);
      },
      () =>
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Targets', value: String(s.round - 1) },
            { label: 'Bullseyes', value: String(s.bullseyes) },
            { label: 'Coins', value: String(s.coins) },
          ],
        }),
    );
  };

  const targetPos = (t: Target) => ({
    x: t.x,
    y: t.y + (t.moving ? Math.sin(s.clock * 1.4 + t.phase) * t.moving : 0),
  });

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const w = v.width;
    const { particles, floaters } = fx.current;
    s.clock += dt;

    for (const b of s.balloons) b.y += b.vy * dt;
    s.balloons = s.balloons.filter((b) => b.y > -40 && !b.popped);

    const a = s.arrow;
    if (a && !a.stuck) {
      const steps = 3;
      for (let i = 0; i < steps && !a.stuck; i++) {
        const h = dt / steps;
        a.vy += GRAV * h;
        a.vx += s.wind * windMul * h;
        a.x += a.vx * h;
        a.y += a.vy * h;
        const t = s.target;
        if (t) {
          const tp = targetPos(t);
          // targets are thin boards facing the archer: check the board line
          if (Math.abs(a.x - tp.x) < 6 && Math.abs(a.y - tp.y) < t.r) {
            const acc = 1 - Math.abs(a.y - tp.y) / t.r;
            a.stuck = true;
            a.offX = a.x - tp.x;
            a.offY = a.y - tp.y;
            const ring = acc > 0.85 ? 3 : acc > 0.55 ? 2 : acc > 0.25 ? 1 : 0;
            const pts =
              [10, 25, 50, 100][ring]! + Math.round(Math.abs(s.wind) / 10) * 5 + (t.moving ? 20 : 0);
            s.score += pts;
            api.setScore(s.score);
            if (ring === 3) {
              s.bullseyes += 1;
              s.streak += 1;
              s.arrows += 1;
              floaters.add(`BULLSEYE +${pts}  +1 arrow`, tp.x - 40, tp.y - t.r - 20, '#fde047', 16, 1.1);
              api.sfx('perfect');
            } else {
              s.streak = 0;
              floaters.add(`+${pts}`, tp.x - 20, tp.y - t.r - 20, '#fff', 16);
              api.sfx('hit');
            }
            particles.burst(a.x, a.y, { count: 12, colors: ['#fef3c7', '#dc2626'], speed: 120, life: 0.4 });
            s.nextRoundT = 0.9;
          }
        }
        for (const b of s.balloons)
          if (!b.popped && Math.hypot(b.x - a.x, b.y - a.y) < 16) {
            b.popped = true;
            s.coins += 2;
            api.addCoins(2);
            particles.burst(b.x, b.y, { count: 14, color: '#f472b6', speed: 160, life: 0.4 });
            floaters.add('+2 coins', b.x, b.y - 20, '#fde047', 14);
            api.sfx('coin');
          }
        if (a.y > GROUND || a.x > w + 40 || a.x < -40) {
          a.stuck = true;
          a.offX = -9999;
          s.streak = 0;
          s.nextRoundT = 0.7;
          api.sfx('miss');
        }
      }
    }
    if (a?.stuck) {
      a.stuckT += dt;
      if (s.nextRoundT > 0) {
        s.nextRoundT -= dt;
        if (s.nextRoundT <= 0) {
          const hit = a.offX > -9999;
          s.arrow = null;
          if (hit) newRound();
          if (s.arrows <= 0 && !s.over) outOfArrows();
        }
      }
    }
    particles.update(dt);
    floaters.update(dt);

    // ---------- render ----------
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#38bdf8');
    sky.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, H);
    ctx.fillStyle = '#bef264';
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, GROUND - 30 - Math.sin(x * 0.01) * 20);
    ctx.lineTo(w, GROUND);
    ctx.fill();
    ctx.fillStyle = '#65a30d';
    ctx.fillRect(0, GROUND, w, H - GROUND);
    // wind flag
    const wx = w - 60;
    ctx.fillStyle = '#57534e';
    ctx.fillRect(wx, 40, 3, 50);
    const flag = clamp(s.wind / 150, -1, 1);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(wx + 2, 42);
    ctx.lineTo(wx + 2 + flag * 34 + Math.sin(s.clock * 10) * 3, 50);
    ctx.lineTo(wx + 2, 58);
    ctx.fill();
    text(
      ctx,
      s.wind === 0 ? 'No wind' : `Wind ${Math.abs(Math.round(s.wind / 10))} ${s.wind > 0 ? '→' : '←'}`,
      wx,
      104,
      { size: 11, weight: 800, color: '#0c4a6e' },
    );
    for (const b of s.balloons) {
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + 14);
      ctx.lineTo(b.x, b.y + 30);
      ctx.stroke();
      circle(ctx, b.x, b.y, 14, '#f472b6');
      drawCoin(ctx, b.x, b.y, 6, s.clock);
    }
    const t = s.target;
    if (t) {
      const tp = targetPos(t);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(tp.x - 2, tp.y + t.r - 4, 4, GROUND - tp.y - t.r + 4);
      const rings = ['#fff', '#dc2626', '#fff', '#dc2626', '#fde047'];
      rings.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(tp.x, tp.y, 9 * (1 - i * 0.15), t.r * (1 - i * 0.2), 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // bow + archer
    const [wood, string, feather] = lo.skin.colors;
    const drawn = s.drag ? velocity() : null;
    const aim = drawn ? drawn.a : -0.3;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(BOW_X - 22, BOW_Y + 10, 12, GROUND - BOW_Y - 10);
    circle(ctx, BOW_X - 16, BOW_Y - 8, 10, '#fcd34d');
    fillRoundRect(ctx, BOW_X - 26, BOW_Y + 2, 20, 36, 6, '#1d4ed8');
    ctx.save();
    ctx.translate(BOW_X, BOW_Y);
    ctx.rotate(aim);
    const pull = drawn ? drawn.power * 22 : 0;
    ctx.strokeStyle = wood;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-6, 0, 30, -1.2, 1.2);
    ctx.stroke();
    ctx.strokeStyle = string;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(-1.2) * 30 - 6, Math.sin(-1.2) * 30);
    ctx.lineTo(-pull, 0);
    ctx.lineTo(Math.cos(1.2) * 30 - 6, Math.sin(1.2) * 30);
    ctx.stroke();
    if (!s.arrow && s.arrows > 0) {
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-pull, 0);
      ctx.lineTo(40 - pull, 0);
      ctx.stroke();
      ctx.fillStyle = feather;
      ctx.fillRect(-pull - 2, -4, 8, 8);
    }
    ctx.restore();
    // trajectory preview
    if (drawn && drawn.power > 0.1) {
      let px = BOW_X;
      let py = BOW_Y;
      let vx = drawn.vx;
      let vy = drawn.vy;
      const total = guide;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let tt = 0; tt < total; tt += 0.05) {
        vy += GRAV * 0.05;
        vx += s.wind * windMul * 0.05;
        px += vx * 0.05;
        py += vy * 0.05;
        circle(ctx, px, py, 2.5 * (1 - tt / total) + 1, 'rgba(255,255,255,0.85)');
      }
    }
    if (s.arrow) {
      const ar = s.arrow;
      let ax = ar.x;
      let ay = ar.y;
      if (ar.stuck && ar.offX > -9999 && s.target) {
        const tp = targetPos(s.target);
        ax = tp.x + ar.offX;
        ay = tp.y + ar.offY;
      }
      const ang = ar.stuck ? Math.atan2(ar.vy, ar.vx) : Math.atan2(ar.vy, ar.vx);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-34, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-4, 4);
      ctx.fill();
      ctx.fillStyle = feather;
      ctx.fillRect(-36, -4, 8, 8);
      ctx.restore();
    }
    particles.draw(ctx);
    floaters.draw(ctx);

    // HUD
    hudPill(ctx, 10, 10, `🏹 ${s.arrows}`, { size: 15 });
    hudPill(ctx, 10, 44, `Target ${s.round}`, { size: 12 });
    hudPill(ctx, w - 10, 10, String(s.coins), { align: 'right', coin: true, size: 13 });
    if (!s.started) prompt(ctx, 'Drag back and release to shoot', w / 2, 150, s.clock, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={360}
      height={H}
      fit="fill"
      minAspect={0.75}
      maxAspect={2.2}
      label="Archer Master game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
