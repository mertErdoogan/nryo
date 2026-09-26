import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  createContinueGate,
  drawCoin,
  fillRoundRect,
  hudPill,
  prompt,
  shade,
  text,
  useGameLoop,
  useHeldKeys,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { clamp } from '../../lib/math';
import type { Rng } from '../../lib/rng';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const HORIZON = 250;
const SEG = 200; // segment length (world units)
const ROAD = 850; // half road width
const CAM_H = 1000;
const DEPTH = 1 / Math.tan(((100 / 2) * Math.PI) / 180);
const PLAYER_Z = CAM_H * DEPTH;
const DRAW = 160;
const MAX_SPEED = SEG * 60;
const CAR_W = 0.36; // in road half-widths
const METERS_PER_UNIT = 1 / 180;
const CHECKPOINT_M = 1500;

interface Point {
  wy: number;
  wz: number;
  sx: number;
  sy: number;
  sw: number;
  scale: number;
  cz: number;
}
interface Segment {
  index: number;
  p1: Point;
  p2: Point;
  curve: number;
  dark: boolean;
  clip: number;
  looped: boolean;
  coins: { offset: number; taken: boolean }[];
}
interface Car {
  offset: number;
  z: number;
  speed: number;
  color: string;
  prevRel: number;
  truck: boolean;
}

const pt = (wy: number, wz: number): Point => ({ wy, wz, sx: 0, sy: 0, sw: 0, scale: 0, cz: 0 });
const easeIn = (a: number, b: number, t: number) => a + (b - a) * t * t;
const easeInOut = (a: number, b: number, t: number) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);
const TRAFFIC = ['#22d3ee', '#a3e635', '#f97316', '#e879f9', '#facc15', '#60a5fa', '#f1f5f9'];

function buildTrack(rng: Rng) {
  const segs: Segment[] = [];
  const lastY = () => (segs.length === 0 ? 0 : segs[segs.length - 1]!.p2.wy);
  const add = (curve: number, y: number) => {
    const n = segs.length;
    segs.push({
      index: n,
      p1: pt(lastY(), n * SEG),
      p2: pt(y, (n + 1) * SEG),
      curve,
      dark: Math.floor(n / 3) % 2 === 0,
      clip: 0,
      looped: false,
      coins: [],
    });
  };
  const road = (enter: number, hold: number, leave: number, curve: number, height: number) => {
    const startY = lastY();
    const endY = startY + height * SEG;
    const total = enter + hold + leave;
    for (let i = 0; i < enter; i++) add(easeIn(0, curve, i / enter), easeInOut(startY, endY, i / total));
    for (let i = 0; i < hold; i++) add(curve, easeInOut(startY, endY, (enter + i) / total));
    for (let i = 0; i < leave; i++)
      add(easeInOut(curve, 0, i / leave), easeInOut(startY, endY, (enter + hold + i) / total));
  };
  road(20, 60, 20, 0, 0);
  while (segs.length < 5200) {
    const kind = rng.int(0, 5);
    const len = rng.int(25, 70);
    const hill = rng.chance(0.5) ? rng.range(-40, 40) : 0;
    if (kind <= 1) road(15, len, 15, 0, hill);
    else if (kind <= 3) road(20, len, 20, (rng.chance(0.5) ? -1 : 1) * rng.range(2, 6), hill);
    else if (kind === 4) {
      // S-bend
      const c = rng.range(3, 5);
      road(15, 30, 15, c, 0);
      road(15, 30, 15, -c, 0);
    } else road(30, len, 30, 0, rng.range(-60, 60));
  }
  // Level out so the loop joins smoothly.
  road(40, 40, 40, 0, -lastY() / SEG);
  // Coin trails.
  for (let i = 120; i < segs.length - 40; i += rng.int(60, 140)) {
    const lane = rng.pick([-0.66, 0, 0.66]);
    for (let k = 0; k < 6; k++) segs[i + k * 4]!.coins.push({ offset: lane, taken: false });
  }
  return segs;
}

