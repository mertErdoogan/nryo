import { useEffect, useRef } from 'react';
import { CanvasStage, FloatingText, Particles, useGameLoop, useSeededRng } from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import { arr, num, obj, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import { COURSE, HOLES, scoreName, TOTAL_PAR, type HoleDef, type Mover } from './holes';
import { applyFriction, BALL_R, bounceCircle, bounceRect, checkCup, CUP_R, inRect, MAX_SPEED, type BallState } from './physics';

const W = 360;
const H = 600;
const MAX_STROKES = 8;

const saveSchema = obj({ hole: num({ int: true, min: 0, max: HOLES.length - 1 }), cards: arr(num({ int: true, min: 1, max: 20 }), { max: HOLES.length }) });
type Save = Infer<typeof saveSchema>;
export const saveSpec: VersionedSpec<Save> = { version: 1, is: saveSchema.is };

const moverVelocity = (m: Mover & { dir: number }) => (m.axis === 'x' ? { x: m.speed * m.dir, y: 0 } : { x: 0, y: m.speed * m.dir });

export function MiniGolf({ api, paused }: GameProps<Save>) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const fx = useRef({ particles: new Particles(300, rng.next), floaters: new FloatingText() });

  const loadHole = (index: number) => {
    const def = HOLES[index]!;
    return {
      def,
      ball: { x: def.tee[0], y: def.tee[1], vx: 0, vy: 0 } as BallState,
      last: { x: def.tee[0], y: def.tee[1] },
      movers: (def.movers ?? []).map((m) => ({ ...m, dir: 1 })),
      strokes: 0,
    };
  };

  const s = useRef({
    hole: api.resume?.hole ?? 0,
    cards: api.resume?.cards ?? ([] as number[]),
    ...loadHole(api.resume?.hole ?? 0),
    drag: null as null | { x0: number; y0: number; x: number; y: number },
    moving: false,
    sinking: 0,
    transition: 0,
    done: false,
    time: 0,
  }).current;

  const total = () => s.cards.reduce((a, b) => a + b, 0);

  useEffect(() => {
    api.setScore(total());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = () =>
    api.save(
      { hole: s.hole, cards: s.cards },
      { label: `Hole ${s.hole + 1} of ${HOLES.length} · ${total()} strokes`, progress: s.hole / HOLES.length },
    );

  const finishHole = (strokes: number) => {
    const def = s.def;
    s.cards = [...s.cards, strokes];
    api.setScore(total());
    fx.current.floaters.add(scoreName(strokes, def.par), W / 2, H / 2 - 20, strokes <= def.par ? '#fde047' : '#fff', 30, 1.4);
    api.sfx(strokes < def.par ? 'win' : strokes === def.par ? 'score' : 'tap');
    s.transition = 1.4;
  };

  const onDown = (p: StagePointer) => {
    if (s.moving || s.sinking > 0 || s.transition > 0 || s.done) return;
    s.drag = { x0: p.x, y0: p.y, x: p.x, y: p.y };
  };
  const onMove = (p: StagePointer) => {
    if (!s.drag) return;
    s.drag.x = p.x;
    s.drag.y = p.y;
  };
  const shotVector = () => {
    const d = s.drag!;
    const dx = d.x0 - d.x;
    const dy = d.y0 - d.y;
    const len = Math.hypot(dx, dy);
    const power = Math.min(1, len / 150);
    return { ux: len ? dx / len : 0, uy: len ? dy / len : 0, power };
  };
  const onUp = () => {
    const d = s.drag;
    if (!d) return;
    const { ux, uy, power } = shotVector();
    s.drag = null;
    if (power < 0.05) return;
    s.last = { x: s.ball.x, y: s.ball.y };
    s.ball.vx = ux * power * MAX_SPEED;
    s.ball.vy = uy * power * MAX_SPEED;
    s.moving = true;
    s.strokes += 1;
    api.sfx('tap');
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters } = fx.current;
    s.time += dt;
    const def: HoleDef = s.def;

    for (const m of s.movers) {
      const vel = moverVelocity(m);
      if (m.axis === 'x') {
        m.x += vel.x * dt;
        if (m.x < m.min || m.x > m.max) m.dir *= -1;
        m.x = Math.max(m.min, Math.min(m.max, m.x));
      } else {
        m.y += vel.y * dt;
        if (m.y < m.min || m.y > m.max) m.dir *= -1;
      }
    }

    // A resting ball gets shoved by moving blockers (not a stroke).
    if (!s.moving && s.sinking <= 0 && s.transition <= 0) {
      for (const m of s.movers) {
        const mv = moverVelocity(m);
        if (bounceRect(s.ball, m, 0.9, mv.x, mv.y)) s.moving = true;
      }
    }
    if (s.moving) {
      const b = s.ball;
      const steps = 4;
      const sdt = dt / steps;
      for (let i = 0; i < steps && s.moving; i++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        const inner = COURSE;
        const border = [
          { x: inner.x - 40, y: inner.y - 40, w: inner.w + 80, h: 40 },
          { x: inner.x - 40, y: inner.y + inner.h, w: inner.w + 80, h: 40 },
          { x: inner.x - 40, y: inner.y, w: 40, h: inner.h },
          { x: inner.x + inner.w, y: inner.y, w: 40, h: inner.h },
        ];
        let hit = false;
        for (const r of [...border, ...def.walls]) hit = bounceRect(b, r) || hit;
        for (const m of s.movers) {
          const mv = moverVelocity(m);
          hit = bounceRect(b, m, 0.9, mv.x, mv.y) || hit;
        }
        for (const bump of def.bumpers ?? []) {
          if (bounceCircle(b, bump.x, bump.y, bump.r)) {
            api.sfx('coin');
            particles.burst(b.x, b.y, { count: 6, color: '#fde047', speed: 120, life: 0.3 });
          }
        }
        if (hit) api.sfx('tick');
        const sand = (def.sand ?? []).some((r) => inRect(b.x, b.y, r));
        applyFriction(b, sdt, sand);
        if ((def.water ?? []).some((r) => inRect(b.x, b.y, r))) {
          particles.burst(b.x, b.y, { count: 20, colors: ['#38bdf8', '#e0f2fe'], speed: 140, life: 0.5 });
          floaters.add('Splash! +1', b.x, b.y - 20, '#7dd3fc', 18);
          api.sfx('miss');
          s.strokes += 1;
          s.ball = { x: s.last.x, y: s.last.y, vx: 0, vy: 0 };
          s.moving = false;
          break;
        }
        const cup = checkCup(b, def.cup[0], def.cup[1]);
        if (cup === 'in') {
          s.moving = false;
          s.sinking = 0.45;
          b.vx = 0;
          b.vy = 0;
          particles.burst(def.cup[0], def.cup[1], { count: 24, colors: ['#fde047', '#fff', '#86efac'], speed: 160, life: 0.6 });
          break;
        } else if (cup === 'lip') {
          b.vx *= 0.8;
          b.vy *= 0.8;
        }
        if (Math.hypot(b.vx, b.vy) < 4) {
          b.vx = 0;
          b.vy = 0;
          s.moving = false;
          if (s.strokes >= MAX_STROKES) {
            floaters.add('Max strokes — picked up', W / 2, H / 2, '#fff', 18, 1.2);
            finishHole(MAX_STROKES);
          }
        }
      }
    }
    if (s.sinking > 0) {
      s.sinking -= dt;
      s.ball.x += (def.cup[0] - s.ball.x) * Math.min(1, dt * 10);
      s.ball.y += (def.cup[1] - s.ball.y) * Math.min(1, dt * 10);
      if (s.sinking <= 0) finishHole(s.strokes);
    }
    if (s.transition > 0) {
      s.transition -= dt;
      if (s.transition <= 0) {
        if (s.hole + 1 >= HOLES.length) {
          if (!s.done) {
            s.done = true;
            const strokes = total();
            api.gameOver({
              score: strokes,
              won: strokes <= TOTAL_PAR,
              stats: [
                { label: 'Par', value: String(TOTAL_PAR) },
                { label: 'Result', value: strokes === TOTAL_PAR ? 'Even' : strokes < TOTAL_PAR ? `${strokes - TOTAL_PAR}` : `+${strokes - TOTAL_PAR}` },
                { label: 'Holes in one', value: String(s.cards.filter((c) => c === 1).length) },
              ],
            });
          }
        } else {
          s.hole += 1;
          Object.assign(s, loadHole(s.hole));
          persist();
        }
      }
    }
    particles.update(dt);
    floaters.update(dt);

    // ---- render
    const ctx = v.ctx;
    ctx.fillStyle = '#052e16';
    ctx.fillRect(0, 0, W, H);
    fillRoundRect(ctx, COURSE.x - 10, COURSE.y - 10, COURSE.w + 20, COURSE.h + 20, 16, '#78350f');
    fillRoundRect(ctx, COURSE.x, COURSE.y, COURSE.w, COURSE.h, 8, '#16a34a');
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = COURSE.y; y < COURSE.y + COURSE.h; y += 40) ctx.fillRect(COURSE.x, y, COURSE.w, 20);
    for (const r of def.sand ?? []) fillRoundRect(ctx, r.x, r.y, r.w, r.h, 18, '#fde68a');
    for (const r of def.water ?? []) {
      fillRoundRect(ctx, r.x, r.y, r.w, r.h, 10, '#0ea5e9');
      ctx.strokeStyle = 'rgba(224,242,254,0.5)';
      ctx.lineWidth = 2;
      for (let x = r.x + 8; x < r.x + r.w - 12; x += 24) {
        const y = r.y + r.h / 2 + Math.sin(s.time * 3 + x * 0.1) * 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 6, y - 4, x + 12, y);
        ctx.stroke();
      }
    }
    for (const r of def.walls) fillRoundRect(ctx, r.x, r.y, r.w, r.h, 4, '#92400e');
    for (const m of s.movers) fillRoundRect(ctx, m.x, m.y, m.w, m.h, 6, '#f43f5e');
    for (const b of def.bumpers ?? []) {
      circle(ctx, b.x, b.y, b.r, '#fbbf24');
      circle(ctx, b.x, b.y, b.r * 0.6, '#f59e0b');
    }
    // cup + flag
    circle(ctx, def.cup[0], def.cup[1], CUP_R + 2, '#14532d');
    circle(ctx, def.cup[0], def.cup[1], CUP_R, '#020617');
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(def.cup[0] - 1, def.cup[1] - 44, 2, 44);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(def.cup[0] + 1, def.cup[1] - 44);
    ctx.lineTo(def.cup[0] + 22 + Math.sin(s.time * 4) * 2, def.cup[1] - 37);
    ctx.lineTo(def.cup[0] + 1, def.cup[1] - 30);
    ctx.fill();
    // aim
    if (s.drag) {
      const { ux, uy, power } = shotVector();
      const len = 30 + power * 110;
      ctx.strokeStyle = `hsl(${120 - power * 120} 90% 60%)`;
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(s.ball.x, s.ball.y);
      ctx.lineTo(s.ball.x + ux * len, s.ball.y + uy * len);
      ctx.stroke();
      ctx.setLineDash([]);
      fillRoundRect(ctx, W - 34, 110, 14, 200, 7, 'rgba(0,0,0,0.4)');
      fillRoundRect(ctx, W - 34, 110 + 200 * (1 - power), 14, 200 * power, 7, `hsl(${120 - power * 120} 90% 55%)`);
    }
    // ball
    const scale = s.sinking > 0 ? Math.max(0.2, s.sinking / 0.45) : 1;
    if (s.transition <= 0 || s.sinking > 0) {
      circle(ctx, s.ball.x + 2, s.ball.y + 3, BALL_R * scale, 'rgba(0,0,0,0.3)');
      circle(ctx, s.ball.x, s.ball.y, BALL_R * scale, '#f8fafc');
      circle(ctx, s.ball.x - 2, s.ball.y - 2, 2.5 * scale, '#fff');
    }
    particles.draw(ctx);
    floaters.draw(ctx);

    // header
    text(ctx, `Hole ${s.hole + 1}/${HOLES.length} · ${def.name}`, 20, 22, { size: 15, weight: 800, align: 'left' });
    text(ctx, `Par ${def.par} · Strokes ${s.strokes}`, 20, 44, { size: 13, align: 'left', color: '#bbf7d0' });
    text(ctx, `Total ${total() + s.strokes}`, W - 20, 22, { size: 15, weight: 800, align: 'right' });
    const diff = total() - s.cards.reduce((a, _c, i) => a + HOLES[i]!.par, 0);
    text(ctx, diff === 0 ? 'Even' : diff > 0 ? `+${diff}` : String(diff), W - 20, 44, { size: 13, align: 'right', color: diff <= 0 ? '#86efac' : '#fca5a5' });
    if (s.hole === 0 && s.strokes === 0 && !s.drag) prompt(ctx, 'Drag back, then release to putt', W / 2, H - 8 - 12, s.time, 15);
  }, !paused);

  return <CanvasStage ref={view} width={W} height={H} label="Mini Golf course" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />;
}
