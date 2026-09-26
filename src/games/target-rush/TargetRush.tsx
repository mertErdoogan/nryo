import { useRef } from 'react';
import { CanvasStage, FloatingText, Particles, Shake, useGameLoop, useSeededRng } from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, prompt, text } from '../../engine/draw';
import { dist, TAU } from '../../lib/math';
import type { GameProps } from '../../platform/types';
import { hitPoints, lifeFor, radiusAt, sizeFor, spawnInterval, type Target } from './logic';

const H = 640;
const LIVES = 5;

export function TargetRush({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const fx = useRef({ particles: new Particles(500, rng.next), floaters: new FloatingText(), shake: new Shake(rng.next) });
  const s = useRef({
    targets: [] as Target[],
    rings: [] as { x: number; y: number; r: number; a: number; color: string }[],
    elapsed: 0,
    spawn: 0.4,
    started: false,
    lives: LIVES,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    shots: 0,
    bullseyes: 0,
    over: false,
    overTimer: 0,
    ended: false,
    time: 0,
    aim: { x: -100, y: -100 },
  }).current;

  const loseLife = (x: number, y: number) => {
    s.lives -= 1;
    s.combo = 0;
    fx.current.shake.add(6);
    fx.current.floaters.add('−♥', x, y, '#f87171', 20, 0.8);
    api.sfx('miss');
    api.haptic(50);
    if (s.lives <= 0 && !s.over) {
      s.over = true;
      s.overTimer = 0.8;
    }
  };

  const shoot = (p: StagePointer) => {
    s.aim = { x: p.x, y: p.y };
    if (s.over) return;
    if (!s.started) {
      s.started = true;
      return;
    }
    s.shots += 1;
    // Prefer the target whose center is closest (handles overlaps fairly).
    let best: Target | null = null;
    let bestD = Infinity;
    for (const t of s.targets) {
      const r = radiusAt(t);
      const d = dist(p.x, p.y, t.x, t.y);
      if (d <= r + 4 && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    const { particles, floaters } = fx.current;
    if (!best) {
      s.combo = 0;
      api.sfx('tick');
      return;
    }
    s.targets = s.targets.filter((t) => t !== best);
    if (best.kind === 'decoy') {
      particles.burst(best.x, best.y, { count: 20, colors: ['#ef4444', '#fca5a5'], speed: 220, life: 0.5 });
      loseLife(best.x, best.y);
      api.sfx('explode');
      return;
    }
    const r = Math.max(1, radiusAt(best));
    const nd = bestD / r;
    s.combo += 1;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.hits += 1;
    const pts = hitPoints(best.kind, nd, s.combo);
    s.score += pts;
    api.setScore(s.score);
    const bull = nd < 0.25 && best.kind === 'normal';
    if (bull) s.bullseyes += 1;
    floaters.add(bull ? `Bullseye +${pts}` : `+${pts}`, best.x, best.y - 10, best.kind === 'gold' ? '#fde047' : bull ? '#86efac' : '#fff', bull ? 18 : 16, 0.7);
    particles.burst(best.x, best.y, {
      count: best.kind === 'gold' ? 26 : 14,
      colors: best.kind === 'gold' ? ['#fde047', '#fff'] : ['#f87171', '#fff', '#fecaca'],
      speed: 200,
      life: 0.45,
    });
    s.rings.push({ x: best.x, y: best.y, r, a: 1, color: best.kind === 'gold' ? '#fde047' : '#fff' });
    api.sfx(best.kind === 'gold' ? 'coin' : bull ? 'perfect' : 'hit');
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const W = v.width;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;

    if (s.started && !s.over) {
      s.elapsed += dt;
      s.spawn -= dt;
      if (s.spawn <= 0) {
        s.spawn = spawnInterval(s.elapsed) * rng.range(0.7, 1.2);
        const maxR = sizeFor(s.elapsed);
        const roll = rng.next();
        const kind = s.elapsed > 8 && roll < 0.12 ? 'decoy' : roll > 0.94 ? 'gold' : 'normal';
        s.targets.push({
          x: rng.range(maxR + 10, W - maxR - 10),
          y: rng.range(maxR + 60, H - maxR - 20),
          age: 0,
          life: lifeFor(s.elapsed) * (kind === 'gold' ? 0.7 : kind === 'decoy' ? 1.2 : 1),
          maxR: kind === 'gold' ? maxR * 0.7 : maxR,
          kind,
        });
      }
      for (const t of s.targets) t.age += dt;
      const expired = s.targets.filter((t) => t.age >= t.life);
      s.targets = s.targets.filter((t) => t.age < t.life);
      for (const t of expired) if (t.kind !== 'decoy') loseLife(t.x, t.y);
    }
    if (s.over && !s.ended) {
      s.overTimer -= dt;
      if (s.overTimer <= 0) {
        s.ended = true;
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Accuracy', value: s.shots ? `${Math.round((s.hits / s.shots) * 100)}%` : '—' },
            { label: 'Bullseyes', value: String(s.bullseyes) },
            { label: 'Best combo', value: String(s.bestCombo) },
          ],
        });
      }
    }
    for (const r of s.rings) {
      r.r += 90 * dt;
      r.a -= dt * 3;
    }
    s.rings = s.rings.filter((r) => r.a > 0);
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, Math.max(W, H));
    bg.addColorStop(0, '#1f2937');
    bg.addColorStop(1, '#0b0f17');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.save();
    shake.apply(ctx);
    for (const t of s.targets) {
      const r = radiusAt(t);
      if (r <= 0.5) continue;
      if (t.kind === 'decoy') {
        circle(ctx, t.x, t.y, r, '#7f1d1d');
        circle(ctx, t.x, t.y, r * 0.8, '#dc2626');
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(2, r * 0.14);
        ctx.lineCap = 'round';
        const k = r * 0.35;
        ctx.beginPath();
        ctx.moveTo(t.x - k, t.y - k);
        ctx.lineTo(t.x + k, t.y + k);
        ctx.moveTo(t.x + k, t.y - k);
        ctx.lineTo(t.x - k, t.y + k);
        ctx.stroke();
        continue;
      }
      const colors = t.kind === 'gold' ? ['#a16207', '#fde047', '#a16207', '#fef9c3'] : ['#f8fafc', '#ef4444', '#f8fafc', '#ef4444'];
      colors.forEach((c, i) => circle(ctx, t.x, t.y, r * (1 - i * 0.24), c));
      // lifetime arc
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.maxR + 6, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - t.age / t.life));
      ctx.stroke();
    }
    for (const r of s.rings) {
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.a;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    text(ctx, '♥'.repeat(Math.max(0, s.lives)) + '♡'.repeat(LIVES - Math.max(0, s.lives)), 16, 26, { size: 18, align: 'left', color: '#fb7185' });
    text(ctx, String(s.score), W - 16, 26, { size: 20, align: 'right', weight: 800 });
    if (s.combo >= 5) text(ctx, `Combo ×${Math.min(4, 1 + Math.floor(s.combo / 5))}`, W / 2, 26, { size: 15, color: '#fde047' });
    if (!s.started) {
      text(ctx, 'TARGET RUSH', W / 2, H * 0.4, { size: 30, weight: 850 });
      prompt(ctx, 'Tap to start', W / 2, H * 0.5, s.time, 20);
    }
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={360}
      height={H}
      fit="fill"
      minAspect={0.5625}
      maxAspect={1.6}
      label="Target Rush game area"
      onPointerDown={shoot}
      cursor="crosshair"
    />
  );
}
