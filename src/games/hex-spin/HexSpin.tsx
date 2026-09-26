import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
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
const CY = H * 0.47;
const SIDES = 6;
const SEG = TAU / SIDES;
const CORE = 34;
const PLAYER_R = 58;
const SPAWN = 460;

interface Wall {
  side: number;
  dist: number;
  thick: number;
}

const norm = (a: number) => ((a % TAU) + TAU) % TAU;

function hexPoint(side: number, r: number, rot: number) {
  const a = rot + side * SEG;
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r] as const;
}

export function HexSpin({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const turnSpeed = 8.4 * (1 + 0.08 * lo.level('focus'));
  const slow = 1 - 0.05 * lo.level('slow');
  const [accent, dark, light] = lo.skin.colors;
  const fx = useRef({
    particles: new Particles(200, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    walls: [] as Wall[],
    coins: [] as { side: number; dist: number; taken: boolean }[],
    angle: -Math.PI / 2,
    rot: 0,
    rotSpeed: 0.8,
    flipT: 6,
    t: 0,
    nextSpawn: 0,
    shields: lo.level('shield'),
    invuln: 0,
    dead: false,
    deadT: 0,
    started: false,
    touch: new Map<number, number>(),
    coinCount: 0,
    clock: 0,
    pulse: 0,
    lastSecond: 0,
  }).current;

  const speed = () => (170 + Math.min(170, s.t * 3.2)) * slow;

  const pattern = () => {
    const base = SPAWN;
    const pick = rng.int(0, s.t > 25 ? 4 : s.t > 10 ? 3 : 1);
    const gap = rng.int(0, SIDES - 1);
    const thick = 22;
    if (pick === 0) {
      for (let i = 0; i < SIDES; i++) if (i !== gap) s.walls.push({ side: i, dist: base, thick });
      if (rng.chance(0.5)) s.coins.push({ side: gap, dist: base + 10, taken: false });
    } else if (pick === 1) {
      const off = rng.int(0, 1);
      for (let i = off; i < SIDES; i += 2) s.walls.push({ side: i, dist: base, thick });
      for (let i = 1 - off; i < SIDES; i += 2) s.walls.push({ side: i, dist: base + 140, thick });
    } else if (pick === 2) {
      const dir = rng.chance(0.5) ? 1 : -1;
      for (let k = 0; k < 7; k++)
        s.walls.push({ side: (((gap + k * dir) % SIDES) + SIDES) % SIDES, dist: base + k * 50, thick: 18 });
    } else if (pick === 3) {
      for (let i = 0; i < SIDES; i++)
        if (i !== gap && i !== (gap + 3) % SIDES) s.walls.push({ side: i, dist: base, thick });
      s.coins.push({ side: (gap + 3) % SIDES, dist: base + 10, taken: false });
    } else {
      for (let r = 0; r < 3; r++) {
        const g = (gap + r * 2) % SIDES;
        for (let i = 0; i < SIDES; i++)
          if (i !== g) s.walls.push({ side: i, dist: base + r * 130, thick: 18 });
      }
    }
    const last = s.walls.reduce((m, w) => Math.max(m, w.dist), base);
    s.nextSpawn = last - base + rng.range(160, 230);
  };

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.touch.set(p.id, p.x < W / 2 ? -1 : 1);
  };
  const onUp = (p: StagePointer) => {
    s.touch.delete(p.id);
  };

  const finish = () =>
    api.gameOver({
      score: Math.round(s.t * 1000),
      stats: [
        { label: 'Time', value: `${s.t.toFixed(2)} s` },
        { label: 'Coins', value: String(s.coinCount) },
      ],
    });

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    let dir = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    for (const d of s.touch.values()) dir += d;
    dir = Math.max(-1, Math.min(1, dir));
    if (dir) s.started = true;

    if (s.started && !s.dead) {
      s.t += dt;
      s.invuln = Math.max(0, s.invuln - dt);
      s.angle += dir * turnSpeed * dt * 0.5;
      s.flipT -= dt;
      if (s.flipT <= 0) {
        s.rotSpeed = -Math.sign(s.rotSpeed) * rng.range(0.7, 1.2 + Math.min(1.4, s.t / 40));
        s.flipT = rng.range(4, 8);
      }
      s.rot += s.rotSpeed * dt;
      const sp = speed() * dt;
      for (const w of s.walls) w.dist -= sp;
      for (const c of s.coins) c.dist -= sp;
      s.nextSpawn -= sp;
      if (s.nextSpawn <= 0) pattern();
      s.walls = s.walls.filter((w) => w.dist + w.thick > CORE);
      // the player's side in world space
      const side = Math.floor(norm(s.angle) / SEG) % SIDES;
      if (s.invuln <= 0) {
        for (const w of s.walls) {
          if (w.side === side && w.dist < PLAYER_R + 5 && w.dist + w.thick > PLAYER_R - 5) {
            if (s.shields > 0) {
              s.shields -= 1;
              s.invuln = 1;
              s.walls = s.walls.filter((x) => x.dist > PLAYER_R + 30);
              floaters.add('Hex shield!', CX, CY - 110, light, 18);
              api.sfx('hit');
            } else {
              s.dead = true;
              s.deadT = 0.8;
              shake.add(16);
              const [px, py] = [
                CX + Math.cos(s.angle + s.rot) * PLAYER_R,
                CY + Math.sin(s.angle + s.rot) * PLAYER_R,
              ];
              particles.burst(px, py, { count: 30, colors: [accent, light], speed: 220, life: 0.6 });
              api.sfx('explode');
              api.haptic([70, 30, 70]);
            }
            break;
          }
        }
      }
      for (const c of s.coins) {
        if (!c.taken && c.side === side && Math.abs(c.dist - PLAYER_R) < 14) {
          c.taken = true;
          s.coinCount += 1;
          api.addCoins(1);
          api.sfx('coin');
        }
      }
      s.coins = s.coins.filter((c) => !c.taken && c.dist > CORE);
      const sec = Math.floor(s.t);
      if (sec !== s.lastSecond) {
        s.lastSecond = sec;
        s.pulse = 1;
        if (sec % 10 === 0 && sec > 0) {
          floaters.add(`${sec} s!`, CX, 90, light, 24, 1);
          api.sfx('levelup');
        } else api.sfx('tick');
      }
      api.setScore(Math.round(s.t * 1000));
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(() => {
          s.dead = false;
          s.invuln = 1.5;
          s.walls = s.walls.filter((w) => w.dist > 300);
          s.coins = s.coins.filter((c) => c.dist > 300);
        }, finish);
    }
    s.pulse = Math.max(0, s.pulse - dt * 3);
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    const zoom = 1 + s.pulse * 0.04;
    ctx.translate(CX, CY);
    ctx.scale(zoom, zoom);
    ctx.translate(-CX, -CY);
    // background slices
    for (let i = 0; i < SIDES; i++) {
      const [x1, y1] = hexPoint(i, 900, s.rot);
      const [x2, y2] = hexPoint(i + 1, 900, s.rot);
      ctx.fillStyle = i % 2 ? shade(dark, 0.08) : shade(dark, -0.15);
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.fill();
    }
    // walls
    ctx.fillStyle = accent;
    for (const w of s.walls) {
      const r0 = Math.max(CORE, w.dist);
      const r1 = w.dist + w.thick;
      const [ax, ay] = hexPoint(w.side, r0, s.rot);
      const [bx, by] = hexPoint(w.side + 1, r0, s.rot);
      const [cx, cy] = hexPoint(w.side + 1, r1, s.rot);
      const [dx, dy] = hexPoint(w.side, r1, s.rot);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.lineTo(dx, dy);
      ctx.fill();
    }
    for (const c of s.coins) {
      const a = s.rot + (c.side + 0.5) * SEG;
      drawCoin(ctx, CX + Math.cos(a) * c.dist * 0.87, CY + Math.sin(a) * c.dist * 0.87, 7, s.clock);
    }
    // core
    ctx.fillStyle = accent;
    ctx.beginPath();
    for (let i = 0; i <= SIDES; i++) {
      const [x, y] = hexPoint(i, CORE + s.pulse * 4, s.rot);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    for (let i = 0; i <= SIDES; i++) {
      const [x, y] = hexPoint(i, CORE - 6, s.rot);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.fill();
    // player
    if (!s.dead) {
      const a = s.angle + s.rot;
      const px = CX + Math.cos(a) * PLAYER_R;
      const py = CY + Math.sin(a) * PLAYER_R;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + Math.PI / 2);
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 14) % 2 ? 0.4 : 1;
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(7, 5);
      ctx.lineTo(-7, 5);
      ctx.fill();
      ctx.restore();
      if (s.shields > 0) {
        ctx.strokeStyle = light;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    particles.draw(ctx);
    floaters.draw(ctx);
    text(ctx, `${s.t.toFixed(1)}s`, CX, 40, { size: 30, weight: 900, color: light });
    hudPill(ctx, W - 10, 10, String(s.coinCount), { align: 'right', coin: true, size: 13 });
    if (!s.started) prompt(ctx, 'Hold left / right to spin', CX, H * 0.86, s.clock, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Hex Spin game area"
      onPointerDown={onDown}
      onPointerUp={onUp}
    />
  );
}
