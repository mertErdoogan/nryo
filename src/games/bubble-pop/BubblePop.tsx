import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  circle,
  createContinueGate,
  hudPill,
  prompt,
  text,
  useGameLoop,
  useHeldKeys,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const R = 17;
const LEFT = 10;
const TOP = 70;
const ROW_H = R * Math.sqrt(3);
const DANGER_Y = 520;
const SHOOT_X = W / 2;
const SHOOT_Y = 590;
const BOMB = -1;
const RAINBOW = -2;

const PALETTES: Record<string, string[]> = {
  classic: ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#f97316'],
  candy: ['#f472b6', '#a78bfa', '#34d399', '#fde68a', '#fb7185', '#7dd3fc'],
  ocean: ['#06b6d4', '#0ea5e9', '#2dd4bf', '#a5f3fc', '#6366f1', '#f0f9ff'],
  jewel: ['#be123c', '#1d4ed8', '#047857', '#ca8a04', '#7e22ce', '#c2410c'],
  glow: ['#f0abfc', '#67e8f9', '#bef264', '#fde047', '#fda4af', '#c4b5fd'],
};

interface Row {
  offset: boolean;
  cells: (number | null)[];
}

export function BubblePop({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const palette = PALETTES[lo.skin.id] ?? PALETTES.classic!;
  const guideLen = 160 + 170 * lo.level('guide');
  const bombEvery = lo.level('bomb') > 0 ? 18 - 4 * lo.level('bomb') : 0;
  const rainbowEvery = lo.level('rainbow') > 0 ? 22 - 4 * lo.level('rainbow') : 0;
  const fx = useRef({ particles: new Particles(400, rng.next), floaters: new FloatingText() });
  const continueGate = useRef(createContinueGate(api)).current;

  const rowLen = (row: Row) => (row.offset ? 9 : 10);
  const cellX = (row: Row, c: number) => LEFT + R + (row.offset ? R : 0) + c * 2 * R;
  const cellY = (r: number) => TOP + R + r * ROW_H;

  const s = useRef({
    rows: [] as Row[],
    colors: 4,
    current: 0,
    next: 0,
    shot: null as null | { x: number; y: number; vx: number; vy: number; color: number },
    angle: -Math.PI / 2,
    aiming: false,
    misses: 0,
    shots: 0,
    score: 0,
    popped: 0,
    dropped: 0,
    falling: [] as { x: number; y: number; vy: number; vx: number; color: number }[],
    over: false,
    started: false,
    clock: 0,
    level: 1,
  }).current;

  const randomRow = (offset: boolean): Row => ({
    offset,
    cells: Array.from({ length: offset ? 9 : 10 }, () => rng.int(0, s.colors - 1)),
  });
  const colorsOnBoard = () => {
    const set = new Set<number>();
    for (const row of s.rows) for (const c of row.cells) if (c !== null && c >= 0) set.add(c);
    return [...set];
  };
  const pickColor = () => {
    s.shots += 1;
    if (bombEvery && s.shots % bombEvery === 0) return BOMB;
    if (rainbowEvery && s.shots % rainbowEvery === 0) return RAINBOW;
    const onBoard = colorsOnBoard();
    return onBoard.length ? rng.pick(onBoard) : rng.int(0, s.colors - 1);
  };
  if (s.rows.length === 0) {
    for (let r = 0; r < 6; r++) s.rows.push(randomRow(r % 2 === 1));
    s.current = pickColor();
    s.next = pickColor();
  }

  const neighbours = (r: number, c: number): [number, number][] => {
    const row = s.rows[r]!;
    const out: [number, number][] = [
      [r, c - 1],
      [r, c + 1],
    ];
    const d = row.offset ? [0, 1] : [-1, 0];
    for (const dr of [-1, 1]) for (const dc of d) out.push([r + dr, c + dc]);
    return out.filter(([rr, cc]) => rr >= 0 && rr < s.rows.length && cc >= 0 && cc < rowLen(s.rows[rr]!));
  };
  const get = (r: number, c: number) => s.rows[r]?.cells[c] ?? null;

  const ensureRows = (n: number) => {
    while (s.rows.length < n) {
      const last = s.rows[s.rows.length - 1];
      const offset = last ? !last.offset : false;
      s.rows.push({ offset, cells: Array.from({ length: offset ? 9 : 10 }, () => null) });
    }
  };

  const nearestEmpty = (x: number, y: number): [number, number] => {
    const rGuess = clamp(Math.round((y - TOP - R) / ROW_H), 0, 30);
    ensureRows(rGuess + 2);
    let best: [number, number] = [0, 0];
    let bd = Infinity;
    for (let r = Math.max(0, rGuess - 1); r <= rGuess + 1; r++) {
      const row = s.rows[r]!;
      for (let c = 0; c < rowLen(row); c++) {
        if (row.cells[c] !== null) continue;
        // must attach to the ceiling or another bubble
        if (r > 0 && !neighbours(r, c).some(([rr, cc]) => get(rr, cc) !== null)) continue;
        const d = Math.hypot(cellX(row, c) - x, cellY(r) - y);
        if (d < bd) {
          bd = d;
          best = [r, c];
        }
      }
    }
    return best;
  };

  const removeFloating = () => {
    const seen = new Set<string>();
    const stack: [number, number][] = [];
    s.rows[0]?.cells.forEach((c, i) => {
      if (c !== null) {
        stack.push([0, i]);
        seen.add(`0,${i}`);
      }
    });
    while (stack.length) {
      const [r, c] = stack.pop()!;
      for (const [rr, cc] of neighbours(r, c)) {
        const k = `${rr},${cc}`;
        if (seen.has(k) || get(rr, cc) === null) continue;
        seen.add(k);
        stack.push([rr, cc]);
      }
    }
    let n = 0;
    s.rows.forEach((row, r) =>
      row.cells.forEach((c, i) => {
        if (c !== null && !seen.has(`${r},${i}`)) {
          s.falling.push({
            x: cellX(row, i),
            y: cellY(r),
            vy: rng.range(-60, 20),
            vx: rng.range(-60, 60),
            color: c,
          });
          row.cells[i] = null;
          n++;
        }
      }),
    );
    return n;
  };

  const place = (r: number, c: number, color: number) => {
    const { particles, floaters } = fx.current;
    const row = s.rows[r]!;
    let col = color;
    if (col === RAINBOW) {
      const counts = new Map<number, number>();
      for (const [rr, cc] of neighbours(r, c)) {
        const v = get(rr, cc);
        if (v !== null && v >= 0) counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      col = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? rng.int(0, s.colors - 1);
    }
    row.cells[c] = col;
    let popped = 0;
    if (col === BOMB) {
      const cx = cellX(row, c);
      const cy = cellY(r);
      s.rows.forEach((rw, rr) =>
        rw.cells.forEach((v, i) => {
          if (v !== null && Math.hypot(cellX(rw, i) - cx, cellY(rr) - cy) < R * 4.6) {
            particles.burst(cellX(rw, i), cellY(rr), {
              count: 6,
              color: v >= 0 ? palette[v]! : '#fff',
              speed: 160,
              life: 0.4,
            });
            rw.cells[i] = null;
            popped++;
          }
        }),
      );
      api.sfx('explode');
    } else {
      const group: [number, number][] = [[r, c]];
      const seen = new Set([`${r},${c}`]);
      for (let i = 0; i < group.length; i++) {
        const [gr, gc] = group[i]!;
        for (const [nr, nc] of neighbours(gr, gc)) {
          const k = `${nr},${nc}`;
          if (!seen.has(k) && get(nr, nc) === col) {
            seen.add(k);
            group.push([nr, nc]);
          }
        }
      }
      if (group.length >= 3) {
        for (const [gr, gc] of group) {
          const rw = s.rows[gr]!;
          particles.burst(cellX(rw, gc), cellY(gr), {
            count: 8,
            color: palette[col]!,
            speed: 160,
            life: 0.4,
          });
          rw.cells[gc] = null;
        }
        popped = group.length;
        api.sfx(popped >= 5 ? 'perfect' : 'score');
      }
    }
    if (popped > 0) {
      const dropped = removeFloating();
      const pts = popped * 10 + dropped * 25 + (popped + dropped >= 8 ? 100 : 0);
      s.score += pts;
      s.popped += popped;
      s.dropped += dropped;
      api.setScore(s.score);
      if (dropped > 0) floaters.add(`+${pts}`, cellX(row, c), cellY(r), '#fff', 18);
      if (popped + dropped >= 10) api.addCoins(1);
      s.misses = 0;
    } else {
      s.misses += 1;
      api.sfx('tap');
      const limit = Math.max(3, 6 - Math.floor(s.level / 2));
      if (s.misses >= limit) {
        s.misses = 0;
        s.rows.unshift(randomRow(!s.rows[0]!.offset));
        api.sfx('tick');
      }
    }
    // board cleared → next level
    if (s.rows.every((rw) => rw.cells.every((v) => v === null))) {
      s.level += 1;
      s.colors = Math.min(6, 3 + s.level);
      s.rows = [];
      for (let i = 0; i < 5 + Math.min(4, s.level); i++) s.rows.push(randomRow(i % 2 === 1));
      s.score += 500;
      api.setScore(s.score);
      api.addCoins(3);
      floaters.add('Board cleared! +500', W / 2, 300, '#86efac', 22, 1.5);
      api.sfx('win');
    }
    // danger check
    const lowest = s.rows.reduce((m, rw, rr) => (rw.cells.some((v) => v !== null) ? rr : m), -1);
    if (lowest >= 0 && cellY(lowest) + R > DANGER_Y) {
      s.over = true;
      api.sfx('gameover');
      continueGate(
        () => {
          s.over = false;
          const keep = Math.max(2, lowest - 4);
          s.rows = s.rows.slice(0, keep);
        },
        () =>
          api.gameOver({
            score: s.score,
            stats: [
              { label: 'Popped', value: String(s.popped) },
              { label: 'Dropped', value: String(s.dropped) },
              { label: 'Level', value: String(s.level) },
            ],
          }),
      );
    }
  };

  const fire = () => {
    if (s.shot || s.over) return;
    s.started = true;
    const sp = 950;
    s.shot = {
      x: SHOOT_X,
      y: SHOOT_Y,
      vx: Math.cos(s.angle) * sp,
      vy: Math.sin(s.angle) * sp,
      color: s.current,
    };
    s.current = s.next;
    s.next = pickColor();
    api.sfx('swap');
  };
  const swap = () => {
    if (s.shot) return;
    [s.current, s.next] = [s.next, s.current];
    api.sfx('click');
  };

  const aimAt = (x: number, y: number) => {
    s.angle = clamp(Math.atan2(y - SHOOT_Y, x - SHOOT_X), -Math.PI + 0.12, -0.12);
  };
  const onDown = (p: StagePointer) => {
    if (
      Math.hypot(p.x - SHOOT_X, p.y - SHOOT_Y) < 26 ||
      (p.x > SHOOT_X + 40 && p.x < SHOOT_X + 90 && p.y > SHOOT_Y - 20)
    ) {
      swap();
      return;
    }
    s.aiming = true;
    aimAt(p.x, p.y);
  };
  const onMove = (p: StagePointer) => {
    if (s.aiming || p.type === 'mouse') aimAt(p.x, p.y);
  };
  const onUp = (p: StagePointer) => {
    if (!s.aiming) return;
    s.aiming = false;
    aimAt(p.x, p.y);
    if (p.y < SHOOT_Y - 20) fire();
  };
  useKeyDown((code) => {
    if (code === 'Space' || code === 'ArrowUp') fire();
    if (code === 'KeyS' || code === 'ArrowDown') swap();
  }, !paused);

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters } = fx.current;
    s.clock += dt;
    const k = keys.current;
    if (k.has('ArrowLeft') || k.has('KeyA')) s.angle = clamp(s.angle - 1.8 * dt, -Math.PI + 0.12, -0.12);
    if (k.has('ArrowRight') || k.has('KeyD')) s.angle = clamp(s.angle + 1.8 * dt, -Math.PI + 0.12, -0.12);

    const sh = s.shot;
    if (sh && !s.over) {
      const steps = 4;
      for (let i = 0; i < steps && s.shot; i++) {
        sh.x += (sh.vx * dt) / steps;
        sh.y += (sh.vy * dt) / steps;
        if (sh.x < LEFT + R) {
          sh.x = LEFT + R;
          sh.vx = Math.abs(sh.vx);
        } else if (sh.x > W - LEFT - R) {
          sh.x = W - LEFT - R;
          sh.vx = -Math.abs(sh.vx);
        }
        let hit = sh.y < TOP + R;
        if (!hit)
          s.rows.forEach((row, r) =>
            row.cells.forEach((c, ci) => {
              if (!hit && c !== null && Math.hypot(cellX(row, ci) - sh.x, cellY(r) - sh.y) < R * 1.7)
                hit = true;
            }),
          );
        if (hit) {
          const [r, c] = nearestEmpty(sh.x, sh.y);
          s.shot = null;
          place(r, c, sh.color);
        }
      }
    }
    for (const f of s.falling) {
      f.vy += 1200 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }
    s.falling = s.falling.filter((f) => f.y < H + 30);
    particles.update(dt);
    floaters.update(dt);

    // ---------- render ----------
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#312e81');
    bg.addColorStop(1, '#0e7490');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, TOP);
    ctx.strokeStyle = 'rgba(248,113,113,0.6)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y);
    ctx.lineTo(W, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    const drawBubble = (x: number, y: number, c: number) => {
      if (c === BOMB) {
        circle(ctx, x, y, R - 1, '#111827');
        text(ctx, '💣', x, y + 1, { size: 18 });
        return;
      }
      if (c === RAINBOW) {
        const g = ctx.createConicGradient(s.clock * 2, x, y);
        palette.forEach((col, i) => g.addColorStop(i / palette.length, col));
        g.addColorStop(1, palette[0]!);
        circle(ctx, x, y, R - 1, g as unknown as string);
        return;
      }
      circle(ctx, x, y, R - 1, palette[c]!);
      circle(ctx, x - R * 0.3, y - R * 0.3, R * 0.32, 'rgba(255,255,255,0.45)');
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, R - 2, 0.2, Math.PI - 0.2);
      ctx.stroke();
    };
    s.rows.forEach((row, r) =>
      row.cells.forEach((c, i) => c !== null && drawBubble(cellX(row, i), cellY(r), c)),
    );
    for (const f of s.falling) drawBubble(f.x, f.y, f.color);
    // aim guide
    if (!s.shot && !s.over) {
      let gx = SHOOT_X;
      let gy = SHOOT_Y;
      let dx = Math.cos(s.angle);
      const dy = Math.sin(s.angle);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let d = 0; d < guideLen; d += 14) {
        gx += dx * 14;
        gy += dy * 14;
        if (gx < LEFT + R || gx > W - LEFT - R) dx = -dx;
        if (gy < TOP) break;
        circle(ctx, gx, gy, 2.5 * (1 - d / guideLen) + 1, 'rgba(255,255,255,0.75)');
      }
    }
    if (s.shot) drawBubble(s.shot.x, s.shot.y, s.shot.color);
    // shooter
    ctx.save();
    ctx.translate(SHOOT_X, SHOOT_Y);
    ctx.rotate(s.angle + Math.PI / 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-5, -34, 10, 22);
    ctx.restore();
    circle(ctx, SHOOT_X, SHOOT_Y, R + 6, 'rgba(15,23,42,0.6)');
    drawBubble(SHOOT_X, SHOOT_Y, s.current);
    drawBubble(SHOOT_X + 62, SHOOT_Y + 6, s.next);
    text(ctx, 'next', SHOOT_X + 62, SHOOT_Y + 34, { size: 10, color: '#cbd5e1' });
    particles.draw(ctx);
    floaters.draw(ctx);
    text(ctx, s.score.toLocaleString('en'), W / 2, 30, { size: 22, weight: 900 });
    hudPill(ctx, 10, 18, `Lv ${s.level}`, { size: 12 });
    const limit = Math.max(3, 6 - Math.floor(s.level / 2));
    text(ctx, `Row drop in ${limit - s.misses}`, W - 12, 30, {
      size: 11,
      align: 'right',
      color: '#fca5a5',
      weight: 700,
    });
    if (!s.started) prompt(ctx, 'Drag to aim · release to shoot', W / 2, 470, s.clock, 16);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Bubble Pop game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
