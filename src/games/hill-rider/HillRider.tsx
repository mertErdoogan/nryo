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
  shade,
  text,
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import type { GameProps } from '../../platform/types';

const H = 600;
const SUB = 4;
const PX_PER_M = 10;
const START_X = 200;

interface P {
  x: number;
  y: number;
  px: number;
  py: number;
}

interface Vehicle {
  wheelR: number;
  base: number;
  height: number;
  power: number;
  mass: number;
  grip: number;
  gravity: number;
}

function vehicleFor(id: string): Vehicle {
  switch (id) {
    case 'buggy':
      return { wheelR: 16, base: 58, height: 20, power: 1.12, mass: 0.85, grip: 1, gravity: 1100 };
    case 'rally':
      return { wheelR: 15, base: 66, height: 20, power: 1.15, mass: 1, grip: 1.2, gravity: 1100 };
    case 'monster':
      return { wheelR: 25, base: 70, height: 28, power: 1.2, mass: 1.2, grip: 1.15, gravity: 1100 };
    case 'rover':
      return { wheelR: 17, base: 64, height: 22, power: 0.95, mass: 1, grip: 1, gravity: 560 };
    default:
      return { wheelR: 17, base: 62, height: 24, power: 1, mass: 1, grip: 1, gravity: 1100 };
  }
}

