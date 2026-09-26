import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  createContinueGate,
  fillRoundRect,
  hudPill,
  prompt,
  shade,
  text,
  useGameLoop,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import type { GameProps } from '../../platform/types';
import { N, NONE, capture, claimSquare, clearOwner, count, idx, inside } from './logic';

const W = 360;
const H = 640;
const CELL = 26;
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;
const BOTS = [
  { name: 'Painty (bot)', color: '#f43f5e' },
  { name: 'Brushy (bot)', color: '#f59e0b' },
  { name: 'Splat (bot)', color: '#a855f7' },
];

interface Painter {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  dir: number;
  queued: number | null;
  t: number;
  speed: number;
  trail: number[];
  alive: boolean;
  respawn: number;
  bot: boolean;
  plan: { dir: number; steps: number }[];
}

export function ColorLand({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const [myColor] = lo.skin.colors;
  const fx = useRef({ particles: new Particles(300, rng.next), floaters: new FloatingText() });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef(
    (() => {
      const owner = new Int8Array(N * N).fill(NONE);
      const trailGrid = new Int8Array(N * N).fill(NONE);
      const painters: Painter[] = [];
      const make = (
        id: number,
        name: string,
        color: string,
        bot: boolean,
        cx: number,
        cy: number,
        half: number,
      ): Painter => {
        claimSquare(owner, id, cx, cy, half);
        return {
          id,
          name,
          color,
          x: cx,
          y: cy,
          dir: rng.int(0, 3),
          queued: null,
          t: 0,
          speed: bot ? 4.6 : 5 * (1 + 0.06 * lo.level('speed')),
          trail: [],
          alive: true,
          respawn: 0,
          bot,
          plan: [],
        };
      };
      painters.push(make(0, 'You', myColor, false, N / 2, N / 2, 1 + lo.level('land')));
      const spots = [
        [8, 8],
        [N - 9, 10],
        [10, N - 9],
      ];
      BOTS.forEach((b, i) =>
        painters.push(make(i + 1, b.name, b.color, true, spots[i]![0]!, spots[i]![1]!, 1)),
      );
      return {
        owner,
        trailGrid,
        painters,
        best: 0,
        shields: lo.level('shield'),
        dead: false,
        started: false,
        clock: 0,
        cuts: 0,
        swipe: null as null | { id: number; x: number; y: number },
        camX: N / 2,
        camY: N / 2,
      };
    })(),
  ).current;
  const me = s.painters[0]!;

  const steer = (dir: number) => {
    s.started = true;
    if ((dir + 2) % 4 === me.dir && me.trail.length > 0) return;
    me.queued = dir;
  };
  useKeyDown((code) => {
    if (code === 'ArrowRight' || code === 'KeyD') steer(0);
    else if (code === 'ArrowDown' || code === 'KeyS') steer(1);
    else if (code === 'ArrowLeft' || code === 'KeyA') steer(2);
    else if (code === 'ArrowUp' || code === 'KeyW') steer(3);
  }, !paused);

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.swipe = { id: p.id, x: p.x, y: p.y };
  };
  const onMove = (p: StagePointer) => {
    if (s.swipe?.id !== p.id) return;
    const dx = p.x - s.swipe.x;
    const dy = p.y - s.swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3);
    s.swipe = { id: p.id, x: p.x, y: p.y };
  };
  const onUp = () => {
    s.swipe = null;
  };

  const clearTrail = (p: Painter) => {
    for (const c of p.trail) if (s.trailGrid[c] === p.id) s.trailGrid[c] = NONE;
    p.trail = [];
  };

  const homeCell = (p: Painter) => {
    let best = -1;
    let bd = Infinity;
    for (let c = 0; c < N * N; c++) {
      if (s.owner[c] !== p.id) continue;
      const d = Math.abs((c % N) - p.x) + Math.abs(((c / N) | 0) - p.y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  };

  const finish = () =>
    api.gameOver({
      score: s.best,
      stats: [
        { label: 'Map owned', value: `${((s.best / (N * N)) * 100).toFixed(1)}%` },
        { label: 'Bots cut', value: String(s.cuts) },
      ],
    });

  const kill = (p: Painter, by: Painter | null) => {
    if (!p.alive) return;
    if (!p.bot && s.shields > 0) {
      s.shields -= 1;
      clearTrail(p);
      const h = homeCell(p);
      if (h >= 0) {
        p.x = h % N;
        p.y = (h / N) | 0;
      }
      p.t = 0;
      fx.current.floaters.add('Trail guard!', W / 2, H / 2 - 60, '#bae6fd', 18);
      api.sfx('hit');
      return;
    }
    p.alive = false;
    clearTrail(p);
    fx.current.particles.burst(W / 2 + (p.x - s.camX) * CELL, H / 2 + (p.y - s.camY) * CELL, {
      count: 30,
      color: p.color,
      speed: 220,
      life: 0.7,
    });
    if (p.bot) {
      clearOwner(s.owner, p.id);
      p.respawn = 3;
      if (by === me) {
        s.cuts += 1;
        fx.current.floaters.add(`Cut ${p.name}!`, W / 2, 140, '#86efac', 18);
        api.addCoins(3);
        api.sfx('perfect');
      }
    } else {
      s.dead = true;
      api.sfx('gameover');
      api.haptic([80, 40, 80]);
      continueGate(() => {
        s.dead = false;
        p.alive = true;
        let h = homeCell(p);
        if (h < 0) {
          claimSquare(s.owner, p.id, N / 2, N / 2, 1);
          h = idx(N / 2, N / 2);
        }
        p.x = h % N;
        p.y = (h / N) | 0;
        p.t = 0;
        p.queued = null;
      }, finish);
    }
  };

  const enter = (p: Painter) => {
    if (!inside(p.x, p.y)) {
      p.x = Math.max(0, Math.min(N - 1, p.x));
      p.y = Math.max(0, Math.min(N - 1, p.y));
      kill(p, null);
      return;
    }
    const c = idx(p.x, p.y);
    const tOwner = s.trailGrid[c]!;
    if (tOwner === p.id) {
      kill(p, null);
      return;
    }
    if (tOwner !== NONE) kill(s.painters[tOwner]!, p);
    if (s.owner[c] === p.id) {
      if (p.trail.length > 0) {
        const gained = capture(s.owner, p.id, p.trail);
        clearTrail(p);
        if (p === me) {
          api.sfx(gained > 20 ? 'powerup' : 'score');
          if (gained > 0)
            fx.current.floaters.add(
              `+${gained}`,
              W / 2,
              H / 2 - 40,
              '#fff',
              16 + Math.min(12, gained / 10),
              0.8,
            );
          if (gained >= 30) api.addCoins(1 + Math.floor(gained / 60));
        }
        // anyone whose trail got swallowed survives, but their land shrank
      }
    } else {
      s.trailGrid[c] = p.id;
      p.trail.push(c);
    }
  };

  const safe = (p: Painter, dir: number) => {
    const nx = p.x + DIRS[dir]![0];
    const ny = p.y + DIRS[dir]![1];
    return inside(nx, ny) && s.trailGrid[idx(nx, ny)] !== p.id;
  };

  const think = (p: Painter) => {
    const c = idx(p.x, p.y);
    const home = s.owner[c] === p.id;
    if (home && p.plan.length === 0) {
      const d = rng.int(0, 3);
      const turn = rng.chance(0.5) ? 1 : 3;
      const a = rng.int(3, 7);
      const b = rng.int(3, 7);
      p.plan = [
        { dir: d, steps: rng.int(1, 3) + a },
        { dir: (d + turn) % 4, steps: b },
        { dir: (d + turn * 2) % 4, steps: a + 2 },
      ];
    }
    let want = p.dir;
    if (p.plan.length > 0) {
      const step = p.plan[0]!;
      want = step.dir;
      step.steps -= 1;
      if (step.steps <= 0) p.plan.shift();
    } else if (!home) {
      // head home greedily
      const h = homeCell(p);
      if (h >= 0) {
        const hx = h % N;
        const hy = (h / N) | 0;
        want = Math.abs(hx - p.x) > Math.abs(hy - p.y) ? (hx > p.x ? 0 : 2) : hy > p.y ? 1 : 3;
      }
    }
    if ((want + 2) % 4 === p.dir) want = p.dir;
    if (!safe(p, want)) {
      const options = [p.dir, (p.dir + 1) % 4, (p.dir + 3) % 4].filter((d) => safe(p, d));
      if (options.length) want = rng.pick(options);
      p.plan = [];
    }
    // chase the player's trail if it's close
    if (me.alive && me.trail.length > 0 && rng.chance(0.25)) {
      for (const d of [0, 1, 2, 3]) {
        if ((d + 2) % 4 === p.dir) continue;
        const nx = p.x + DIRS[d]![0];
        const ny = p.y + DIRS[d]![1];
        if (inside(nx, ny) && s.trailGrid[idx(nx, ny)] === me.id) want = d;
      }
    }
    p.dir = want;
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters } = fx.current;
    s.clock += dt;

    if (s.started && !s.dead) {
      for (const p of s.painters) {
        if (!p.alive) {
          if (p.bot) {
            p.respawn -= dt;
            if (p.respawn <= 0) {
              for (let tries = 0; tries < 30; tries++) {
                const x = rng.int(3, N - 4);
                const y = rng.int(3, N - 4);
                if (Math.abs(x - me.x) + Math.abs(y - me.y) > 12) {
                  p.x = x;
                  p.y = y;
                  break;
                }
              }
              claimSquare(s.owner, p.id, p.x, p.y, 1);
              p.alive = true;
              p.plan = [];
              p.t = 0;
            }
          }
          continue;
        }
        p.t += p.speed * dt;
        while (p.t >= 1 && p.alive && !s.dead) {
          p.t -= 1;
          if (p.bot) think(p);
          else if (p.queued !== null) {
            if ((p.queued + 2) % 4 !== p.dir || p.trail.length === 0) p.dir = p.queued;
            p.queued = null;
          }
          p.x += DIRS[p.dir]![0];
          p.y += DIRS[p.dir]![1];
          enter(p);
        }
      }
      const mine = count(s.owner, me.id);
      if (mine > s.best) {
        s.best = mine;
        api.setScore(mine);
      }
    }
    particles.update(dt);
    floaters.update(dt);

    // ---------- render ----------
    const ix = me.alive ? me.x + DIRS[me.dir]![0] * me.t : me.x;
    const iy = me.alive ? me.y + DIRS[me.dir]![1] * me.t : me.y;
    s.camX += (ix - s.camX) * Math.min(1, dt * 8);
    s.camY += (iy - s.camY) * Math.min(1, dt * 8);
    const ox = W / 2 - s.camX * CELL - CELL / 2;
    const oy = H / 2 - s.camY * CELL - CELL / 2;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(ox, oy, N * CELL, N * CELL);
    const x0 = Math.max(0, Math.floor(-ox / CELL));
    const x1 = Math.min(N, Math.ceil((W - ox) / CELL));
    const y0 = Math.max(0, Math.floor(-oy / CELL));
    const y1 = Math.min(N, Math.ceil((H - oy) / CELL));
    const colorOf = (id: number) => (id === 0 ? myColor : BOTS[id - 1]!.color);
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const c = idx(x, y);
        const o = s.owner[c]!;
        const t = s.trailGrid[c]!;
        if (o !== NONE) {
          ctx.fillStyle = colorOf(o);
          ctx.fillRect(ox + x * CELL, oy + y * CELL, CELL + 0.5, CELL + 0.5);
        }
        if (t !== NONE) {
          ctx.fillStyle = shade(colorOf(t), 0.45);
          ctx.globalAlpha = 0.85;
          ctx.fillRect(ox + x * CELL + 3, oy + y * CELL + 3, CELL - 6, CELL - 6);
          ctx.globalAlpha = 1;
        }
      }
    ctx.strokeStyle = 'rgba(15,23,42,0.05)';
    ctx.lineWidth = 1;
    for (let x = x0; x <= x1; x++) {
      ctx.beginPath();
      ctx.moveTo(ox + x * CELL, oy + y0 * CELL);
      ctx.lineTo(ox + x * CELL, oy + y1 * CELL);
      ctx.stroke();
    }
    for (let y = y0; y <= y1; y++) {
      ctx.beginPath();
      ctx.moveTo(ox + x0 * CELL, oy + y * CELL);
      ctx.lineTo(ox + x1 * CELL, oy + y * CELL);
      ctx.stroke();
    }
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.strokeRect(ox, oy, N * CELL, N * CELL);
    for (const p of s.painters) {
      if (!p.alive) continue;
      const px = ox + (p.x + DIRS[p.dir]![0] * Math.min(1, p.t)) * CELL;
      const py = oy + (p.y + DIRS[p.dir]![1] * Math.min(1, p.t)) * CELL;
      fillRoundRect(ctx, px + 1, py + 3, CELL - 2, CELL - 2, 6, 'rgba(0,0,0,0.25)');
      fillRoundRect(ctx, px + 1, py, CELL - 2, CELL - 2, 6, shade(colorOf(p.id), -0.3));
      fillRoundRect(ctx, px + 4, py + 3, CELL - 8, CELL - 8, 4, colorOf(p.id));
      if (p.bot) text(ctx, p.name, px + CELL / 2, py - 8, { size: 10, weight: 800, color: '#0f172a' });
    }
    particles.draw(ctx);
    floaters.draw(ctx);

    // HUD
    const pct = (count(s.owner, me.id) / (N * N)) * 100;
    fillRoundRect(ctx, 10, 10, 120, 32, 12, 'rgba(15,23,42,0.7)');
    text(ctx, `${pct.toFixed(1)}%`, 70, 27, { size: 18, weight: 900, color: myColor });
    const board = s.painters.map((p) => ({ p, n: count(s.owner, p.id) })).sort((a, b) => b.n - a.n);
    board.forEach(({ p, n }, i) =>
      text(
        ctx,
        `${i + 1}. ${p.bot ? p.name : 'You'} ${((n / (N * N)) * 100).toFixed(1)}%`,
        W - 10,
        20 + i * 15,
        {
          size: 11,
          align: 'right',
          weight: p.bot ? 600 : 900,
          color: '#0f172a',
        },
      ),
    );
    if (s.shields > 0) hudPill(ctx, 10, 50, `🛡️ ${s.shields}`, { size: 12 });
    if (!s.started) prompt(ctx, 'Swipe to steer', W / 2, H * 0.75, s.clock, 20);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Color Land game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
