import { useRef } from 'react';
import {
  CanvasStage,
  ControlBar,
  TouchButton,
  createContinueGate,
  useGameLoop,
  useHeldKeys,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import { angleDiff, TAU } from '../../lib/math';
import type { Rng } from '../../lib/rng';
import type { GameProps } from '../../platform/types';
import { followChain, headHitsBody, radiusFor, resizeChain, segmentsFor, SPACING, type Point } from './logic';

const H = 640;
const WORLD_R = 1300;
const FOOD_TARGET = 650;
const BOTS = 10;
const BOT_NAMES = [
  'NovaFox',
  'Zippy',
  'ByteBandit',
  'LunaLoop',
  'QuasarQ',
  'MangoMax',
  'Glitchy',
  'RookRiley',
  'BlazeBo',
  'Sprocket',
  'KikoKat',
  'VexVolt',
  'OrbitOli',
  'Mochi',
  'JinxJett',
];

interface Snake {
  id: number;
  name: string;
  hue: number;
  body: Point[];
  angle: number;
  target: number;
  mass: number;
  boost: boolean;
  alive: boolean;
  player: boolean;
  think: number;
  kills: number;
  dropTimer: number;
}

interface Food {
  x: number;
  y: number;
  r: number;
  value: number;
  hue: number;
}

function randomPointInWorld(rng: Rng, margin = 120): Point {
  const a = rng.range(0, TAU);
  const d = Math.sqrt(rng.next()) * (WORLD_R - margin);
  return { x: Math.cos(a) * d, y: Math.sin(a) * d };
}

let nextId = 1;
function makeSnake(rng: Rng, at: Point, mass: number, player: boolean, name: string, hue: number): Snake {
  const angle = rng.range(0, TAU);
  const body: Point[] = [];
  for (let i = 0; i < segmentsFor(mass); i++)
    body.push({ x: at.x - Math.cos(angle) * i * SPACING, y: at.y - Math.sin(angle) * i * SPACING });
  return {
    id: nextId++,
    name,
    hue,
    body,
    angle,
    target: angle,
    mass,
    boost: false,
    alive: true,
    player,
    think: 0,
    kills: 0,
    dropTimer: 0,
  };
}

/** Player hue per skin (the rainbow skin cycles). */
const SKIN_HUE: Record<string, number> = {
  violet: 265,
  lime: 95,
  ocean: 200,
  ember: 15,
  rose: 330,
  rainbow: 0,
};

export function SlitherArena({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const myHue = SKIN_HUE[lo.skin.id] ?? 265;
  const startMass = 20 + 10 * lo.level('start');
  const mySpeed = 1 + 0.05 * lo.level('speed');
  const boostCost = 5 * (1 - 0.15 * lo.level('boost'));
  const myReach = 6 + 5 * lo.level('magnet');
  const continueGate = useRef(createContinueGate(api)).current;

  const init = () => {
    const player = makeSnake(rng, { x: 0, y: 0 }, startMass, true, 'You', myHue);
    const bots: Snake[] = [];
    for (let i = 0; i < BOTS; i++) {
      let p = randomPointInWorld(rng, 200);
      while (Math.hypot(p.x, p.y) < 350) p = randomPointInWorld(rng, 200);
      bots.push(
        makeSnake(rng, p, rng.range(15, 140), false, BOT_NAMES[i % BOT_NAMES.length]!, rng.int(0, 360)),
      );
    }
    const food: Food[] = [];
    for (let i = 0; i < FOOD_TARGET; i++) {
      const p = randomPointInWorld(rng, 20);
      food.push({ ...p, r: rng.range(3, 6), value: 1, hue: rng.int(0, 360) });
    }
    return { snakes: [player, ...bots], food };
  };

  const s = useRef({
    ...init(),
    pointer: null as null | { x: number; y: number },
    boostHeld: false,
    started: false,
    dead: false,
    deadTimer: 0,
    ended: false,
    waiting: false,
    invuln: 0,
    time: 0,
    maxMass: startMass,
    respawns: [] as number[],
    cam: { x: 0, y: 0, zoom: 1 },
  }).current;

  const player = () => s.snakes[0]!;

  const onPointer = (p: StagePointer) => {
    s.started = true;
    s.pointer = { x: p.x, y: p.y };
  };

  useKeyDown((code) => {
    if (code === 'Space') {
      s.started = true;
      s.boostHeld = true;
    } else return false;
  }, !paused);

  const kill = (snake: Snake, by: Snake | null) => {
    if (!snake.alive) return;
    snake.alive = false;
    if (by) by.kills += 1;
    if (by?.player) api.addCoins(2);
    // Leave a trail of rich orbs behind.
    const drop = Math.max(8, Math.floor(snake.mass * 0.8));
    for (let i = 0; i < snake.body.length; i += Math.max(1, Math.floor(snake.body.length / drop))) {
      const p = snake.body[i]!;
      s.food.push({
        x: p.x + rng.range(-6, 6),
        y: p.y + rng.range(-6, 6),
        r: rng.range(5, 8),
        value: 2,
        hue: snake.hue,
      });
    }
    if (snake.player) {
      s.dead = true;
      s.deadTimer = 1.2;
      api.sfx('explode');
      api.haptic([80, 40, 120]);
    } else {
      s.respawns.push(2.5);
      if (by?.player) api.sfx('powerup');
    }
  };

  const botThink = (b: Snake) => {
    const head = b.body[0]!;
    const r = radiusFor(b.mass);
    const danger = (angle: number, dist: number) => {
      const px = head.x + Math.cos(angle) * dist;
      const py = head.y + Math.sin(angle) * dist;
      if (Math.hypot(px, py) > WORLD_R - 40) return true;
      for (const o of s.snakes) {
        if (!o.alive || o === b) continue;
        const or = radiusFor(o.mass);
        if (Math.abs(o.body[0]!.x - px) > 400 || Math.abs(o.body[0]!.y - py) > 400) continue;
        for (let i = 0; i < o.body.length; i += 2) {
          const q = o.body[i]!;
          if ((q.x - px) ** 2 + (q.y - py) ** 2 < (or + r + 10) ** 2) return true;
        }
      }
      return false;
    };
    b.boost = false;
    for (const dist of [35, 70, 110]) {
      if (danger(b.angle, dist)) {
        const left = !danger(b.angle - 0.9, dist) ? -0.9 : 0;
        const right = !danger(b.angle + 0.9, dist) ? 0.9 : 0;
        b.target =
          b.angle + (left && right ? (rng.chance(0.5) ? left : right) : left || right || Math.PI * 0.8);
        return;
      }
    }
    const p = player();
    if (p.alive && b.mass > p.mass * 1.2 && rng.chance(0.4)) {
      const ph = p.body[0]!;
      const d = Math.hypot(ph.x - head.x, ph.y - head.y);
      if (d < 320) {
        // Try to cut in front of the player.
        const ahead = { x: ph.x + Math.cos(p.angle) * 120, y: ph.y + Math.sin(p.angle) * 120 };
        b.target = Math.atan2(ahead.y - head.y, ahead.x - head.x);
        b.boost = d < 200 && b.mass > 40;
        return;
      }
    }
    let best: Food | null = null;
    let bestScore = Infinity;
    for (const f of s.food) {
      const dx = f.x - head.x;
      const dy = f.y - head.y;
      if (Math.abs(dx) > 260 || Math.abs(dy) > 260) continue;
      const d = Math.hypot(dx, dy) / f.value;
      if (d < bestScore) {
        bestScore = d;
        best = f;
      }
    }
    if (best) b.target = Math.atan2(best.y - head.y, best.x - head.x);
    else if (rng.chance(0.2)) b.target = b.angle + rng.range(-1, 1);
    if (Math.hypot(head.x, head.y) > WORLD_R - 250) b.target = Math.atan2(-head.y, -head.x);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const W = v.width;
    s.time += dt;
    const me = player();

    // ---- player input
    if (me.alive) {
      if (s.pointer) {
        const zoom = s.cam.zoom;
        const hx = (me.body[0]!.x - s.cam.x) * zoom + W / 2;
        const hy = (me.body[0]!.y - s.cam.y) * zoom + H / 2;
        if (Math.hypot(s.pointer.x - hx, s.pointer.y - hy) > 8)
          me.target = Math.atan2(s.pointer.y - hy, s.pointer.x - hx);
      }
      const k = keys.current;
      const turn =
        (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
      if (turn) {
        s.started = true;
        me.target = me.angle + turn * 0.6;
      }
      if (!k.has('Space') && s.boostHeld && !s.pointer) s.boostHeld = false;
      me.boost = s.boostHeld || k.has('Space');
    }

    if (s.started && !s.ended) {
      for (const sn of s.snakes) {
        if (!sn.alive) continue;
        if (!sn.player) {
          sn.think -= dt;
          if (sn.think <= 0) {
            sn.think = rng.range(0.12, 0.25);
            botThink(sn);
          }
        }
        const canBoost = sn.boost && sn.mass > 12;
        const speed = (canBoost ? 255 : 140) * (sn.player ? mySpeed : 1);
        const turnRate = (canBoost ? 2.4 : 3.4) / (1 + sn.mass / 600);
        const diff = angleDiff(sn.angle, sn.target);
        sn.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
        const head = sn.body[0]!;
        head.x += Math.cos(sn.angle) * speed * dt;
        head.y += Math.sin(sn.angle) * speed * dt;
        if (canBoost) {
          sn.mass -= (sn.player ? boostCost : 5) * dt;
          sn.dropTimer -= dt;
          if (sn.dropTimer <= 0) {
            sn.dropTimer = 0.18;
            const tail = sn.body[sn.body.length - 1]!;
            s.food.push({ x: tail.x, y: tail.y, r: 4, value: 1, hue: sn.hue });
          }
        }
        followChain(sn.body, SPACING);
        resizeChain(sn.body, segmentsFor(sn.mass));
        if (Math.hypot(head.x, head.y) > WORLD_R) kill(sn, null);
      }

      // ---- eating (only nearby food per snake)
      for (const sn of s.snakes) {
        if (!sn.alive) continue;
        const head = sn.body[0]!;
        const r = radiusFor(sn.mass) + (sn.player ? myReach : 6);
        for (let i = s.food.length - 1; i >= 0; i--) {
          const f = s.food[i]!;
          const dx = f.x - head.x;
          const dy = f.y - head.y;
          if (Math.abs(dx) > 40 || Math.abs(dy) > 40) continue;
          if (dx * dx + dy * dy < (r + f.r) ** 2) {
            sn.mass += f.value;
            s.food[i] = s.food[s.food.length - 1]!;
            s.food.pop();
            if (sn.player && rng.chance(0.3)) api.sfx('tick');
          }
        }
      }

      // ---- collisions
      s.invuln = Math.max(0, s.invuln - dt);
      for (const a of s.snakes) {
        if (!a.alive || (a.player && s.invuln > 0)) continue;
        const head = a.body[0]!;
        const ra = radiusFor(a.mass);
        for (const b of s.snakes) {
          if (b === a || !b.alive) continue;
          const bh = b.body[0]!;
          const reach = b.body.length * SPACING + 60;
          if (Math.abs(bh.x - head.x) > reach || Math.abs(bh.y - head.y) > reach) continue;
          if (headHitsBody(head, ra, b.body, radiusFor(b.mass), 2)) {
            kill(a, b);
            break;
          }
        }
      }

      while (s.food.length < FOOD_TARGET) {
        const p = randomPointInWorld(rng, 20);
        s.food.push({ ...p, r: rng.range(3, 6), value: 1, hue: rng.int(0, 360) });
      }
      for (let i = s.respawns.length - 1; i >= 0; i--) {
        s.respawns[i]! -= dt;
        if (s.respawns[i]! <= 0) {
          s.respawns.splice(i, 1);
          const deadIndex = s.snakes.findIndex((sn) => !sn.alive && !sn.player);
          if (deadIndex >= 0) {
            let p = randomPointInWorld(rng, 200);
            const ph = me.body[0]!;
            while (Math.hypot(p.x - ph.x, p.y - ph.y) < 500) p = randomPointInWorld(rng, 200);
            const old = s.snakes[deadIndex]!;
            s.snakes[deadIndex] = makeSnake(
              rng,
              p,
              rng.range(15, 60 + s.time * 1.5),
              false,
              rng.pick(BOT_NAMES),
              old.hue,
            );
          }
        }
      }
      if (me.alive) {
        s.maxMass = Math.max(s.maxMass, me.mass);
        api.setScore(Math.floor(me.mass));
      }
    }

    if (s.dead && !s.ended && !s.waiting) {
      s.deadTimer -= dt;
      if (s.deadTimer <= 0) {
        s.waiting = true;
        continueGate(
          () => {
            // Respawn somewhere quiet with most of your length.
            let p = randomPointInWorld(rng, 300);
            for (let i = 0; i < 30; i++) {
              const busy = s.snakes.some(
                (sn) => sn.alive && Math.hypot(sn.body[0]!.x - p.x, sn.body[0]!.y - p.y) < 400,
              );
              if (!busy) break;
              p = randomPointInWorld(rng, 300);
            }
            const again = makeSnake(rng, p, Math.max(startMass, me.mass * 0.7), true, 'You', myHue);
            again.kills = me.kills;
            s.snakes[0] = again;
            s.invuln = 3;
            s.dead = false;
            s.waiting = false;
          },
          () => {
            s.ended = true;
            api.gameOver({
              score: Math.floor(s.maxMass),
              stats: [
                { label: 'Final length', value: String(Math.floor(me.mass)) },
                { label: 'Rivals trapped', value: String(me.kills) },
                { label: 'Survived', value: `${Math.floor(s.time)}s` },
              ],
            });
          },
        );
      }
    }

    // ---- camera
    const head = me.body[0]!;
    const targetZoom = Math.max(0.55, 1 - Math.min(0.45, me.mass / 1600));
    s.cam.zoom += (targetZoom - s.cam.zoom) * Math.min(1, dt * 2);
    s.cam.x += (head.x - s.cam.x) * Math.min(1, dt * 8);
    s.cam.y += (head.y - s.cam.y) * Math.min(1, dt * 8);

    // ---- render
    const ctx = v.ctx;
    ctx.fillStyle = '#05050d';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(s.cam.zoom, s.cam.zoom);
    ctx.translate(-s.cam.x, -s.cam.y);
    const halfW = W / 2 / s.cam.zoom + 40;
    const halfH = H / 2 / s.cam.zoom + 40;
    // arena floor + hex-ish grid
    ctx.fillStyle = '#10101f';
    ctx.beginPath();
    ctx.arc(0, 0, WORLD_R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(192,132,252,0.06)';
    ctx.lineWidth = 2;
    const g0x = Math.floor((s.cam.x - halfW) / 60) * 60;
    const g0y = Math.floor((s.cam.y - halfH) / 60) * 60;
    for (let x = g0x; x < s.cam.x + halfW; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, s.cam.y - halfH);
      ctx.lineTo(x, s.cam.y + halfH);
      ctx.stroke();
    }
    for (let y = g0y; y < s.cam.y + halfH; y += 60) {
      ctx.beginPath();
      ctx.moveTo(s.cam.x - halfW, y);
      ctx.lineTo(s.cam.x + halfW, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, WORLD_R, 0, TAU);
    ctx.stroke();

    for (const f of s.food) {
      if (Math.abs(f.x - s.cam.x) > halfW || Math.abs(f.y - s.cam.y) > halfH) continue;
      const pulse = 1 + Math.sin(s.time * 4 + f.x) * 0.15;
      circle(ctx, f.x, f.y, f.r * pulse * 1.8, `hsl(${f.hue} 90% 60% / 0.18)`);
      circle(ctx, f.x, f.y, f.r * pulse, `hsl(${f.hue} 90% 65%)`);
    }
    for (const sn of s.snakes) {
      if (!sn.alive) continue;
      const r = radiusFor(sn.mass);
      const hx = sn.body[0]!;
      if (
        Math.abs(hx.x - s.cam.x) > halfW + sn.body.length * SPACING ||
        Math.abs(hx.y - s.cam.y) > halfH + sn.body.length * SPACING
      )
        continue;
      // Body as one thick stroke (fast), with lighter stripes every few segments.
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = r * 2;
      if (sn.player && lo.skin.id === 'rainbow') sn.hue = (s.time * 60) % 360;
      ctx.globalAlpha = sn.player && s.invuln > 0 && Math.floor(s.time * 8) % 2 === 0 ? 0.45 : 1;
      ctx.strokeStyle = `hsl(${sn.hue} 85% 50%)`;
      ctx.beginPath();
      ctx.moveTo(sn.body[sn.body.length - 1]!.x, sn.body[sn.body.length - 1]!.y);
      for (let i = sn.body.length - 2; i >= 0; i--) ctx.lineTo(sn.body[i]!.x, sn.body[i]!.y);
      ctx.stroke();
      for (let i = sn.body.length - 1; i > 0; i -= 5) {
        const p = sn.body[i]!;
        circle(ctx, p.x, p.y, r * 0.8, `hsl(${sn.hue} 85% 60%)`);
      }
      circle(ctx, hx.x, hx.y, r, `hsl(${sn.hue} 85% 60%)`);
      if (sn.boost && sn.mass > 12) {
        ctx.strokeStyle = `hsl(${sn.hue} 100% 75% / 0.6)`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(hx.x, hx.y, r + 4, 0, TAU);
        ctx.stroke();
      }
      const ex = Math.cos(sn.angle);
      const ey = Math.sin(sn.angle);
      for (const side of [-1, 1]) {
        const ox = hx.x + ex * r * 0.35 - ey * side * r * 0.45;
        const oy = hx.y + ey * r * 0.35 + ex * side * r * 0.45;
        circle(ctx, ox, oy, r * 0.32, '#fff');
        circle(ctx, ox + ex * r * 0.1, oy + ey * r * 0.1, r * 0.16, '#111');
      }
      ctx.globalAlpha = 1;
      if (!sn.player)
        text(ctx, sn.name, hx.x, hx.y - r - 12, { size: 11, weight: 700, color: 'rgba(255,255,255,0.55)' });
    }
    ctx.restore();

    // ---- HUD: leaderboard + minimap
    const ranked = s.snakes.filter((sn) => sn.alive).sort((a, b) => b.mass - a.mass);
    fillRoundRect(ctx, W - 150, 10, 140, 26 + Math.min(5, ranked.length) * 18, 12, 'rgba(0,0,0,0.5)');
    text(ctx, 'Leaderboard', W - 80, 24, { size: 11, weight: 700, color: '#c4b5fd' });
    ranked.slice(0, 5).forEach((sn, i) => {
      const y = 44 + i * 18;
      text(ctx, `${i + 1}. ${sn.player ? 'You' : `${sn.name} · bot`}`, W - 142, y, {
        size: 11,
        align: 'left',
        weight: sn.player ? 800 : 500,
        color: sn.player ? '#fde047' : '#e2e8f0',
      });
      text(ctx, String(Math.floor(sn.mass)), W - 16, y, { size: 11, align: 'right', weight: 700 });
    });
    const myRank = ranked.findIndex((sn) => sn.player) + 1;
    if (me.alive)
      text(ctx, `Rank ${myRank}/${ranked.length} · Length ${Math.floor(me.mass)}`, 12, 22, {
        size: 13,
        align: 'left',
        weight: 700,
      });
    const mmR = 42;
    ctx.save();
    ctx.translate(12 + mmR, H - 12 - mmR - (W < 700 ? 70 : 0));
    circle(ctx, 0, 0, mmR, 'rgba(0,0,0,0.45)');
    ctx.strokeStyle = 'rgba(239,68,68,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, mmR, 0, TAU);
    ctx.stroke();
    for (const sn of s.snakes) {
      if (!sn.alive) continue;
      const p = sn.body[0]!;
      circle(
        ctx,
        (p.x / WORLD_R) * mmR,
        (p.y / WORLD_R) * mmR,
        sn.player ? 3.5 : 2,
        sn.player ? '#fde047' : `hsl(${sn.hue} 80% 60%)`,
      );
    }
    ctx.restore();
    if (!s.started) prompt(ctx, 'Move your finger or mouse to steer', W / 2, H * 0.72, s.time, 17);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={360}
      height={H}
      fit="fill"
      minAspect={0.5}
      maxAspect={1.9}
      label="Slither Arena"
      onPointerDown={(p) => {
        onPointer(p);
        if (p.type === 'mouse') s.boostHeld = true;
      }}
      onPointerMove={onPointer}
      onPointerUp={(p) => {
        if (p.type === 'mouse') s.boostHeld = false;
      }}
    >
      <ControlBar
        right={
          <TouchButton
            label="Boost"
            onPress={() => (s.boostHeld = true)}
            onRelease={() => (s.boostHeld = false)}
          >
            ⚡
          </TouchButton>
        }
      />
    </CanvasStage>
  );
}