export function HillRider({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const veh = useRef(vehicleFor(lo.skin.id)).current;
  const power = veh.power * (1 + 0.1 * lo.level('engine'));
  const traction = 0.07 * veh.grip * (1 + 0.12 * lo.level('tires'));
  const stiffness = 0.35 + 0.08 * lo.level('suspension');
  const fuelMax = 17 * (1 + 0.2 * lo.level('tank'));
  const fx = useRef({ particles: new Particles(300, rng.next), floaters: new FloatingText() });
  const continueGate = useRef(createContinueGate(api)).current;

  const terrain = useRef(
    (() => {
      const waves = [
        { a: 95, f: 0.0019, p: rng.range(0, 6) },
        { a: 42, f: 0.0051, p: rng.range(0, 6) },
        { a: 14, f: 0.013, p: rng.range(0, 6) },
      ];
      return (x: number) => {
        const d = Math.max(0, x - 500);
        const ease = Math.min(1, d / 900);
        const grow = Math.min(1.9, 0.55 + d / 16000);
        let y = 0;
        for (const w of waves) y += w.a * Math.sin(w.f * x + w.p);
        return 380 + y * ease * grow + d * 0.012 * Math.sin(x * 0.0007);
      };
    })(),
  ).current;

  const makeCar = (x: number): P[] => {
    const g = terrain(x);
    const y = g - veh.wheelR - 30;
    const pts = [
      [x, y],
      [x + veh.base, y],
      [x + 4, y - veh.height - 10],
      [x + veh.base - 4, y - veh.height - 10],
    ] as const;
    return pts.map(([px, py]) => ({ x: px, y: py, px, py }));
  };

  const s = useRef({
    pts: makeCar(START_X),
    spin: [0, 0],
    touching: [false, false],
    fuel: fuelMax,
    maxX: START_X,
    score: 0,
    coinsGot: 0,
    started: false,
    state: 'drive' as 'drive' | 'crashed' | 'empty' | 'waiting' | 'over',
    stateT: 0,
    stillT: 0,
    camX: START_X,
    camY: 300,
    clock: 0,
    items: [] as { x: number; kind: 'coin' | 'fuel'; taken: boolean }[],
    nextItemX: 700,
    pointerGas: new Map<number, 'gas' | 'brake'>(),
  }).current;

  const cons = (() => {
    const d = (i: number, j: number) => Math.hypot(s.pts[i]!.x - s.pts[j]!.x, s.pts[i]!.y - s.pts[j]!.y);
    return [
      [0, 1, d(0, 1), 1],
      [2, 3, d(2, 3), 1],
      [0, 3, d(0, 3), 1],
      [1, 2, d(1, 2), 1],
      [0, 2, d(0, 2), stiffness],
      [1, 3, d(1, 3), stiffness],
    ] as [number, number, number, number][];
  })();
  const consRef = useRef(cons).current;

  const genItems = (upTo: number) => {
    while (s.nextItemX < upTo) {
      if (Math.floor(s.nextItemX / 3600) !== Math.floor((s.nextItemX - 420) / 3600) && s.nextItemX > 2000)
        s.items.push({ x: s.nextItemX, kind: 'fuel', taken: false });
      else if (rng.chance(0.55))
        for (let i = 0; i < 5; i++) s.items.push({ x: s.nextItemX + i * 26, kind: 'coin', taken: false });
      s.nextItemX += rng.int(300, 460);
    }
  };

  const end = (reason: 'crash' | 'fuel') => {
    s.state = 'waiting';
    continueGate(
      () => {
        const x = s.maxX - 40;
        s.pts = makeCar(x);
        s.spin = [0, 0];
        s.fuel = Math.max(s.fuel, fuelMax * 0.6);
        s.state = 'drive';
        s.stillT = 0;
        fx.current.floaters.add(
          reason === 'fuel' ? 'Refuelled!' : 'Back on the road!',
          W() / 2,
          200,
          '#86efac',
          22,
          1.2,
        );
      },
      () => {
        s.state = 'over';
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Distance', value: `${s.score} m` },
            { label: 'Coins', value: String(s.coinsGot) },
            { label: 'Ended by', value: reason === 'fuel' ? 'Out of fuel' : 'Crash' },
          ],
        });
      },
    );
  };

  const W = () => view.current?.width ?? 360;

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.pointerGas.set(p.id, p.x > W() / 2 ? 'gas' : 'brake');
  };
  const onUp = (p: StagePointer) => {
    s.pointerGas.delete(p.id);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const width = v.width;
    const { particles, floaters } = fx.current;
    s.clock += dt;
    const k = keys.current;
    let gas = k.has('ArrowRight') || k.has('KeyD') || k.has('ArrowUp');
    let brake = k.has('ArrowLeft') || k.has('KeyA') || k.has('ArrowDown');
    for (const m of s.pointerGas.values()) {
      if (m === 'gas') gas = true;
      else brake = true;
    }
    if (gas || brake) s.started = true;
    if (s.fuel <= 0) gas = false;
    const driving = s.state === 'drive' && s.started;

    if (driving) {
      const h = dt / SUB;
      for (let step = 0; step < SUB; step++) {
        // integrate
        for (let i = 0; i < 4; i++) {
          const p = s.pts[i]!;
          const vx = (p.x - p.px) * 0.999;
          const vy = (p.y - p.py) * 0.999;
          p.px = p.x;
          p.py = p.y;
          p.x += vx;
          p.y += vy + veh.gravity * h * h * (i < 2 ? 1 : veh.mass);
        }
        // air / wheelie torque
        const air = !s.touching[0] && !s.touching[1];
        const torque = (gas ? -1 : 0) + (brake ? 1 : 0);
        if (torque !== 0) {
          const cx = (s.pts[0]!.x + s.pts[1]!.x + s.pts[2]!.x + s.pts[3]!.x) / 4;
          const cy = (s.pts[0]!.y + s.pts[1]!.y + s.pts[2]!.y + s.pts[3]!.y) / 4;
          const kq = (air ? 0.00011 : 0.000028) * torque;
          for (const p of s.pts) {
            p.x += -(p.y - cy) * kq;
            p.y += (p.x - cx) * kq;
          }
        }
        // constraints
        for (let it = 0; it < 3; it++) {
          for (const [i, j, rest, stiff] of consRef) {
            const a = s.pts[i]!;
            const b = s.pts[j]!;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 0.0001;
            const diff = ((d - rest) / d) * 0.5 * stiff;
            a.x += dx * diff;
            a.y += dy * diff;
            b.x -= dx * diff;
            b.y -= dy * diff;
          }
          // wheels vs ground
          for (let w = 0; w < 2; w++) {
            const p = s.pts[w]!;
            const g = terrain(p.x);
            const slope = (terrain(p.x + 1) - terrain(p.x - 1)) / 2;
            const L = Math.sqrt(1 + slope * slope);
            const dist = (g - p.y) / L;
            s.touching[w] = dist < veh.wheelR + 0.5;
            if (dist < veh.wheelR) {
              const nx = slope / L;
              const ny = -1 / L;
              const pen = veh.wheelR - dist;
              p.x += nx * pen;
              p.y += ny * pen;
              if (it === 2) {
                const tx = 1 / L;
                const ty = slope / L;
                const vx = p.x - p.px;
                const vy = p.y - p.py;
                let vn = vx * nx + vy * ny;
                let vt = vx * tx + vy * ty;
                if (vn < 0) vn = -vn * 0.05;
                const maxV = 400 * power * h;
                if (gas) vt += (maxV - vt) * traction;
                else if (brake) vt += (-maxV * 0.45 - vt) * traction * 0.9;
                else vt *= 0.997;
                p.px = p.x - (tx * vt + nx * vn);
                p.py = p.y - (ty * vt + ny * vn);
                s.spin[w]! += vt / veh.wheelR;
              }
            }
          }
        }
        if (!s.touching[0]) s.spin[0]! += gas ? 0.02 : 0;
        if (!s.touching[1]) s.spin[1]! += gas ? 0.02 : 0;
      }
      // chassis contact = crash
      for (const i of [2, 3]) {
        const p = s.pts[i]!;
        if (p.y > terrain(p.x) - 3) {
          s.state = 'crashed';
          s.stateT = 0;
          api.sfx('explode');
          api.haptic([80, 40, 80]);
          particles.burst(p.x, p.y, {
            count: 30,
            colors: ['#78350f', '#a3e635', '#fff'],
            speed: 220,
            life: 0.7,
            gravity: 400,
          });
          break;
        }
      }
      s.fuel = Math.max(0, s.fuel - dt * (gas ? 1 : 0.45));
      const speed = Math.hypot(s.pts[0]!.x - s.pts[0]!.px, s.pts[0]!.y - s.pts[0]!.py) / (dt / SUB);
      if (s.fuel <= 0 && speed < 12) s.stillT += dt;
      else s.stillT = 0;
      if (s.stillT > 1.4 && s.state === 'drive') {
        s.state = 'empty';
        api.sfx('gameover');
        end('fuel');
      }
      const cx = (s.pts[0]!.x + s.pts[1]!.x) / 2;
      if (cx > s.maxX) {
        s.maxX = cx;
        const m = Math.floor((s.maxX - START_X) / PX_PER_M);
        if (m !== s.score) {
          s.score = m;
          api.setScore(m);
        }
      }
      genItems(cx + width + 200);
      for (const it of s.items) {
        if (it.taken || Math.abs(it.x - cx) > 60) continue;
        const iy = terrain(it.x) - 34;
        const near = s.pts.some((p) => Math.hypot(p.x - it.x, p.y - iy) < veh.wheelR + 18);
        if (near) {
          it.taken = true;
          if (it.kind === 'coin') {
            s.coinsGot += 1;
            api.addCoins(1);
            api.sfx('coin');
          } else {
            s.fuel = fuelMax;
            api.sfx('powerup');
            floaters.add('Fuel refilled!', it.x, iy - 30, '#fca5a5', 18);
          }
        }
      }
      s.items = s.items.filter((it) => it.x > cx - width);
      if (gas && s.touching[0] && rng.chance(0.5))
        particles.burst(s.pts[0]!.x - veh.wheelR, s.pts[0]!.y + veh.wheelR * 0.6, {
          count: 1,
          color: 'rgba(120,53,15,0.8)',
          speed: 90,
          angle: Math.PI * 1.15,
          spread: 0.6,
          life: 0.5,
          gravity: 400,
          size: 5,
        });
    } else if (s.state === 'crashed') {
      s.stateT += dt;
      if (s.stateT > 0.9) end('crash');
    }
    particles.update(dt);
    floaters.update(dt);

    // ---------- camera ----------
    const ccx = (s.pts[0]!.x + s.pts[1]!.x) / 2;
    const ccy = (s.pts[0]!.y + s.pts[1]!.y) / 2;
    s.camX += (ccx + width * 0.15 - s.camX) * Math.min(1, dt * 5);
    s.camY += (ccy - 40 - s.camY) * Math.min(1, dt * 4);
    const ox = width / 2 - s.camX;
    const oy = H * 0.55 - s.camY;

    // ---------- render ----------
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, lo.skin.id === 'rover' ? '#0f172a' : '#38bdf8');
    sky.addColorStop(1, lo.skin.id === 'rover' ? '#334155' : '#e0f2fe');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, H);
    // far hills
    ctx.fillStyle = lo.skin.id === 'rover' ? 'rgba(148,163,184,0.25)' : 'rgba(101,163,13,0.25)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= width + 20; x += 20)
      ctx.lineTo(x, 300 + Math.sin((x - ox * 0.3) * 0.006) * 50 + oy * 0.2);
    ctx.lineTo(width, H);
    ctx.fill();

    ctx.save();
    ctx.translate(ox, oy);
    const left = s.camX - width / 2 - 20;
    const right = s.camX + width / 2 + 20;
    const dirt = ctx.createLinearGradient(0, s.camY, 0, s.camY + H);
    dirt.addColorStop(0, lo.skin.id === 'rover' ? '#64748b' : '#92400e');
    dirt.addColorStop(1, lo.skin.id === 'rover' ? '#1e293b' : '#451a03');
    ctx.fillStyle = dirt;
    ctx.beginPath();
    ctx.moveTo(left, s.camY + H);
    for (let x = left; x <= right; x += 6) ctx.lineTo(x, terrain(x));
    ctx.lineTo(right, s.camY + H);
    ctx.fill();
    ctx.strokeStyle = lo.skin.id === 'rover' ? '#cbd5e1' : '#65a30d';
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(left, terrain(left) + 3);
    for (let x = left + 6; x <= right; x += 6) ctx.lineTo(x, terrain(x) + 3);
    ctx.stroke();
    // distance flags
    for (
      let m = Math.ceil((left - START_X) / PX_PER_M / 100) * 100;
      m * PX_PER_M + START_X < right;
      m += 100
    ) {
      if (m <= 0) continue;
      const fxp = START_X + m * PX_PER_M;
      const fy = terrain(fxp);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(fxp - 1, fy - 60, 3, 60);
      fillRoundRect(ctx, fxp + 2, fy - 60, 38, 18, 4, '#ef4444');
      text(ctx, `${m}m`, fxp + 21, fy - 51, { size: 11, weight: 800 });
    }
    for (const it of s.items) {
      if (it.taken || it.x < left || it.x > right) continue;
      const iy = terrain(it.x) - 34;
      if (it.kind === 'coin') drawCoin(ctx, it.x, iy, 9, s.clock);
      else {
        fillRoundRect(ctx, it.x - 11, iy - 14, 22, 28, 4, '#dc2626');
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(it.x - 5, iy - 20, 8, 6);
        text(ctx, 'F', it.x, iy + 1, { size: 14, weight: 900 });
      }
    }
    // vehicle
    const [A, B, C, D] = s.pts as [P, P, P, P];
    const [body, dark, glass] = lo.skin.colors;
    const ang = Math.atan2(D.y - C.y, D.x - C.x);
    const mx = (C.x + D.x) / 2;
    const my = (C.y + D.y) / 2;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(ang);
    const bw = veh.base + 22;
    fillRoundRect(ctx, -bw / 2, -2, bw, veh.height, 7, body);
    fillRoundRect(ctx, -bw / 2 + 12, -veh.height + 2, bw * 0.52, veh.height - 2, 6, dark);
    fillRoundRect(ctx, -bw / 2 + 16, -veh.height + 5, bw * 0.44, veh.height - 10, 4, glass);
    circle(ctx, -bw / 2 + 12 + bw * 0.26, -veh.height - 6, 9, '#fcd34d');
    ctx.fillStyle = shade(body, 0.3);
    ctx.fillRect(-bw / 2 + 4, 2, bw - 8, 3);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(bw / 2 - 5, 3, 5, 5);
    ctx.restore();
    for (const [w, p] of [
      [0, A],
      [1, B],
    ] as const) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(w === 0 ? C.x : D.x, (w === 0 ? C.y : D.y) + 8);
      ctx.stroke();
      circle(ctx, p.x, p.y, veh.wheelR, '#111');
      circle(ctx, p.x, p.y, veh.wheelR * 0.5, '#94a3b8');
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const a = s.spin[w]! + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a) * veh.wheelR * 0.8, p.y + Math.sin(a) * veh.wheelR * 0.8);
        ctx.stroke();
      }
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    // HUD
    const fuelPct = s.fuel / fuelMax;
    fillRoundRect(ctx, 10, 10, 150, 26, 13, 'rgba(0,0,0,0.45)');
    fillRoundRect(
      ctx,
      38,
      16,
      116 * fuelPct,
      14,
      7,
      fuelPct < 0.25 ? '#ef4444' : fuelPct < 0.5 ? '#f59e0b' : '#22c55e',
    );
    text(ctx, '⛽', 24, 24, { size: 14 });
    hudPill(ctx, width - 10, 10, String(s.coinsGot), { align: 'right', coin: true, size: 14 });
    hudPill(ctx, width / 2, 44, `${s.score} m`, { align: 'center', size: 15, color: '#fde68a' });
    // pedals
    const pedal = (x: number, label: string, on: boolean, color: string) => {
      fillRoundRect(ctx, x, H - 86, 96, 72, 20, on ? color : 'rgba(0,0,0,0.35)');
      text(ctx, label, x + 48, H - 50, { size: 16, weight: 850, alpha: 0.9 });
    };
    pedal(12, 'BRAKE', brake, 'rgba(239,68,68,0.7)');
    pedal(width - 108, 'GAS', gas, 'rgba(34,197,94,0.7)');
    if (!s.started) prompt(ctx, 'Hold GAS to drive', width / 2, H * 0.3, s.clock, 20);
    if (s.fuel <= 0 && s.state === 'drive')
      text(ctx, 'OUT OF FUEL', width / 2, 90, { size: 22, weight: 900, color: '#f87171' });
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={360}
      height={H}
      fit="fill"
      minAspect={0.6}
      maxAspect={2}
      label="Hill Rider game area"
      onPointerDown={onDown}
      onPointerUp={onUp}
    />
  );
}
