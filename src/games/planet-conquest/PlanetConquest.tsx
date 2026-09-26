import { useRef } from 'react';
import { CanvasStage, FloatingText, makeStars, Particles, useGameLoop, useSeededRng } from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, prompt, text } from '../../engine/draw';
import { createRng } from '../../lib/rng';
import { num, obj, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import { aiOrders, FLEET_SPEED, generateMap, land, production, type Fleet, type Planet } from './logic';

const W = 360;
const H = 640;
const COLORS = ['#64748b', '#3b82f6', '#ef4444', '#22c55e'];
const LIGHT = ['#94a3b8', '#93c5fd', '#fca5a5', '#86efac'];

const progressSchema = obj({ level: num({ int: true, min: 1, max: 999 }) });
type Progress = Infer<typeof progressSchema>;
export const progressSpec: VersionedSpec<Progress> = { version: 1, is: progressSchema.is };

export function PlanetConquest({ api, paused }: GameProps<unknown, Progress>) {
  const rng = useSeededRng(api.seed);
  const level = api.mode === 'daily' ? 3 : (api.progress?.level ?? 1);
  const view = useRef<CanvasView | null>(null);
  const fx = useRef({ particles: new Particles(400, rng.next), floaters: new FloatingText() });
  const s = useRef({
    planets: generateMap(rng, level, W, H),
    fleets: [] as Fleet[],
    drag: null as null | { from: number; x: number; y: number },
    aiTimers: [0, 0, 2.5, 3.5],
    t: 0,
    over: false,
    captured: 0,
    time: 0,
    started: false,
  }).current;
  const aggression = Math.min(1, 0.35 + level * 0.12);
  const aiInterval = Math.max(0.9, 2.3 - level * 0.18);

  const planetAt = (x: number, y: number) => s.planets.find((p) => Math.hypot(p.x - x, p.y - y) < p.r + 14) ?? null;

  const send = (from: Planet, to: Planet, owner: number) => {
    const ships = Math.floor(from.ships / 2);
    if (ships < 1 || from.id === to.id) return;
    from.ships -= ships;
    s.fleets.push({ from: from.id, to: to.id, owner, ships, x: from.x, y: from.y });
    if (owner === 1) api.sfx('swap');
  };

  const onDown = (p: StagePointer) => {
    const planet = planetAt(p.x, p.y);
    if (planet && planet.owner === 1) {
      s.drag = { from: planet.id, x: p.x, y: p.y };
      s.started = true;
    }
  };
  const onMove = (p: StagePointer) => {
    if (s.drag) {
      s.drag.x = p.x;
      s.drag.y = p.y;
    }
  };
  const onUp = (p: StagePointer) => {
    const d = s.drag;
    s.drag = null;
    if (!d || s.over) return;
    const target = planetAt(p.x, p.y);
    const from = s.planets[d.from]!;
    if (target && target.id !== from.id && from.owner === 1) send(from, target, 1);
  };

  const end = (won: boolean) => {
    if (s.over) return;
    s.over = true;
    const score = won ? Math.round(1000 + level * 200 + Math.max(0, 180 - s.t) * 5) : s.captured * 50;
    api.setScore(score);
    if (won && api.mode === 'normal') api.saveProgress({ level: level + 1 });
    api.sfx(won ? 'win' : 'gameover');
    fx.current.floaters.add(won ? 'GALAXY CONQUERED' : 'DEFEATED', W / 2, H / 2, won ? '#93c5fd' : '#fca5a5', 28, 2);
    setTimeout(
      () =>
        api.gameOver({
          score,
          won,
          stats: [
            { label: 'Sector', value: String(level) },
            { label: 'Planets captured', value: String(s.captured) },
            { label: 'Time', value: `${Math.floor(s.t)}s` },
          ],
        }),
      1200,
    );
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters } = fx.current;
    s.time += dt;
    if (!s.over) {
      s.t += dt;
      for (const p of s.planets) p.ships += production(p) * dt;
      // AI turns
      for (let owner = 2; owner <= 3; owner++) {
        if (!s.planets.some((p) => p.owner === owner)) continue;
        s.aiTimers[owner]! -= dt;
        if (s.aiTimers[owner]! <= 0) {
          s.aiTimers[owner] = aiInterval * rng.range(0.8, 1.2);
          const orders = aiOrders(s.planets, s.fleets, owner, aggression);
          for (const o of orders.slice(0, 1 + Math.floor(level / 3))) send(s.planets[o.from]!, s.planets[o.to]!, owner);
        }
      }
      for (const f of s.fleets) {
        const target = s.planets[f.to]!;
        const dx = target.x - f.x;
        const dy = target.y - f.y;
        const d = Math.hypot(dx, dy);
        if (d < target.r) {
          const before = target.owner;
          if (land(f, target)) {
            particles.burst(target.x, target.y, { count: 20, colors: [COLORS[f.owner]!, '#fff'], speed: 140, life: 0.5 });
            if (f.owner === 1) {
              s.captured += 1;
              floaters.add('Captured!', target.x, target.y - target.r - 10, '#93c5fd', 14);
              api.sfx('score');
            } else if (before === 1) {
              floaters.add('Lost!', target.x, target.y - target.r - 10, '#fca5a5', 14);
              api.sfx('miss');
              api.haptic(40);
            }
          } else if (f.owner !== target.owner && rng.chance(0.3)) api.sfx('tick');
          f.ships = -1;
        } else {
          f.x += (dx / d) * FLEET_SPEED * dt;
          f.y += (dy / d) * FLEET_SPEED * dt;
        }
      }
      s.fleets = s.fleets.filter((f) => f.ships > 0);
      const alive = (owner: number) => s.planets.some((p) => p.owner === owner) || s.fleets.some((f) => f.owner === owner);
      if (!alive(1)) end(false);
      else if (![2, 3].some(alive)) end(true);
      if (!s.over) api.setScore(s.captured * 50);
    }
    particles.update(dt);
    floaters.update(dt);

    // ---- render
    const ctx = v.ctx;
    ctx.fillStyle = '#05051a';
    ctx.fillRect(0, 0, W, H);
    for (const st of STARS) {
      ctx.globalAlpha = st.alpha * (0.7 + Math.sin(s.time * st.speed * 3 + st.x) * 0.3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(st.x, st.y, st.r, st.r);
    }
    ctx.globalAlpha = 1;
    if (s.drag) {
      const from = s.planets[s.drag.from]!;
      const hover = planetAt(s.drag.x, s.drag.y);
      ctx.strokeStyle = 'rgba(147,197,253,0.8)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(hover ? hover.x : s.drag.x, hover ? hover.y : s.drag.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (hover && hover.id !== from.id) {
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.arc(hover.x, hover.y, hover.r + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (const p of s.planets) {
      circle(ctx, p.x, p.y, p.r + 6, `${COLORS[p.owner]}22`);
      const g = ctx.createRadialGradient(p.x - p.r * 0.4, p.y - p.r * 0.4, p.r * 0.1, p.x, p.y, p.r);
      g.addColorStop(0, LIGHT[p.owner]!);
      g.addColorStop(1, COLORS[p.owner]!);
      circle(ctx, p.x, p.y, p.r, g);
      if (p.owner === 1 && s.drag?.from === p.id) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      text(ctx, String(Math.floor(p.ships)), p.x, p.y + 1, { size: Math.max(11, p.r * 0.6), weight: 850, stroke: 'rgba(0,0,0,0.5)', strokeWidth: 3 });
    }
    for (const f of s.fleets) {
      const target = s.planets[f.to]!;
      const a = Math.atan2(target.y - f.y, target.x - f.x);
      const n = Math.min(6, 1 + Math.floor(f.ships / 6));
      for (let i = 0; i < n; i++) {
        const ox = Math.cos(a + Math.PI / 2) * ((i % 3) - 1) * 6 - Math.cos(a) * Math.floor(i / 3) * 8;
        const oy = Math.sin(a + Math.PI / 2) * ((i % 3) - 1) * 6 - Math.sin(a) * Math.floor(i / 3) * 8;
        ctx.save();
        ctx.translate(f.x + ox, f.y + oy);
        ctx.rotate(a);
        ctx.fillStyle = LIGHT[f.owner]!;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -3.5);
        ctx.lineTo(-4, 3.5);
        ctx.fill();
        ctx.restore();
      }
      text(ctx, String(f.ships), f.x, f.y - 12, { size: 10, weight: 700, color: LIGHT[f.owner] });
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    const count = (o: number) => s.planets.filter((p) => p.owner === o).length;
    text(ctx, `Sector ${level}`, 12, 20, { size: 13, weight: 800, align: 'left', color: '#c7d2fe' });
    text(ctx, `🔵 ${count(1)}   🔴 ${count(2)}${level >= 3 ? `   🟢 ${count(3)}` : ''}`, W - 12, 20, { size: 13, weight: 700, align: 'right' });
    if (!s.started) prompt(ctx, 'Drag from your blue planet to attack', W / 2, H - 22, s.time, 15);
  }, !paused);

  return <CanvasStage ref={view} width={W} height={H} label="Planet Conquest galaxy" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />;
}

const STARS = makeStars(createRng(7), 80, W, H);
