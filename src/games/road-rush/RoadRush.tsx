import { useRef } from 'react';
import { CanvasStage, FloatingText, Particles, Shake, useGameLoop, useHeldKeys, useSeededRng } from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import { clamp, rectsOverlap } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const ROAD_L = 36;
const ROAD_R = W - 36;
const LANES = 4;
const LANE_W = (ROAD_R - ROAD_L) / LANES;
const CAR_W = 38;
const CAR_H = 70;
const PLAYER_Y = 510;
const CAR_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#e2e8f0', '#14b8a6'];

interface Car {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  color: string;
  truck: boolean;
  near: boolean;
  shift: number; // lane-change direction (-1, 0, 1)
  shiftTarget: number;
}

const laneX = (lane: number) => ROAD_L + LANE_W * lane + LANE_W / 2;

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, player: boolean) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - w / 2 + 3, y - h / 2 + 5, w, h);
  fillRoundRect(ctx, x - w / 2, y - h / 2, w, h, 9, color);
  // windshield + rear window
  fillRoundRect(ctx, x - w / 2 + 5, y - h / 2 + (player ? 16 : h - 26), w - 10, 12, 4, 'rgba(15,23,42,0.75)');
  fillRoundRect(ctx, x - w / 2 + 6, y - h / 2 + (player ? h - 22 : 12), w - 12, 9, 3, 'rgba(15,23,42,0.55)');
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x - 2, y - h / 2 + 4, 4, h - 8);
  // lights
  ctx.fillStyle = player ? '#fef9c3' : '#fca5a5';
  ctx.fillRect(x - w / 2 + 4, y - h / 2 + (player ? 1 : h - 4), 8, 3);
  ctx.fillRect(x + w / 2 - 12, y - h / 2 + (player ? 1 : h - 4), 8, 3);
}