export function NeonRacer({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const colors = lo.skin.colors;
  const topSpeed = MAX_SPEED * (1 + 0.05 * lo.level('engine'));
  const grip = 1 + 0.12 * lo.level('grip');
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef(
    (() => {
      const segments = buildTrack(rng);
      const trackLength = segments.length * SEG;
      const cars: Car[] = [];
      for (let i = 0; i < 70; i++) {
        const truck = rng.chance(0.15);
        cars.push({
          offset: rng.pick([-0.66, 0, 0.66]) + rng.range(-0.08, 0.08),
          z: rng.range(4000, trackLength - 2000),
          speed: MAX_SPEED * (truck ? rng.range(0.2, 0.32) : rng.range(0.28, 0.5)),
          color: rng.pick(TRAFFIC),
          prevRel: 1,
          truck,
        });
      }
      return {
        segments,
        trackLength,
        cars,
        position: 0,
        playerX: 0,
        speed: 0,
        dist: 0,
        time: 30 + 3 * lo.level('clock'),
        nextCheckpoint: CHECKPOINT_M,
        checkpoints: 0,
        overtakes: 0,
        coins: 0,
        nitro: 1 + lo.level('nitro'),
        nitroTime: 0,
        score: 0,
        started: false,
        out: false,
        ended: false,
        drag: null as null | { id: number; x: number; px: number },
        steerTarget: null as number | null,
        clock: 0,
        banner: 0,
        crashCooldown: 0,
      };
    })(),
  ).current;

  const fireNitro = () => {
    if (s.nitro <= 0 || s.nitroTime > 0 || s.out) return;
    s.started = true;
    s.nitro -= 1;
    s.nitroTime = 2.6;
    api.sfx('powerup');
    api.haptic(30);
  };

  useKeyDown((code) => {
    if (code === 'Space' || code === 'KeyN') fireNitro();
    if (code.startsWith('Arrow') || code === 'KeyA' || code === 'KeyD') s.started = true;
  }, !paused);

  const onDown = (p: StagePointer) => {
    s.started = true;
    if (p.x > W - 96 && p.y > H - 96) {
      fireNitro();
      return;
    }
    s.drag = { id: p.id, x: s.playerX, px: p.x };
  };
  const onMove = (p: StagePointer) => {
    if (s.drag?.id === p.id) s.steerTarget = clamp(s.drag.x + (p.x - s.drag.px) / 110, -1.3, 1.3);
  };
  const onUp = (p: StagePointer) => {
    if (s.drag?.id === p.id) {
      s.drag = null;
      s.steerTarget = null;
    }
  };

  const segAt = (z: number) => s.segments[Math.floor(z / SEG) % s.segments.length]!;
  const wrap = (z: number) => ((z % s.trackLength) + s.trackLength) % s.trackLength;

  const timeUp = () => {
    s.out = true;
    api.sfx('gameover');
    continueGate(
      () => {
        s.out = false;
        s.time += 15;
        s.banner = 1.5;
        fx.current.floaters.add('+15 s', W / 2, 200, '#86efac', 26, 1.2);
      },
      () => {
        s.ended = true;
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Distance', value: `${((s.dist * METERS_PER_UNIT) / 1000).toFixed(2)} km` },
            { label: 'Checkpoints', value: String(s.checkpoints) },
            { label: 'Overtakes', value: String(s.overtakes) },
            { label: 'Coins', value: String(s.coins) },
          ],
        });
      },
    );
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    const ctx = v.ctx;
    s.clock += dt;
    const k = keys.current;
    const left = k.has('ArrowLeft') || k.has('KeyA');
    const right = k.has('ArrowRight') || k.has('KeyD');
    const brake = k.has('ArrowDown') || k.has('KeyS');

    const playerSeg = segAt(s.position + PLAYER_Z);
    const speedPct = s.speed / MAX_SPEED;

    if (s.started && !s.out && !s.ended) {
      const nitro = s.nitroTime > 0;
      s.nitroTime = Math.max(0, s.nitroTime - dt);
      s.crashCooldown = Math.max(0, s.crashCooldown - dt);
      const limit = nitro ? topSpeed * 1.35 : topSpeed;
      const steer = dt * 2.4 * Math.min(1, speedPct + 0.2);
      if (left) s.playerX -= steer;
      if (right) s.playerX += steer;
      if (s.steerTarget !== null) s.playerX += clamp(s.steerTarget - s.playerX, -steer * 1.4, steer * 1.4);
      s.playerX -= (dt * 2 * speedPct * speedPct * playerSeg.curve * 0.3) / grip;
      if (brake) s.speed -= MAX_SPEED * dt;
      else if (s.speed < limit) s.speed += (MAX_SPEED / (nitro ? 1.6 : 4.5)) * dt;
      else s.speed -= (MAX_SPEED / 3) * dt;
      if (Math.abs(s.playerX) > 1 && s.speed > MAX_SPEED / 4) {
        s.speed -= (MAX_SPEED / 1.6) * dt;
        if (rng.chance(0.6))
          particles.burst(W / 2 + rng.range(-30, 30), H - 40, {
            count: 1,
            color: '#65a30d',
            speed: 90,
            life: 0.5,
            size: 5,
          });
      }
      s.playerX = clamp(s.playerX, -2.2, 2.2);
      s.speed = clamp(s.speed, 0, limit * 1.05);
      s.position = wrap(s.position + s.speed * dt);
      s.dist += s.speed * dt;
      s.time -= dt;

      // Traffic, overtakes, collisions.
      const playerZ = s.position + PLAYER_Z;
      for (const car of s.cars) {
        car.z = wrap(car.z + car.speed * dt);
        let rel = car.z - wrap(playerZ);
        if (rel > s.trackLength / 2) rel -= s.trackLength;
        if (rel < -s.trackLength / 2) rel += s.trackLength;
        if (car.prevRel > 0 && rel <= 0 && rel > -SEG * 4) {
          s.overtakes += 1;
          floaters.add('Overtake +25', W / 2, H - 150, '#f9a8d4', 16, 0.7);
        }
        car.prevRel = rel;
        const carW = car.truck ? CAR_W * 1.2 : CAR_W;
        if (
          rel > 0 &&
          rel < SEG * 0.9 &&
          Math.abs(car.offset - s.playerX) < (CAR_W + carW) * 0.42 &&
          s.crashCooldown <= 0
        ) {
          s.speed = car.speed * 0.5;
          s.position = wrap(car.z - PLAYER_Z - SEG * 0.6);
          s.crashCooldown = 0.4;
          shake.add(12);
          particles.burst(W / 2, H - 90, {
            count: 26,
            colors: ['#fff', '#fde047', car.color],
            speed: 260,
            life: 0.6,
          });
          api.sfx('hit');
          api.haptic([40, 30, 60]);
          car.prevRel = -1;
        }
      }
      // Coins in the player's segment.
      for (const c of playerSeg.coins) {
        if (!c.taken && Math.abs(c.offset - s.playerX) < 0.3) {
          c.taken = true;
          s.coins += 1;
          api.addCoins(1);
          api.sfx('coin');
        }
      }
      // Checkpoints.
      const meters = s.dist * METERS_PER_UNIT;
      if (meters >= s.nextCheckpoint) {
        s.checkpoints += 1;
        const bonus = Math.max(14, 24 - s.checkpoints);
        s.time += bonus;
        s.nextCheckpoint += CHECKPOINT_M;
        s.banner = 1.6;
        floaters.add(`Checkpoint! +${bonus} s`, W / 2, 190, '#86efac', 22, 1.3);
        api.sfx('levelup');
      }
      const next = Math.floor(meters) + s.overtakes * 25;
      if (next !== s.score) {
        s.score = next;
        api.setScore(next);
      }
      if (s.time <= 0) {
        s.time = 0;
        timeUp();
      }
      if (nitro && rng.chance(0.8))
        particles.burst(W / 2 + rng.range(-16, 16), H - 30, {
          count: 1,
          colors: ['#22d3ee', '#a5f3fc'],
          speed: 140,
          life: 0.35,
          angle: Math.PI / 2,
          spread: 0.6,
          size: 6,
        });
    }
    s.banner = Math.max(0, s.banner - dt);
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 40);
    sky.addColorStop(0, '#0f0a2e');
    sky.addColorStop(0.6, '#5b1a5c');
    sky.addColorStop(1, '#f97316');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // sun + grid mountains, parallax on curve
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(W / 2, HORIZON - 20, 62, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#5b1a5c';
    for (let i = 0; i < 5; i++) ctx.fillRect(W / 2 - 70, HORIZON - 58 + i * 9, 140, 2 + i);
    ctx.fillStyle = '#2e1065';
    ctx.beginPath();
    ctx.moveTo(0, HORIZON + 10);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, HORIZON - 16 - Math.abs(Math.sin(x * 0.03 + 1.2)) * 34);
    ctx.lineTo(W, HORIZON + 10);
    ctx.fill();

    ctx.save();
    shake.apply(ctx);
    const base = segAt(s.position);
    const basePct = (s.position % SEG) / SEG;
    const pSeg = segAt(s.position + PLAYER_Z);
    const pPct = ((s.position + PLAYER_Z) % SEG) / SEG;
    const playerY = pSeg.p1.wy + (pSeg.p2.wy - pSeg.p1.wy) * pPct;
    let maxy = H;
    let x = 0;
    let dx = -(base.curve * basePct);
    const project = (p: Point, camX: number, camY: number, camZ: number) => {
      p.cz = p.wz - camZ;
      p.scale = DEPTH / Math.max(1, p.cz);
      p.sx = W / 2 - p.scale * camX * (W / 2);
      p.sy = HORIZON - p.scale * (p.wy - camY) * (H / 2);
      p.sw = p.scale * ROAD * (W / 2);
    };
    const drawn: Segment[] = [];
    for (let n = 0; n < DRAW; n++) {
      const seg = s.segments[(base.index + n) % s.segments.length]!;
      seg.looped = seg.index < base.index;
      seg.clip = maxy;
      const camZ = s.position - (seg.looped ? s.trackLength : 0);
      project(seg.p1, s.playerX * ROAD - x, playerY + CAM_H, camZ);
      project(seg.p2, s.playerX * ROAD - x - dx, playerY + CAM_H, camZ);
      x += dx;
      dx += seg.curve;
      drawn.push(seg);
      if (seg.p1.cz <= DEPTH || seg.p2.sy >= seg.p1.sy || seg.p2.sy >= maxy) continue;
      const { p1, p2 } = seg;
      ctx.fillStyle = seg.dark ? '#1e1b4b' : '#27235f';
      ctx.fillRect(0, p2.sy, W, p1.sy - p2.sy + 1);
      const quad = (x1: number, w1: number, x2: number, w2: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1 - w1, p1.sy);
        ctx.lineTo(x1 + w1, p1.sy);
        ctx.lineTo(x2 + w2, p2.sy);
        ctx.lineTo(x2 - w2, p2.sy);
        ctx.fill();
      };
      quad(p1.sx, p1.sw * 1.15, p2.sx, p2.sw * 1.15, seg.dark ? '#f472b6' : '#22d3ee');
      quad(p1.sx, p1.sw, p2.sx, p2.sw, seg.dark ? '#27272a' : '#2f2f35');
      if (seg.dark) {
        const lw1 = p1.sw * 0.025;
        const lw2 = p2.sw * 0.025;
        quad(p1.sx - p1.sw / 3, lw1, p2.sx - p2.sw / 3, lw2, '#e5e7eb');
        quad(p1.sx + p1.sw / 3, lw1, p2.sx + p2.sw / 3, lw2, '#e5e7eb');
      }
      maxy = p2.sy;
    }
    // Checkpoint gate position (absolute distance → segment).
    const gateZ = s.nextCheckpoint / METERS_PER_UNIT - s.dist + s.position + PLAYER_Z;
    const gateSeg = segAt(wrap(gateZ));

    // Sprites back to front.
    for (let n = drawn.length - 1; n > 4; n--) {
      const seg = drawn[n]!;
      const { p1, p2 } = seg;
      if (p1.cz <= DEPTH) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, seg.clip);
      ctx.clip();
      if (seg === gateSeg) {
        const gx = p1.sx;
        const gw = p1.sw * 1.2;
        const gh = p1.scale * 1500 * (H / 2);
        ctx.fillStyle = '#f472b6';
        ctx.fillRect(gx - gw, p1.sy - gh, Math.max(2, gw * 0.05), gh);
        ctx.fillRect(gx + gw * 0.95, p1.sy - gh, Math.max(2, gw * 0.05), gh);
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = i % 2 ? '#fff' : '#111';
          ctx.fillRect(gx - gw + (i * gw * 2) / 10, p1.sy - gh, (gw * 2) / 10 + 1, gh * 0.12);
        }
      }
      for (const c of seg.coins) {
        if (c.taken) continue;
        const sc = p1.scale;
        drawCoin(
          ctx,
          p1.sx + sc * c.offset * ROAD * (W / 2),
          p1.sy - sc * 160 * (H / 2),
          Math.max(1.5, sc * 90 * (W / 2)),
          s.clock,
        );
      }
      for (const car of s.cars) {
        if (Math.floor(car.z / SEG) !== seg.index) continue;
        const pct = (car.z % SEG) / SEG;
        const sc = p1.scale + (p2.scale - p1.scale) * pct;
        const cx = p1.sx + (p2.sx - p1.sx) * pct + sc * car.offset * ROAD * (W / 2);
        const cy = p1.sy + (p2.sy - p1.sy) * pct;
        const cw = sc * (car.truck ? 420 : 340) * (W / 2);
        const ch = cw * (car.truck ? 0.9 : 0.55);
        if (cw < 2) continue;
        fillRoundRect(ctx, cx - cw / 2, cy - ch, cw, ch, cw * 0.12, car.truck ? '#94a3b8' : car.color);
        ctx.fillStyle = 'rgba(15,23,42,0.7)';
        ctx.fillRect(cx - cw * 0.35, cy - ch * (car.truck ? 0.9 : 0.78), cw * 0.7, ch * 0.28);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(cx - cw * 0.45, cy - ch * 0.35, cw * 0.18, ch * 0.12);
        ctx.fillRect(cx + cw * 0.27, cy - ch * 0.35, cw * 0.18, ch * 0.12);
        ctx.fillStyle = '#111';
        ctx.fillRect(cx - cw * 0.45, cy - ch * 0.08, cw * 0.2, ch * 0.12);
        ctx.fillRect(cx + cw * 0.25, cy - ch * 0.08, cw * 0.2, ch * 0.12);
      }
      ctx.restore();
    }

    // Player car.
    const bounce = s.speed > 0 ? Math.sin(s.clock * 30) * (s.speed / MAX_SPEED) * 1.5 : 0;
    const turn =
      (right ? 1 : 0) -
      (left ? 1 : 0) +
      (s.steerTarget !== null ? clamp((s.steerTarget - s.playerX) * 3, -1, 1) : 0);
    const px = W / 2;
    const py = H - 40 + bounce;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(turn * 0.05);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-46, -6, 92, 12);
    fillRoundRect(ctx, -44, -52, 88, 46, 12, colors[0]);
    fillRoundRect(ctx, -32, -74, 64, 28, 10, colors[1]);
    fillRoundRect(ctx, -26, -70, 52, 16, 5, shade(colors[2], -0.1));
    ctx.fillStyle = s.nitroTime > 0 ? '#22d3ee' : '#fde047';
    ctx.fillRect(-40, -30, 18, 8);
    ctx.fillRect(22, -30, 18, 8);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(-46, -14, 18, 14);
    ctx.fillRect(28, -14, 18, 14);
    ctx.fillStyle = shade(colors[0], 0.35);
    ctx.fillRect(-40, -50, 80, 3);
    ctx.restore();
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    // HUD
    const lowTime = s.time < 6;
    fillRoundRect(ctx, W / 2 - 52, 10, 104, 44, 14, lowTime ? 'rgba(220,38,38,0.7)' : 'rgba(0,0,0,0.45)');
    text(ctx, s.time.toFixed(1), W / 2, 33, { size: 26, weight: 850, color: lowTime ? '#fff' : '#fde68a' });
    hudPill(ctx, 10, 14, `${Math.round((s.speed / MAX_SPEED) * 240)} km/h`, { size: 14 });
    hudPill(ctx, W - 10, 14, String(s.coins), { align: 'right', coin: true, size: 14 });
    const toCp = Math.max(0, s.nextCheckpoint - s.dist * METERS_PER_UNIT);
    hudPill(ctx, W / 2, 62, `Checkpoint in ${Math.ceil(toCp)} m`, {
      align: 'center',
      size: 12,
      color: '#f9a8d4',
    });
    // Nitro button
    ctx.globalAlpha = s.nitro > 0 ? 1 : 0.4;
    fillRoundRect(
      ctx,
      W - 88,
      H - 88,
      76,
      76,
      38,
      s.nitroTime > 0 ? 'rgba(34,211,238,0.6)' : 'rgba(0,0,0,0.45)',
    );
    text(ctx, 'NITRO', W - 50, H - 58, { size: 13, weight: 850, color: '#a5f3fc' });
    text(ctx, `×${s.nitro}`, W - 50, H - 38, { size: 18, weight: 850 });
    ctx.globalAlpha = 1;
    if (!s.started) prompt(ctx, 'Drag or ←/→ to start', W / 2, H * 0.55, s.clock, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Neon Racer game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
