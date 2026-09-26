import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
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
import type { CanvasView } from '../../engine';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const BH = 40;
const GROUND = 600;
const ROPE = 150;

interface Floor {
  x: number;
  perfect: boolean;
}

export function TowerCrane({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const swingMul = Math.pow(0.9, lo.level('steady'));
  const BW = 92 * (1 + 0.08 * lo.level('wide'));
  const maxLives = 3 + lo.level('life');
  const perfectWin = 6 + 3 * lo.level('perfect');
  const [wall, window_, trim] = lo.skin.colors;
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    floors: [{ x: W / 2, perfect: true }] as Floor[],
    swingT: 0,
    falling: null as null | { x: number; y: number; vx: number; vy: number },
    tumbling: [] as { x: number; y: number; vx: number; vy: number; rot: number; vr: number }[],
    lives: maxLives,
    combo: 0,
    score: 0,
    perfects: 0,
    camY: 0,
    started: false,
    over: false,
    clock: 0,
    swayT: 0,
  }).current;

  const topY = () => GROUND - s.floors.length * BH;
  const sway = () => Math.sin(s.swayT) * Math.min(26, s.floors.length * 0.7);
  const hook = () => {
    const speed = (1.7 + Math.min(1.4, s.floors.length * 0.035)) * swingMul;
    const amp = 0.62;
    const a = Math.sin(s.swingT * speed) * amp;
    const anchorY = s.camY + 30;
    return {
      x: W / 2 + Math.sin(a) * ROPE,
      y: anchorY + Math.cos(a) * ROPE,
      vx: Math.cos(s.swingT * speed) * amp * speed * ROPE * Math.cos(a),
      anchorY,
    };
  };

  const drop = () => {
    s.started = true;
    if (s.falling || s.over) return;
    const h = hook();
    s.falling = { x: h.x, y: h.y + 10, vx: h.vx * 0.9, vy: 0 };
    api.sfx('swap');
  };
  useKeyDown((code) => {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowDown') drop();
  }, !paused);

  const drawFloor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, lit: boolean) => {
    fillRoundRect(ctx, x - w / 2, y, w, BH, 3, wall);
    ctx.fillStyle = shade(wall, -0.2);
    ctx.fillRect(x - w / 2, y + BH - 5, w, 5);
    const n = Math.max(2, Math.round(w / 30));
    for (let i = 0; i < n; i++) {
      const wx = x - w / 2 + ((i + 0.5) * w) / n - 6;
      ctx.fillStyle = lit && (i + Math.floor(y)) % 3 !== 0 ? window_ : shade(window_, -0.35);
      ctx.fillRect(wx, y + 9, 12, 16);
      ctx.fillStyle = trim;
      ctx.fillRect(wx - 1, y + 25, 14, 2);
    }
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    s.swingT += dt;
    s.swayT += dt * 1.1;
    const targetCam = Math.min(0, topY() - 380);
    s.camY += (targetCam - s.camY) * Math.min(1, dt * 3);

    if (s.falling) {
      const f = s.falling;
      f.vy += 1500 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const ty = topY() - BH;
      if (f.y >= ty) {
        const top = s.floors[s.floors.length - 1]!;
        const towerX = top.x + sway();
        const dx = f.x - towerX;
        s.falling = null;
        if (Math.abs(dx) < BW * 0.55) {
          const perfect = Math.abs(dx) <= perfectWin;
          const x = perfect ? top.x : top.x + dx;
          s.floors.push({ x, perfect });
          if (perfect) {
            s.combo += 1;
            s.perfects += 1;
            const pts = 10 + 5 * Math.min(10, s.combo);
            s.score += pts;
            floaters.add(
              s.combo > 1 ? `PERFECT ×${s.combo}` : 'PERFECT',
              W / 2,
              ty - s.camY - 20,
              '#fde047',
              20,
            );
            particles.burst(towerX, ty - s.camY + BH, {
              count: 18,
              colors: ['#fde047', '#fff'],
              speed: 160,
              life: 0.5,
            });
            api.sfx('perfect');
          } else {
            s.combo = 0;
            s.score += 10;
            api.sfx('hit');
          }
          shake.add(3);
          api.haptic(15);
          api.setScore(s.score);
          if (s.floors.length % 10 === 1 && s.floors.length > 1) {
            api.addCoins(3);
            floaters.add(`${s.floors.length - 1} floors! +3 coins`, W / 2, 200, '#86efac', 18, 1.2);
            api.sfx('levelup');
          }
        } else {
          s.combo = 0;
          s.lives -= 1;
          s.tumbling.push({
            x: f.x,
            y: ty,
            vx: Math.sign(dx) * 120,
            vy: -120,
            rot: 0,
            vr: Math.sign(dx) * 4,
          });
          shake.add(8);
          api.sfx('miss');
          api.haptic([40, 30, 40]);
          if (s.lives <= 0) {
            s.over = true;
            continueGate(
              () => {
                s.over = false;
                s.lives = 2;
              },
              () =>
                api.gameOver({
                  score: s.score,
                  stats: [
                    { label: 'Floors', value: String(s.floors.length - 1) },
                    { label: 'Perfect drops', value: String(s.perfects) },
                  ],
                }),
            );
          }
        }
      }
    }
    for (const t of s.tumbling) {
      t.vy += 1400 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.rot += t.vr * dt;
    }
    s.tumbling = s.tumbling.filter((t) => t.y - s.camY < H + 100);
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    const heightPct = Math.min(1, s.floors.length / 80);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, heightPct > 0.5 ? '#0f172a' : '#1e3a8a');
    sky.addColorStop(1, heightPct > 0.5 ? '#312e81' : '#7dd3fc');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 5; i++) {
      const cy = ((i * 170 - s.camY * 0.3) % (H + 100)) - 50;
      ctx.beginPath();
      ctx.ellipse((i * 131) % W, cy, 40, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    shake.apply(ctx);
    ctx.translate(0, -s.camY);
    // city backdrop + ground
    ctx.fillStyle = 'rgba(15,23,42,0.35)';
    for (let i = 0; i < 9; i++) ctx.fillRect(i * 44 - 10, GROUND - 60 - ((i * 37) % 90), 38, 200);
    ctx.fillStyle = '#3f6212';
    ctx.fillRect(0, GROUND, W, 200);
    const sw = sway();
    s.floors.forEach((f, i) => {
      const lean = sw * (i / Math.max(1, s.floors.length - 1));
      drawFloor(ctx, f.x + lean, GROUND - (i + 1) * BH, i === 0 ? BW + 20 : BW, true);
    });
    // crane
    const h = hook();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, h.anchorY - 14, W, 10);
    ctx.fillStyle = '#a16207';
    for (let x = 0; x < W; x += 20) ctx.fillRect(x, h.anchorY - 14, 3, 10);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, h.anchorY - 4);
    ctx.lineTo(h.x, h.y);
    ctx.stroke();
    if (!s.falling && !s.over) drawFloor(ctx, h.x, h.y + 6, BW, false);
    if (s.falling) drawFloor(ctx, s.falling.x, s.falling.y, BW, false);
    for (const t of s.tumbling) {
      ctx.save();
      ctx.translate(t.x, t.y + BH / 2);
      ctx.rotate(t.rot);
      drawFloor(ctx, 0, -BH / 2, BW, false);
      ctx.restore();
    }
    ctx.restore();
    particles.draw(ctx);
    floaters.draw(ctx);

    text(ctx, `${s.floors.length - 1}`, W / 2, 80, {
      size: 40,
      weight: 900,
      color: '#fff',
      stroke: 'rgba(0,0,0,0.3)',
      strokeWidth: 6,
    });
    text(ctx, 'floors', W / 2, 108, { size: 12, weight: 700, color: '#e0f2fe' });
    text(ctx, '❤️'.repeat(Math.max(0, s.lives)), 12, 44, { size: 15, align: 'left' });
    hudPill(ctx, W - 10, 30, String(s.score), { align: 'right', size: 13, color: '#fde047' });
    if (!s.started) prompt(ctx, 'Tap to drop the floor', W / 2, H * 0.55, s.clock, 20);
  }, !paused);

  return <CanvasStage ref={view} width={W} height={H} label="Tower Crane game area" onPointerDown={drop} />;
}