export function RoadRush({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const fx = useRef({ particles: new Particles(400, rng.next), floaters: new FloatingText(), shake: new Shake(rng.next) });
  const s = useRef({
    x: laneX(1.5),
    vx: 0,
    targetX: null as number | null,
    drag: null as null | { id: number; px: number; sx: number },
    speed: 300,
    distance: 0,
    scroll: 0,
    cars: [] as Car[],
    coins: [] as { x: number; y: number }[],
    spawnGap: 0,
    started: false,
    crashed: false,
    crashTimer: 0,
    ended: false,
    nearMisses: 0,
    coinCount: 0,
    combo: 0,
    comboTimer: 0,
    bonus: 0,
    score: 0,
    time: 0,
  }).current;

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.drag = { id: p.id, px: p.x, sx: s.x };
  };
  const onMove = (p: StagePointer) => {
    if (s.drag && s.drag.id === p.id) s.targetX = s.drag.sx + (p.x - s.drag.px) * 1.3;
  };
  const onUp = (p: StagePointer) => {
    if (s.drag?.id === p.id) {
      s.drag = null;
      s.targetX = null;
    }
  };

  const spawn = () => {
    const progress = s.distance / 1000;
    const truck = rng.chance(0.15);
    const lane = rng.int(0, LANES - 1);
    // Keep at least one lane free at the spawn row.
    const blocked = new Set(s.cars.filter((c) => c.y < 0 && c.y > -CAR_H * 2.5).map((c) => Math.round((c.x - ROAD_L - LANE_W / 2) / LANE_W)));
    if (blocked.size >= LANES - 1 && !blocked.has(lane)) return;
    s.cars.push({
      x: laneX(lane),
      y: -CAR_H,
      w: truck ? 42 : CAR_W,
      h: truck ? 120 : CAR_H - rng.int(0, 8),
      speed: rng.range(90, 170) * (truck ? 0.7 : 1),
      color: truck ? '#94a3b8' : rng.pick(CAR_COLORS),
      truck,
      near: false,
      shift: 0,
      shiftTarget: laneX(lane),
    });
    if (progress > 2 && rng.chance(0.25)) {
      const car = s.cars[s.cars.length - 1]!;
      const dir = lane === 0 ? 1 : lane === LANES - 1 ? -1 : rng.chance(0.5) ? 1 : -1;
      car.shiftTarget = laneX(lane + dir);
    }
    if (rng.chance(0.35)) {
      const coinLane = rng.int(0, LANES - 1);
      if (coinLane !== lane) for (let i = 0; i < 3; i++) s.coins.push({ x: laneX(coinLane), y: -CAR_H - i * 40 });
    }
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;
    const k = keys.current;
    const steer = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    if (steer) s.started = true;

    if (s.started && !s.crashed) {
      s.speed = Math.min(760, 300 + s.distance * 0.018);
      s.distance += s.speed * dt;
      s.scroll += s.speed * dt;
      if (steer) {
        s.vx = clamp(s.vx + steer * 1600 * dt, -330, 330);
        s.targetX = null;
      } else if (s.targetX !== null) {
        s.vx = clamp((s.targetX - s.x) * 9, -380, 380);
      } else s.vx *= Math.max(0, 1 - dt * 10);
      s.x = clamp(s.x + s.vx * dt, ROAD_L + CAR_W / 2 + 2, ROAD_R - CAR_W / 2 - 2);

      s.spawnGap -= s.speed * dt;
      if (s.spawnGap <= 0) {
        spawn();
        s.spawnGap = Math.max(95, 230 - s.distance * 0.004) * rng.range(0.7, 1.3);
      }
      const player = { x: s.x - CAR_W / 2 + 4, y: PLAYER_Y - CAR_H / 2 + 4, w: CAR_W - 8, h: CAR_H - 8 };
      for (const c of s.cars) {
        c.y += (s.speed - c.speed) * dt;
        if (c.shiftTarget !== c.x && c.y > 60) c.x += clamp(c.shiftTarget - c.x, -60 * dt, 60 * dt);
        const box = { x: c.x - c.w / 2 + 3, y: c.y - c.h / 2 + 3, w: c.w - 6, h: c.h - 6 };
        if (rectsOverlap(player, box)) {
          s.crashed = true;
          s.crashTimer = 1.1;
          shake.add(18);
          particles.burst(s.x, PLAYER_Y - 20, { count: 50, colors: ['#fb923c', '#fde047', '#fff', '#64748b'], speed: 320, life: 0.9 });
          api.sfx('explode');
          api.haptic([80, 40, 120]);
          break;
        }
        const gap = Math.abs(c.x - s.x) - (c.w + CAR_W) / 2;
        if (!c.near && gap < 14 && c.y - c.h / 2 > PLAYER_Y + CAR_H / 2 - 10 && c.y - c.h / 2 < PLAYER_Y + CAR_H / 2 + 20) {
          c.near = true;
          s.nearMisses += 1;
          s.combo += 1;
          s.comboTimer = 2.5;
          const pts = 20 * Math.min(5, s.combo);
          s.bonus += pts;
          floaters.add(s.combo > 1 ? `Near miss ×${s.combo} +${pts}` : `Near miss +${pts}`, s.x, PLAYER_Y - 50, '#fde047', 16, 0.8);
          api.sfx('swap');
        }
      }
      s.cars = s.cars.filter((c) => c.y < H + 140);
      for (const coin of s.coins) {
        coin.y += s.speed * dt;
        if (Math.abs(coin.x - s.x) < 26 && Math.abs(coin.y - PLAYER_Y) < 40) {
          coin.y = H + 100;
          s.coinCount += 1;
          s.bonus += 10;
          api.sfx('coin');
        }
      }
      s.coins = s.coins.filter((c) => c.y < H + 20);
      s.comboTimer -= dt;
      if (s.comboTimer <= 0) s.combo = 0;
      const next = Math.floor(s.distance / 10) + s.bonus;
      if (next !== s.score) {
        s.score = next;
        api.setScore(s.score);
      }
      if (rng.chance(0.5)) particles.burst(s.x + rng.range(-10, 10), PLAYER_Y + CAR_H / 2, { count: 1, color: 'rgba(148,163,184,0.6)', speed: 60, life: 0.4, size: 5, angle: Math.PI / 2, spread: 0.5 });
    } else if (s.crashed && !s.ended) {
      s.crashTimer -= dt;
      if (s.crashTimer <= 0) {
        s.ended = true;
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Distance', value: `${(s.distance / 1000).toFixed(2)} km` },
            { label: 'Near misses', value: String(s.nearMisses) },
            { label: 'Coins', value: String(s.coinCount) },
          ],
        });
      }
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    ctx.fillStyle = '#166534';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    // roadside trees
    for (let i = 0; i < 8; i++) {
      const y = ((i * 110 + s.scroll * 0.9) % (H + 110)) - 60;
      circle(ctx, 14, y, 14, '#15803d');
      circle(ctx, W - 14, y + 55, 14, '#15803d');
    }
    ctx.fillStyle = '#374151';
    ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(ROAD_L + 3, 0, 4, H);
    ctx.fillRect(ROAD_R - 7, 0, 4, H);
    ctx.fillStyle = 'rgba(248,250,252,0.7)';
    for (let lane = 1; lane < LANES; lane++) {
      const x = ROAD_L + LANE_W * lane - 2;
      for (let y = (s.scroll % 60) - 60; y < H; y += 60) ctx.fillRect(x, y, 4, 30);
    }
    for (const coin of s.coins) {
      circle(ctx, coin.x, coin.y, 9, '#facc15');
      circle(ctx, coin.x - 2, coin.y - 2, 3, '#fef9c3');
    }
    for (const c of s.cars) drawCar(ctx, c.x, c.y, c.w, c.h, c.color, false);
    if (!s.crashed) drawCar(ctx, s.x, PLAYER_Y, CAR_W, CAR_H, '#fbbf24', true);
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    fillRoundRect(ctx, W / 2 - 70, 10, 140, 34, 17, 'rgba(0,0,0,0.45)');
    text(ctx, `${Math.round(s.speed * 0.3)} km/h`, W / 2, 27, { size: 16, weight: 800, color: '#fde68a' });
    text(ctx, s.score.toLocaleString('en'), W - 14, 64, { size: 18, weight: 800, align: 'right' });
    if (!s.started) prompt(ctx, 'Drag or use ←/→ to steer', W / 2, H * 0.45, s.time, 18);
  }, !paused);

  return (
    <CanvasStage ref={view} width={W} height={H} label="Road Rush game area" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
  );
}
