import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  circle,
  createContinueGate,
  drawCoin,
  hudPill,
  prompt,
  shade,
  text,
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { TAU } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const CX = W / 2;
const RX = 125;
const RY = 38;
const GAP = 120;
const SECTORS = 12;
const STEP = TAU / SECTORS;
const BALL_R = 12;
const THEMES = [
  ['#fde68a', '#dc2626', '#0f172a'],
  ['#a5f3fc', '#e11d48', '#082f49'],
  ['#d9f99d', '#be123c', '#14532d'],
  ['#fbcfe8', '#b91c1c', '#3b0764'],
  ['#fed7aa', '#991b1b', '#431407'],
] as const;

type Cell = 0 | 1 | 2; // solid, gap, danger
interface Ring {
  y: number;
  cells: Cell[];
  coins: Set<number>;
  broken: boolean;
  splats: number[];
  passed: boolean;
}

const norm = (a: number) => ((a % TAU) + TAU) % TAU;

export function HelixFall({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const fireAt = 3 - lo.level('fire');
  const coinChance = 0.25 + 0.12 * lo.level('lucky');
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;

  const makeRing = (i: number): Ring => {
    const cells: Cell[] = Array.from({ length: SECTORS }, () => 0 as Cell);
    const gapLen = i === 0 ? 3 : rng.int(1, 3);
    const gapStart = rng.int(0, SECTORS - 1);
    for (let k = 0; k < gapLen; k++) cells[(gapStart + k) % SECTORS] = 1;
    if (i > 1) {
      const dangers = Math.min(5, rng.int(0, 1 + Math.floor(i / 12)));
      for (let k = 0; k < dangers; k++) {
        const c = rng.int(0, SECTORS - 1);
        if (cells[c] === 0) cells[c] = 2;
      }
      if (rng.chance(Math.min(0.3, i / 150))) {
        // an extra small gap on harder rings
        const c = rng.int(0, SECTORS - 1);
        if (cells[c] === 0) cells[c] = 1;
      }
    }
    const coins = new Set<number>();
    if (i > 0 && rng.chance(coinChance)) coins.add((gapStart + Math.floor(gapLen / 2)) % SECTORS);
    return { y: 200 + i * GAP, cells, coins, broken: false, splats: [], passed: false };
  };

  const s = useRef({
    rings: [] as Ring[],
    phi: 0,
    ballY: 140,
    vy: 0,
    camY: 0,
    streak: 0,
    passed: 0,
    score: 0,
    coins: 0,
    shields: lo.level('shield'),
    invuln: 0,
    dead: false,
    deadT: 0,
    started: false,
    drag: null as null | { id: number; x: number },
    clock: 0,
    squash: 0,
  }).current;
  if (s.rings.length === 0) for (let i = 0; i < 12; i++) s.rings.push(makeRing(i));

  const sectorUnderBall = () => Math.floor(norm(Math.PI / 2 - s.phi) / STEP) % SECTORS;
  const theme = () => THEMES[Math.floor(s.passed / 25) % THEMES.length]!;

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.drag = { id: p.id, x: p.x };
  };
  const onMove = (p: StagePointer) => {
    if (s.drag?.id !== p.id) return;
    s.phi += (p.x - s.drag.x) * 0.0125;
    s.drag.x = p.x;
  };
  const onUp = (p: StagePointer) => {
    if (s.drag?.id === p.id) s.drag = null;
  };

  const die = (ring: Ring) => {
    const { shake, particles } = fx.current;
    if (s.shields > 0) {
      s.shields -= 1;
      s.invuln = 0.6;
      ring.cells = ring.cells.map((c) => (c === 2 ? 0 : c));
      s.vy = -620;
      fx.current.floaters.add('Bubble popped!', CX, s.ballY - s.camY - 40, '#bae6fd', 18);
      api.sfx('hit');
      return;
    }
    s.dead = true;
    s.deadT = 0.8;
    shake.add(12);
    particles.burst(CX, s.ballY - s.camY, {
      count: 30,
      colors: [lo.skin.colors[0], '#fff'],
      speed: 240,
      life: 0.6,
    });
    api.sfx('explode');
    api.haptic([60, 30, 60]);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    const turn =
      (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    if (turn) s.started = true;
    s.phi += turn * 4 * dt;
    s.squash = Math.max(0, s.squash - dt * 5);

    if (!s.dead) {
      s.invuln = Math.max(0, s.invuln - dt);
      const prevY = s.ballY;
      s.vy = Math.min(900, s.vy + 1900 * dt);
      s.ballY += s.vy * dt;
      for (const ring of s.rings) {
        if (ring.broken) continue;
        const top = ring.y + RY - 10 - BALL_R;
        if (prevY <= top && s.ballY >= top) {
          const c = sectorUnderBall();
          const cell = ring.cells[c]!;
          if (cell === 1) {
            if (!ring.passed) {
              ring.passed = true;
              s.passed += 1;
              s.streak += 1;
              const pts = 10 * Math.min(5, s.streak);
              s.score += pts;
              api.setScore(s.score);
              if (s.streak >= 2) floaters.add(`+${pts}`, CX + 60, ring.y - s.camY, '#fde68a', 16, 0.6);
              api.sfx('tick');
              if (ring.coins.has(c)) {
                ring.coins.delete(c);
                s.coins += 1;
                api.addCoins(1);
                api.sfx('coin');
              }
            }
            continue;
          }
          if (s.streak >= fireAt) {
            ring.broken = true;
            ring.passed = true;
            s.passed += 1;
            s.score += 50;
            api.setScore(s.score);
            shake.add(8);
            floaters.add('SMASH +50', CX, ring.y - s.camY, '#fb923c', 22);
            particles.burst(CX, ring.y + RY - s.camY, {
              count: 40,
              colors: [theme()[0], theme()[1], '#fff'],
              speed: 300,
              life: 0.6,
            });
            api.sfx('explode');
            s.streak = 0;
            s.vy = -300;
            continue;
          }
          if (cell === 2 && s.invuln <= 0) {
            s.ballY = top;
            die(ring);
            break;
          }
          s.ballY = top;
          s.vy = -620;
          s.streak = 0;
          s.squash = 1;
          ring.splats.push(norm(Math.PI / 2 - s.phi));
          if (ring.splats.length > 6) ring.splats.shift();
          api.sfx('jump');
          break;
        }
      }
      // keep generating downward
      while (s.rings[s.rings.length - 1]!.y < s.ballY + H) s.rings.push(makeRing(s.rings.length));
      s.rings = s.rings.filter((r) => r.y > s.camY - 200);
      const target = s.ballY - 220;
      if (target > s.camY) s.camY += (target - s.camY) * Math.min(1, dt * 8);
      if (s.streak >= fireAt && rng.chance(0.8))
        particles.burst(CX, s.ballY - s.camY - 8, {
          count: 2,
          colors: ['#f97316', '#fde047'],
          speed: 80,
          angle: -Math.PI / 2,
          spread: 0.8,
          life: 0.4,
          size: 7,
        });
    } else if (s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.dead = false;
            s.invuln = 1;
            s.vy = -620;
            for (const r of s.rings)
              if (Math.abs(r.y - s.ballY) < GAP * 1.5) r.cells = r.cells.map((c) => (c === 2 ? 0 : c));
          },
          () =>
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Rings passed', value: String(s.passed) },
                { label: 'Coins', value: String(s.coins) },
              ],
            }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    const [plate, danger, bg] = theme();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, shade(bg, 0.25));
    g.addColorStop(1, bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);

    const arc = (y: number, a0: number, a1: number, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.ellipse(CX, y, RX, RY, 0, a0, a1);
      ctx.stroke();
    };
    const drawRingPart = (ring: Ring, front: boolean) => {
      const y = ring.y - s.camY;
      if (y < -60 || y > H + 60 || ring.broken) return;
      for (let i = 0; i < SECTORS; i++) {
        const cell = ring.cells[i]!;
        if (cell === 1) continue;
        let a0 = norm(s.phi + i * STEP);
        let a1 = a0 + STEP;
        // clip to the front half [0, π] or back half [π, 2π]
        const lo2 = front ? 0 : Math.PI;
        const hi2 = front ? Math.PI : TAU;
        const segs: [number, number][] =
          a1 > TAU
            ? [
                [a0, TAU],
                [0, a1 - TAU],
              ]
            : [[a0, a1]];
        for (const [s0, s1] of segs) {
          a0 = Math.max(s0, lo2);
          a1 = Math.min(s1, hi2);
          if (a1 <= a0) continue;
          const col = cell === 2 ? danger : plate;
          arc(y + 9, a0, a1, shade(col, -0.35), 26);
          arc(y, a0, a1, col, 26);
        }
      }
      if (front) {
        for (const sp of ring.splats) {
          const a = sp + s.phi;
          const sx = CX + Math.cos(a) * RX;
          const sy = y + Math.sin(a) * RY;
          if (Math.sin(a) > 0) {
            ctx.fillStyle = shade(lo.skin.colors[0], -0.1);
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.ellipse(sx, sy, 10, 4, 0, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
        for (const c of ring.coins) {
          const a = s.phi + (c + 0.5) * STEP;
          if (Math.sin(a) > -0.2)
            drawCoin(ctx, CX + Math.cos(a) * RX * 0.9, y + Math.sin(a) * RY * 0.9 - 14, 8, s.clock);
        }
      }
    };
    for (const r of s.rings) drawRingPart(r, false);
    const pole = ctx.createLinearGradient(CX - 26, 0, CX + 26, 0);
    pole.addColorStop(0, shade(plate, -0.2));
    pole.addColorStop(0.5, shade(plate, 0.4));
    pole.addColorStop(1, shade(plate, -0.3));
    ctx.fillStyle = pole;
    ctx.fillRect(CX - 26, 0, 52, H);
    for (const r of s.rings) drawRingPart(r, true);

    if (!s.dead) {
      const by = s.ballY - s.camY;
      const sq = s.squash;
      const [b0, b1, b2] = lo.skin.colors;
      const fire = s.streak >= fireAt;
      ctx.save();
      ctx.translate(CX, by + BALL_R * sq * 0.3);
      ctx.scale(1 + sq * 0.25, 1 - sq * 0.25);
      if (s.shields > 0 || s.invuln > 0) circle(ctx, 0, 0, BALL_R + 6, 'rgba(186,230,253,0.35)');
      circle(ctx, 0, 0, BALL_R, fire ? '#f97316' : b0);
      circle(ctx, 3, 3, BALL_R * 0.55, fire ? '#c2410c' : b1);
      circle(ctx, -4, -4, BALL_R * 0.35, fire ? '#fde047' : b2);
      ctx.restore();
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    hudPill(ctx, 10, 10, `Level ${Math.floor(s.passed / 25) + 1}`, { size: 13 });
    hudPill(ctx, W - 10, 10, String(s.coins), { align: 'right', coin: true, size: 13 });
    if (s.streak >= 2 && !s.dead)
      text(ctx, s.streak >= fireAt ? 'FIREBALL!' : `Streak ${s.streak}`, CX, 70, {
        size: 20,
        weight: 900,
        color: '#fde047',
        stroke: 'rgba(0,0,0,0.4)',
      });
    if (!s.started) prompt(ctx, 'Drag to spin the tower', CX, H * 0.82, s.clock, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Helix Fall game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
