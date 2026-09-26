import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  createContinueGate,
  useGameLoop,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { fillRoundRect, text } from '../../engine/draw';
import type { GameProps, SoundName } from '../../platform/types';
import { LANES, nextLane, ROW_H, rowTop, speedForScore, type Row } from './logic';

const W = 360;
const H = 640;
const LANE_W = W / LANES;
const MELODY: SoundName[] = [
  'note-c',
  'note-c',
  'note-g',
  'note-g',
  'note-a',
  'note-a',
  'note-g',
  'note-e',
  'note-e',
  'note-d',
  'note-d',
  'note-c',
  'note-g',
  'note-e',
  'note-c2',
  'note-a',
];
const KEYS: Record<string, number> = {
  KeyD: 0,
  KeyF: 1,
  KeyJ: 2,
  KeyK: 3,
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
};

export function TileTapper({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const fx = useRef({ particles: new Particles(300, rng.next), floaters: new FloatingText() });
  const lo = api.loadout;
  const [tileTop, tileBottom, sparkColor] = lo.skin.colors;
  const tempo = 1 - 0.04 * lo.level('tempo');
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    forgives: lo.level('forgive'),
    waiting: false,
    rows: [] as Row[],
    scroll: 0,
    started: false,
    score: 0,
    fail: null as null | { lane: number; index: number; kind: 'white' | 'missed' },
    failTimer: 0,
    ended: false,
    time: 0,
    flash: 0,
    rewind: 0,
  }).current;

  if (s.rows.length === 0) {
    let lane = rng.int(0, LANES - 1);
    for (let i = 0; i < 8; i++) {
      s.rows.push({ lane, index: i, tapped: false });
      lane = nextLane(lane, rng.next());
    }
  }

  const ensureRows = () => {
    const last = s.rows[s.rows.length - 1]!;
    while (rowTop(s.rows[s.rows.length - 1]!.index, s.scroll, H) > -ROW_H * 2) {
      const prev = s.rows[s.rows.length - 1]!;
      s.rows.push({ lane: nextLane(prev.lane, rng.next()), index: prev.index + 1, tapped: false });
    }
    // Drop rows well below the screen.
    s.rows = s.rows.filter((r) => rowTop(r.index, s.scroll, H) < H + ROW_H || r === last);
  };

  const failAt = (lane: number, index: number, kind: 'white' | 'missed') => {
    if (kind === 'white' && s.forgives > 0) {
      s.forgives -= 1;
      fx.current.floaters.add('Saved!', lane * LANE_W + LANE_W / 2, H * 0.5, '#0ea5e9', 20, 0.7);
      api.sfx('miss');
      return;
    }
    s.fail = { lane, index, kind };
    s.failTimer = 1.1;
    api.sfx('error');
    api.haptic([60, 40, 60]);
  };

  const tap = (lane: number, y: number | null) => {
    if (s.fail) return;
    const pending = s.rows.find((r) => !r.tapped);
    if (!pending) return;
    // Keyboard taps (y === null) always target the lowest pending row.
    let row: Row | undefined = pending;
    if (y !== null)
      row = s.rows.find((r) => {
        const top = rowTop(r.index, s.scroll, H);
        return y >= top && y < top + ROW_H;
      });
    if (!row) return;
    if (row.tapped) return;
    if (row.lane !== lane) {
      failAt(lane, row.index, 'white');
      return;
    }
    // Only the lowest pending tile can be tapped (keeps rhythm honest).
    if (row !== pending) return;
    row.tapped = true;
    s.started = true;
    s.score += 1;
    api.setScore(s.score);
    api.sfx(MELODY[(s.score - 1) % MELODY.length]!);
    const top = rowTop(row.index, s.scroll, H);
    fx.current.particles.burst(lane * LANE_W + LANE_W / 2, top + ROW_H / 2, {
      count: 8,
      colors: [sparkColor, '#e2e8f0'],
      speed: 120,
      life: 0.35,
    });
    if (s.score % 25 === 0) {
      api.addCoins(1);
      fx.current.floaters.add(`${s.score}!`, W / 2, H * 0.35, '#fde047', 34, 1);
      s.flash = 1;
    }
  };

  useKeyDown((code) => {
    const lane = KEYS[code];
    if (lane === undefined) return false;
    tap(lane, null);
  }, !paused);

  const onDown = (p: StagePointer) => tap(Math.min(LANES - 1, Math.max(0, Math.floor(p.x / LANE_W))), p.y);

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters } = fx.current;
    s.time += dt;
    s.flash = Math.max(0, s.flash - dt * 2);

    if (s.started && !s.fail) {
      s.scroll += speedForScore(s.score) * tempo * dt;
      ensureRows();
      const missed = s.rows.find((r) => !r.tapped && rowTop(r.index, s.scroll, H) > H);
      if (missed) {
        failAt(missed.lane, missed.index, 'missed');
        s.rewind = rowTop(missed.index, s.scroll, H) - (H - ROW_H * 1.2);
      }
    }
    if (s.fail) {
      if (s.rewind > 0) {
        const step = Math.min(s.rewind, 900 * dt);
        s.scroll -= step;
        s.rewind -= step;
      }
      s.failTimer -= dt;
      if (s.failTimer <= 0 && !s.ended && !s.waiting) {
        s.waiting = true;
        continueGate(
          () => {
            // Resume from the next pending tile; the song waits for your tap.
            s.fail = null;
            s.rewind = 0;
            s.started = false;
            s.waiting = false;
            fx.current.floaters.add('Tap to resume', W / 2, H * 0.4, '#0ea5e9', 24, 1.4);
          },
          () => {
            s.ended = true;
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Top speed', value: `${(speedForScore(s.score) / ROW_H).toFixed(1)} tiles/s` },
              ],
            });
          },
        );
      }
    }
    particles.update(dt);
    floaters.update(dt);

    // ---- render
    const ctx = v.ctx;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e2e8f0';
    for (let i = 1; i < LANES; i++) ctx.fillRect(i * LANE_W - 0.5, 0, 1, H);

    for (const r of s.rows) {
      const top = rowTop(r.index, s.scroll, H);
      if (top > H || top + ROW_H < 0) continue;
      const x = r.lane * LANE_W;
      const failing =
        s.fail && s.fail.index === r.index && s.fail.lane === r.lane && s.fail.kind === 'missed';
      const blink = failing && Math.sin(s.time * 24) > 0;
      if (r.tapped) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
        ctx.fillRect(x + 1, top + 1, LANE_W - 2, ROW_H - 2);
      } else {
        const g = ctx.createLinearGradient(0, top, 0, top + ROW_H);
        g.addColorStop(0, blink ? '#ef4444' : tileTop);
        g.addColorStop(1, blink ? '#b91c1c' : tileBottom);
        fillRoundRect(ctx, x + 2, top + 2, LANE_W - 4, ROW_H - 4, 6, g);
        if (r.index === 0 && !s.started)
          text(ctx, 'START', x + LANE_W / 2, top + ROW_H / 2, { size: 17, weight: 800, color: '#e2e8f0' });
      }
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, top + ROW_H - 0.5, W, 1);
    }
    if (s.fail?.kind === 'white') {
      const top = rowTop(s.fail.index, s.scroll, H);
      ctx.globalAlpha = 0.5 + Math.sin(s.time * 24) * 0.3;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(s.fail.lane * LANE_W, top, LANE_W, ROW_H);
      ctx.globalAlpha = 1;
    }
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(253, 224, 71, ${s.flash * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    text(ctx, String(s.score), W / 2, 50, {
      size: 44,
      weight: 850,
      color: '#ef4444',
      stroke: '#fff',
      strokeWidth: 6,
    });
  }, !paused);

  return <CanvasStage ref={view} width={W} height={H} label="Tile Tapper game area" onPointerDown={onDown} />;
}
