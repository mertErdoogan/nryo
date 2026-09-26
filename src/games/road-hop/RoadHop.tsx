import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  circle,
  createContinueGate,
  drawCoin,
  fillRoundRect,
  hudPill,
  prompt,
  shade,
  swipeDirection,
  useGameLoop,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const CELL = 40;
const COLS = 9;
const HOP_TIME = 0.11;
const CAR_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#a855f7', '#14b8a6', '#f472b6', '#e2e8f0'];

type LaneType = 'grass' | 'road' | 'river' | 'rail';
interface Mover {
  x: number;
  len: number;
  color: string;
}
interface Lane {
  type: LaneType;
  dir: 1 | -1;
  speed: number;
  movers: Mover[];
  trees: Set<number>;
  coins: Set<number>;
  trainT: number;
  warn: number;
  trainX: number | null;
}

export function RoadHop({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const coinRate = 0.08 * (1 + 0.25 * lo.level('lucky'));
  const magnet = lo.level('magnet');
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    lanes: new Map<number, Lane>(),
    genRow: 0,
    pending: [] as LaneType[],
    x: 4 * CELL + CELL / 2,
    row: 0,
    hop: null as null | { fx: number; fr: number; tx: number; tr: number; t: number },
    queued: null as null | 'up' | 'down' | 'left' | 'right',
    facing: 'up' as 'up' | 'down' | 'left' | 'right',
    camRow: 0,
    maxRow: 0,
    coins: 0,
    shields: lo.level('shield'),
    invuln: 0,
    dead: false,
    deadT: 0,
    deathKind: '' as string,
    started: false,
    clock: 0,
    idle: 0,
    down: null as null | { x: number; y: number },
  }).current;

  const makeLane = (row: number): Lane => {
    if (s.pending.length === 0) {
      if (row < 4) s.pending.push('grass');
      else {
        const diff = Math.min(1, row / 250);
        const r = rng.next();
        if (r < 0.42) for (let i = rng.int(1, 2 + Math.round(diff * 2)); i > 0; i--) s.pending.push('road');
        else if (r < 0.66) for (let i = rng.int(1, 2 + Math.round(diff)); i > 0; i--) s.pending.push('river');
        else if (r < 0.76 && row > 12) s.pending.push('rail');
        s.pending.push('grass');
        if (rng.chance(0.4)) s.pending.push('grass');
      }
    }
    const type = s.pending.shift()!;
    const lane: Lane = {
      type,
      dir: rng.chance(0.5) ? 1 : -1,
      speed: 0,
      movers: [],
      trees: new Set(),
      coins: new Set(),
      trainT: rng.range(2, 6),
      warn: 0,
      trainX: null,
    };
    const diff = Math.min(1, row / 300);
    if (type === 'grass') {
      if (row > 0) {
        const n = rng.int(0, 3);
        for (let i = 0; i < n; i++) lane.trees.add(rng.int(0, COLS - 1));
        lane.trees.delete(4);
        if (lane.trees.size >= COLS - 2) lane.trees.clear();
      } else for (const c of [0, 1, 7, 8]) lane.trees.add(c);
    } else if (type === 'road') {
      lane.speed = rng.range(1.4, 2.6 + diff * 2.5) * CELL;
      const truck = rng.chance(0.3);
      const len = (truck ? 2.4 : 1.3) * CELL;
      const n = rng.int(2, 3);
      const spacing = (W + 200) / n;
      const color = rng.pick(CAR_COLORS);
      for (let i = 0; i < n; i++)
        lane.movers.push({
          x: i * spacing + rng.range(0, spacing * 0.4) - 100,
          len,
          color: truck ? '#64748b' : color,
        });
    } else if (type === 'river') {
      lane.speed = rng.range(0.9, 1.6 + diff * 1.2) * CELL;
      const n = rng.int(2, 3);
      const spacing = (W + 240) / n;
      for (let i = 0; i < n; i++)
        lane.movers.push({
          x: i * spacing + rng.range(0, 40) - 120,
          len: rng.int(2, 4 - Math.round(diff)) * CELL,
          color: '#92400e',
        });
    }
    if (type !== 'river' && type !== 'rail' && row > 2)
      for (let c = 0; c < COLS; c++) if (!lane.trees.has(c) && rng.chance(coinRate)) lane.coins.add(c);
    return lane;
  };

  const lane = (row: number): Lane => {
    while (s.genRow <= row) {
      s.lanes.set(s.genRow, makeLane(s.genRow));
      s.genRow++;
    }
    return s.lanes.get(row)!;
  };

  const col = (x: number) => Math.floor(x / CELL);

  const tryMove = (dir: 'up' | 'down' | 'left' | 'right') => {
    s.started = true;
    if (s.dead) return;
    if (s.hop) {
      s.queued = dir;
      return;
    }
    s.facing = dir;
    let tr = s.row;
    let tx = s.x;
    if (dir === 'up') tr += 1;
    else if (dir === 'down') tr -= 1;
    else tx += dir === 'left' ? -CELL : CELL;
    // Can't step behind the start or too far below the camera.
    if (tr < 0 || tr < s.camRow - 1) return;
    // snap to the grid when stepping onto solid ground
    const target = lane(tr);
    if (target.type !== 'river') tx = col(tx) * CELL + CELL / 2;
    if (tx < CELL / 2 - 1 || tx > W - CELL / 2 + 1) return;
    if (target.type === 'grass' && target.trees.has(col(tx))) return;
    s.hop = { fx: s.x, fr: s.row, tx, tr, t: 0 };
    s.idle = 0;
    api.sfx('tap');
  };

  useKeyDown((code) => {
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') tryMove('up');
    else if (code === 'ArrowDown' || code === 'KeyS') tryMove('down');
    else if (code === 'ArrowLeft' || code === 'KeyA') tryMove('left');
    else if (code === 'ArrowRight' || code === 'KeyD') tryMove('right');
  }, !paused);

  const onDown = (p: StagePointer) => {
    s.down = { x: p.x, y: p.y };
  };
  const onUp = (p: StagePointer) => {
    if (!s.down) return;
    const dir = swipeDirection(p.x - s.down.x, p.y - s.down.y, 22);
    s.down = null;
    tryMove(dir ?? 'up');
  };

  const kill = (kind: string) => {
    if (s.dead || s.invuln > 0) return;
    if (s.shields > 0 && kind !== 'eagle' && kind !== 'water') {
      s.shields -= 1;
      s.invuln = 1.5;
      fx.current.shake.add(8);
      fx.current.floaters.add('Feather saved you!', W / 2, 200, '#fde68a', 18);
      api.sfx('hit');
      return;
    }
    s.dead = true;
    s.deadT = 0.9;
    s.deathKind = kind;
    fx.current.shake.add(14);
    api.sfx(kind === 'water' ? 'miss' : 'explode');
    api.haptic([60, 30, 80]);
  };

  const revive = () => {
    // Nearest grass row at or behind the player, on a free tile.
    let r = s.row;
    while (r > 0 && lane(r).type !== 'grass') r--;
    const l = lane(r);
    let c = Math.max(0, Math.min(COLS - 1, col(s.x)));
    for (let d = 0; d < COLS; d++) {
      if (c + d < COLS && !l.trees.has(c + d)) {
        c += d;
        break;
      }
      if (c - d >= 0 && !l.trees.has(c - d)) {
        c -= d;
        break;
      }
    }
    s.row = r;
    s.x = c * CELL + CELL / 2;
    s.hop = null;
    s.camRow = Math.min(s.camRow, r - 1);
    s.dead = false;
    s.invuln = 2;
    s.idle = 0;
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const rowsVisible = Math.ceil(H / CELL) + 3;
    lane(Math.floor(s.camRow) + rowsVisible + 2);

    // movers always move (so the world looks alive before the first hop)
    for (let r = Math.floor(s.camRow) - 3; r < s.camRow + rowsVisible; r++) {
      const l = s.lanes.get(r);
      if (!l) continue;
      for (const m of l.movers) {
        m.x += l.dir * l.speed * dt;
        if (l.dir > 0 && m.x > W + 60) m.x -= W + 60 + m.len + 80;
        if (l.dir < 0 && m.x + m.len < -60) m.x += W + 60 + m.len + 80;
      }
      if (l.type === 'rail' && s.started) {
        if (l.trainX === null) {
          l.trainT -= dt;
          if (l.trainT <= 1.1 && l.warn <= 0) l.warn = 1.1;
          if (l.warn > 0) l.warn -= dt;
          if (l.trainT <= 0) {
            l.trainX = l.dir > 0 ? -12 * CELL : W;
            l.warn = 0;
            if (Math.abs(r - s.row) < 6) api.sfx('tick');
          }
        } else {
          l.trainX += l.dir * 26 * CELL * dt;
          if (l.trainX > W + 40 || l.trainX < -13 * CELL) {
            l.trainX = null;
            l.trainT = rng.range(3.5, 8);
          }
        }
      }
    }

    if (!s.dead) {
      s.invuln = Math.max(0, s.invuln - dt);
      if (s.hop) {
        s.hop.t += dt / HOP_TIME;
        if (s.hop.t >= 1) {
          s.x = s.hop.tx;
          s.row = s.hop.tr;
          s.hop = null;
          if (s.row > s.maxRow) {
            s.maxRow = s.row;
            api.setScore(s.maxRow);
          }
          const l = lane(s.row);
          const c = col(s.x);
          for (const dc of magnet > 0 ? [-1, 0, 1] : [0]) {
            if (l.coins.has(c + dc)) {
              l.coins.delete(c + dc);
              s.coins += 1;
              api.addCoins(1);
              api.sfx('coin');
            }
          }
          if (magnet > 1) {
            for (const dr of [-1, 1]) {
              const l2 = s.lanes.get(s.row + dr);
              if (l2?.coins.has(c)) {
                l2.coins.delete(c);
                s.coins += 1;
                api.addCoins(1);
              }
            }
          }
          if (s.queued) {
            const q = s.queued;
            s.queued = null;
            tryMove(q);
          }
        } else {
          s.x = s.hop.fx + (s.hop.tx - s.hop.fx) * s.hop.t;
        }
      }
      if (!s.hop && s.started) {
        const l = lane(s.row);
        if (l.type === 'river') {
          const log = l.movers.find((m) => s.x > m.x - 4 && s.x < m.x + m.len + 4);
          if (!log) kill('water');
          else {
            s.x += l.dir * l.speed * dt;
            if (s.x < 4 || s.x > W - 4) kill('water');
          }
        }
      }
      const cur = lane(s.hop ? (s.hop.t > 0.5 ? s.hop.tr : s.hop.fr) : s.row);
      if (cur.type === 'road') {
        for (const m of cur.movers) if (s.x + 13 > m.x && s.x - 13 < m.x + m.len) kill('car');
      } else if (cur.type === 'rail' && cur.trainX !== null) {
        if (s.x + 13 > cur.trainX && s.x - 13 < cur.trainX + 12 * CELL) kill('train');
      }
      if (s.started) {
        const pace = 0.28 + Math.min(0.55, s.maxRow / 350);
        s.camRow += pace * dt;
        if (s.row - s.camRow > 4) s.camRow += (s.row - 4 - s.camRow) * Math.min(1, dt * 4);
        s.idle += dt;
        if (s.row < s.camRow - 1.4) kill('eagle');
      }
    } else if (s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(revive, () =>
          api.gameOver({
            score: s.maxRow,
            stats: [
              { label: 'Coins', value: String(s.coins) },
              {
                label: 'Stopped by',
                value:
                  { car: 'Traffic', water: 'Splash', train: 'Train', eagle: 'Too slow' }[s.deathKind] ?? '—',
              },
            ],
          }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    const rowY = (r: number) => H - 100 - (r - s.camRow) * CELL;
    ctx.save();
    shake.apply(ctx);
    const first = Math.floor(s.camRow) - 3;
    for (let r = first + rowsVisible; r >= first; r--) {
      const l = s.lanes.get(r);
      const y = rowY(r) - CELL / 2;
      if (!l) {
        ctx.fillStyle = r % 2 ? '#4ade80' : '#22c55e';
        ctx.fillRect(0, y, W, CELL);
        continue;
      }
      if (l.type === 'grass') {
        ctx.fillStyle = r % 2 ? '#4ade80' : '#22c55e';
        ctx.fillRect(0, y, W, CELL);
      } else if (l.type === 'road') {
        ctx.fillStyle = '#475569';
        ctx.fillRect(0, y, W, CELL);
        if (s.lanes.get(r + 1)?.type === 'road') {
          ctx.fillStyle = 'rgba(248,250,252,0.7)';
          for (let x = 10; x < W; x += 60) ctx.fillRect(x, y - 2, 30, 4);
        }
      } else if (l.type === 'river') {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(0, y, W, CELL);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for (let x = ((s.clock * 20 * l.dir) % 50) - 50; x < W; x += 50)
          ctx.fillRect(x, y + 12 + (r % 3) * 6, 16, 3);
      } else {
        ctx.fillStyle = '#78716c';
        ctx.fillRect(0, y, W, CELL);
        ctx.fillStyle = '#57534e';
        for (let x = 0; x < W; x += 16) ctx.fillRect(x, y + 6, 8, CELL - 12);
        ctx.fillStyle = '#d6d3d1';
        ctx.fillRect(0, y + 10, W, 3);
        ctx.fillRect(0, y + CELL - 13, W, 3);
      }
    }
    for (let r = first + rowsVisible; r >= first; r--) {
      const l = s.lanes.get(r);
      if (!l) continue;
      const y = rowY(r);
      for (const c of l.coins) drawCoin(ctx, c * CELL + CELL / 2, y, 8, s.clock + c);
      if (l.type === 'grass') {
        for (const c of l.trees) {
          const tx = c * CELL + 6;
          ctx.fillStyle = '#78350f';
          ctx.fillRect(tx + 11, y + 4, 8, 12);
          fillRoundRect(ctx, tx, y - 22, 28, 28, 5, '#166534');
          fillRoundRect(ctx, tx + 4, y - 26, 20, 12, 4, '#15803d');
        }
      } else if (l.type === 'road') {
        for (const m of l.movers) {
          fillRoundRect(ctx, m.x, y - 15, m.len, 30, 7, m.color);
          ctx.fillStyle = 'rgba(15,23,42,0.6)';
          const front = l.dir > 0 ? m.x + m.len - 22 : m.x + 8;
          ctx.fillRect(front, y - 11, 14, 22);
          ctx.fillStyle = shade(m.color, 0.3);
          ctx.fillRect(m.x + 6, y - 15, m.len - 12, 4);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(l.dir > 0 ? m.x + m.len - 4 : m.x, y - 12, 4, 6);
          ctx.fillRect(l.dir > 0 ? m.x + m.len - 4 : m.x, y + 6, 4, 6);
        }
      } else if (l.type === 'river') {
        for (const m of l.movers) {
          fillRoundRect(ctx, m.x, y - 14, m.len, 28, 10, '#92400e');
          ctx.fillStyle = '#b45309';
          ctx.fillRect(m.x + 8, y - 4, m.len - 16, 3);
        }
      } else if (l.type === 'rail') {
        const on = l.warn > 0 && Math.floor(s.clock * 8) % 2 === 0;
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(6, y - 30, 4, 30);
        circle(ctx, 8, y - 32, 6, on ? '#ef4444' : '#450a0a');
        if (l.trainX !== null) {
          for (let i = 0; i < 4; i++) {
            fillRoundRect(
              ctx,
              l.trainX + i * 3 * CELL,
              y - 17,
              3 * CELL - 4,
              34,
              6,
              i === 0 ? '#dc2626' : '#b91c1c',
            );
            ctx.fillStyle = '#fde68a';
            for (let wx = 12; wx < 3 * CELL - 16; wx += 24)
              ctx.fillRect(l.trainX + i * 3 * CELL + wx, y - 10, 12, 10);
          }
        }
      }
      // the player is drawn in its row so trees/cars in front overlap correctly
      const pRow = s.hop ? Math.max(s.hop.fr, s.hop.tr) : s.row;
      if (r === pRow) drawPlayer();
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    function drawPlayer() {
      const hopT = s.hop ? s.hop.t : 0;
      const rowF = s.hop ? s.hop.fr + (s.hop.tr - s.hop.fr) * hopT : s.row;
      const py = rowY(rowF) - Math.sin(hopT * Math.PI) * 12;
      const [c0, c1, c2] = lo.skin.colors;
      ctx.save();
      ctx.translate(s.x, py);
      if (s.dead) {
        ctx.scale(1.3, s.deathKind === 'water' ? 0.3 : 0.25);
      }
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 12) % 2 ? 0.4 : 1;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(-12, 8, 26, 8);
      fillRoundRect(ctx, -13, -14, 26, 26, 5, c0);
      fillRoundRect(ctx, -13, 4, 26, 8, 3, shade(c0, -0.12));
      const id = lo.skin.id;
      const look = s.facing === 'left' ? -4 : s.facing === 'right' ? 4 : 0;
      if (id === 'chicken') {
        ctx.fillStyle = c1;
        ctx.fillRect(-3, -20, 7, 7);
        ctx.fillStyle = c2;
        ctx.fillRect(-3 + look, -4, 7, 5);
      } else if (id === 'frog') {
        circle(ctx, -7, -14, 5, c0);
        circle(ctx, 7, -14, 5, c0);
      } else if (id === 'cat' || id === 'panda') {
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.moveTo(-13, -12);
        ctx.lineTo(-9, -21);
        ctx.lineTo(-4, -13);
        ctx.moveTo(13, -12);
        ctx.lineTo(9, -21);
        ctx.lineTo(4, -13);
        ctx.fill();
        if (id === 'panda') {
          ctx.fillRect(-10, -9, 7, 6);
          ctx.fillRect(3, -9, 7, 6);
        }
      } else if (id === 'robot') {
        ctx.fillStyle = c1;
        ctx.fillRect(-1, -22, 3, 8);
        circle(ctx, 0, -23, 3, c2);
        ctx.fillStyle = c2;
        ctx.fillRect(-9 + look, -8, 18, 4);
      } else if (id === 'unicorn') {
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.moveTo(-3, -14);
        ctx.lineTo(0, -26);
        ctx.lineTo(3, -14);
        ctx.fill();
        ctx.fillStyle = c1;
        ctx.fillRect(-13, -14, 5, 18);
      }
      if (id !== 'robot') {
        ctx.fillStyle = '#111';
        ctx.fillRect(-7 + look, -8, 3, 4);
        ctx.fillRect(4 + look, -8, 3, 4);
      }
      ctx.restore();
    }

    hudPill(ctx, 10, 10, `${s.maxRow}`, { size: 18, color: '#fff' });
    hudPill(ctx, W - 10, 10, String(s.coins), { align: 'right', coin: true, size: 14 });
    if (s.shields > 0) hudPill(ctx, 10, 48, `🪶 ${s.shields}`, { size: 12 });
    if (!s.started) prompt(ctx, 'Tap to hop · swipe to turn', W / 2, H * 0.3, s.clock, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Road Hop game area"
      onPointerDown={onDown}
      onPointerUp={onUp}
    />
  );
}
