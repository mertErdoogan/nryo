import { useRef } from 'react';
import { CanvasStage, FloatingText, Particles, Shake, useGameLoop, useKeyDown, useSeededRng } from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import type { GameProps } from '../../platform/types';
import { collides, freeCell, nextHead, queueTurn, stepTime, type Cell, type Dir } from './logic';

const COLS = 18;
const ROWS = 26;
const CELL = 20;
const W = COLS * CELL;
const H = ROWS * CELL;

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

export function NeonSnake({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const fx = useRef({ particles: new Particles(300, rng.next), floaters: new FloatingText(), shake: new Shake(rng.next) });
  const start: Cell[] = [
    { x: 8, y: 16 },
    { x: 8, y: 17 },
    { x: 8, y: 18 },
  ];
  const s = useRef({
    body: start,
    prevBody: start,
    dir: 'up' as Dir,
    queue: [] as Dir[],
    food: { x: 8, y: 9 } as Cell,
    bonus: null as null | (Cell & { ttl: number }),
    grow: 0,
    acc: 0,
    started: false,
    dead: false,
    deadTimer: 0,
    ended: false,
    score: 0,
    eaten: 0,
    time: 0,
    swipe: null as null | { x: number; y: number; id: number; used: boolean },
  }).current;

  const turn = (dir: Dir) => {
    if (s.dead) return;
    s.started = true;
    s.queue = queueTurn(s.queue, s.dir, dir);
  };

  useKeyDown((code) => {
    const dir = KEY_DIRS[code];
    if (!dir) {
      if (code === 'Space' && !s.started) s.started = true;
      return false;
    }
    turn(dir);
  }, !paused);

  const onDown = (p: StagePointer) => {
    s.swipe = { x: p.x, y: p.y, id: p.id, used: false };
    if (!s.started) s.started = true;
  };
  const onMove = (p: StagePointer) => {
    const sw = s.swipe;
    if (!sw || sw.id !== p.id || sw.used) return;
    const dx = p.x - sw.x;
    const dy = p.y - sw.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    // Allow chained swipes without lifting the finger.
    s.swipe = { x: p.x, y: p.y, id: p.id, used: false };
  };
  const onUp = () => {
    s.swipe = null;
  };

  const step = () => {
    const { particles, floaters, shake } = fx.current;
    if (s.queue.length) {
      s.dir = s.queue[0]!;
      s.queue = s.queue.slice(1);
    }
    const head = nextHead(s.body[0]!, s.dir);
    if (collides(head, s.body, COLS, ROWS, s.grow > 0)) {
      s.dead = true;
      s.deadTimer = 1;
      shake.add(10);
      for (const c of s.body) particles.burst(c.x * CELL + CELL / 2, c.y * CELL + CELL / 2, { count: 3, colors: ['#34d399', '#a7f3d0'], speed: 120, life: 0.6 });
      api.sfx('hit');
      api.haptic([40, 30, 60]);
      return;
    }
    s.prevBody = s.body;
    s.body = [head, ...s.body];
    if (s.grow > 0) s.grow -= 1;
    else s.body.pop();

    const px = head.x * CELL + CELL / 2;
    const py = head.y * CELL + CELL / 2;
    if (head.x === s.food.x && head.y === s.food.y) {
      s.eaten += 1;
      s.grow += 2;
      s.score += 10;
      floaters.add('+10', px, py - 14, '#6ee7b7', 16, 0.6);
      particles.burst(px, py, { count: 12, colors: ['#f472b6', '#fbcfe8'], speed: 120, life: 0.4 });
      api.sfx('coin');
      s.food = freeCell(COLS, ROWS, s.body, rng) ?? s.food;
      if (s.eaten % 7 === 0 && !s.bonus) {
        const cell = freeCell(COLS, ROWS, [...s.body, s.food], rng);
        if (cell) s.bonus = { ...cell, ttl: 6 };
      }
      api.setScore(s.score);
    } else if (s.bonus && head.x === s.bonus.x && head.y === s.bonus.y) {
      s.score += 50;
      s.grow += 3;
      floaters.add('+50', px, py - 14, '#fde047', 20);
      particles.burst(px, py, { count: 24, colors: ['#fde047', '#fff'], speed: 180, life: 0.6 });
      api.sfx('powerup');
      s.bonus = null;
      api.setScore(s.score);
    }
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;
    if (s.started && !s.dead) {
      s.acc += dt;
      const interval = stepTime(s.body.length);
      while (s.acc >= interval && !s.dead) {
        s.acc -= interval;
        step();
      }
      if (s.bonus) {
        s.bonus.ttl -= dt;
        if (s.bonus.ttl <= 0) s.bonus = null;
      }
    }
    if (s.dead && !s.ended) {
      s.deadTimer -= dt;
      if (s.deadTimer <= 0) {
        s.ended = true;
        api.gameOver({ score: s.score, stats: [{ label: 'Length', value: String(s.body.length) }, { label: 'Orbs', value: String(s.eaten) }] });
      }
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    ctx.fillStyle = '#04110d';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    ctx.fillStyle = 'rgba(52, 211, 153, 0.09)';
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    // food
    const pulse = 1 + Math.sin(s.time * 6) * 0.12;
    ctx.shadowColor = '#f472b6';
    ctx.shadowBlur = 14;
    circle(ctx, s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2, 6.5 * pulse, '#f472b6');
    if (s.bonus) {
      const fade = s.bonus.ttl < 2 ? (Math.sin(s.time * 20) > 0 ? 1 : 0.35) : 1;
      ctx.globalAlpha = fade;
      ctx.shadowColor = '#fde047';
      circle(ctx, s.bonus.x * CELL + CELL / 2, s.bonus.y * CELL + CELL / 2, 8 * pulse, '#fde047');
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;

    // snake — interpolate between steps for smooth motion
    const t = s.started && !s.dead ? Math.min(1, s.acc / stepTime(s.body.length)) : 1;
    const n = s.body.length;
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = s.dead ? 0 : 12;
    for (let i = n - 1; i >= 0; i--) {
      const cur = s.body[i]!;
      const prev = s.prevBody[i] ?? cur;
      const x = (prev.x + (cur.x - prev.x) * t) * CELL;
      const y = (prev.y + (cur.y - prev.y) * t) * CELL;
      const k = 1 - i / Math.max(1, n);
      const color = s.dead ? 'rgba(148,163,184,0.5)' : `hsl(${150 + (1 - k) * 40} 80% ${45 + k * 20}%)`;
      fillRoundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, i === 0 ? 7 : 5, color);
    }
    ctx.shadowBlur = 0;
    if (!s.dead) {
      const head = s.body[0]!;
      const prevHead = s.prevBody[0] ?? head;
      const hx = (prevHead.x + (head.x - prevHead.x) * t) * CELL + CELL / 2;
      const hy = (prevHead.y + (head.y - prevHead.y) * t) * CELL + CELL / 2;
      const ex = s.dir === 'left' ? -3 : s.dir === 'right' ? 3 : 0;
      const ey = s.dir === 'up' ? -3 : s.dir === 'down' ? 3 : 0;
      const side = s.dir === 'up' || s.dir === 'down' ? { x: 4, y: 0 } : { x: 0, y: 4 };
      circle(ctx, hx + ex + side.x, hy + ey + side.y, 2.4, '#022c22');
      circle(ctx, hx + ex - side.x, hy + ey - side.y, 2.4, '#022c22');
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    if (!s.started) {
      text(ctx, 'NEON SNAKE', W / 2, H * 0.3, { size: 30, weight: 850, color: '#6ee7b7' });
      prompt(ctx, 'Swipe or press an arrow key', W / 2, H * 0.62, s.time, 18);
    }
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Neon Snake game board"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
