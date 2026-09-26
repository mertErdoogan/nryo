import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  circle,
  createContinueGate,
  hudPill,
  prompt,
  text,
  useGameLoop,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const GRAV = 820;

type Kind = 'apple' | 'orange' | 'melon' | 'kiwi' | 'lemon' | 'golden' | 'banana' | 'bomb';
const FRUIT: Record<Kind, { r: number; skin: string; flesh: string }> = {
  apple: { r: 24, skin: '#dc2626', flesh: '#fef3c7' },
  orange: { r: 24, skin: '#f97316', flesh: '#fdba74' },
  melon: { r: 34, skin: '#15803d', flesh: '#ef4444' },
  kiwi: { r: 20, skin: '#78350f', flesh: '#84cc16' },
  lemon: { r: 21, skin: '#facc15', flesh: '#fef9c3' },
  golden: { r: 22, skin: '#fbbf24', flesh: '#fef3c7' },
  banana: { r: 24, skin: '#fde047', flesh: '#fefce8' },
  bomb: { r: 22, skin: '#111827', flesh: '#111827' },
};

interface Fruit {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  cut: boolean;
}
interface Half {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  side: 1 | -1;
  angle: number;
}

export function FruitSlash({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const blade = 6 * (1 + 0.25 * lo.level('blade'));
  const maxLives = 3 + lo.level('life');
  const bananaChance = 0.02 + 0.015 * lo.level('frenzy');
  const goldenChance = 0.03 + 0.02 * lo.level('lucky');
  const fx = useRef({
    particles: new Particles(500, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    fruits: [] as Fruit[],
    halves: [] as Half[],
    trail: [] as { x: number; y: number; t: number }[],
    down: false,
    swipeHits: 0,
    swipeT: 0,
    lives: maxLives,
    score: 0,
    sliced: 0,
    bestCombo: 0,
    coins: 0,
    waveT: 1,
    elapsed: 0,
    slowmo: 0,
    grace: 0,
    dead: false,
    deadT: 0,
    started: false,
    clock: 0,
    splats: [] as { x: number; y: number; r: number; color: string; t: number }[],
  }).current;

  const launch = () => {
    const diff = Math.min(1, s.elapsed / 120);
    const n = rng.int(1, 2 + Math.round(diff * 3));
    for (let i = 0; i < n; i++) {
      let kind: Kind = rng.pick(['apple', 'orange', 'melon', 'kiwi', 'lemon'] as const);
      const r = rng.next();
      if (r < 0.08 + diff * 0.14 && s.elapsed > 6) kind = 'bomb';
      else if (r < 0.08 + diff * 0.14 + goldenChance) kind = 'golden';
      else if (r < 0.08 + diff * 0.14 + goldenChance + bananaChance) kind = 'banana';
      const x = rng.range(50, W - 50);
      s.fruits.push({
        kind,
        x,
        y: H + 30,
        vx: (W / 2 - x) * rng.range(0.25, 0.7),
        vy: -rng.range(700, 860),
        rot: 0,
        vr: rng.range(-3, 3),
        cut: false,
      });
    }
    s.waveT = Math.max(0.75, 1.9 - diff * 1.1) * rng.range(0.8, 1.2);
  };

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.down = true;
    s.swipeHits = 0;
    s.trail = [{ x: p.x, y: p.y, t: s.clock }];
  };
  const onMove = (p: StagePointer) => {
    if (!s.down || s.dead) return;
    const last = s.trail[s.trail.length - 1];
    s.trail.push({ x: p.x, y: p.y, t: s.clock });
    if (s.trail.length > 14) s.trail.shift();
    if (!last) return;
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    const len = Math.hypot(dx, dy);
    if (len < 3) return;
    for (const f of s.fruits) {
      if (f.cut) continue;
      const r = FRUIT[f.kind].r;
      const t = Math.max(0, Math.min(1, ((f.x - last.x) * dx + (f.y - last.y) * dy) / (len * len)));
      const d = Math.hypot(f.x - (last.x + dx * t), f.y - (last.y + dy * t));
      if (d < r + blade) slice(f, Math.atan2(dy, dx));
    }
  };
  const onUp = () => {
    s.down = false;
    endSwipe();
  };

  const endSwipe = () => {
    if (s.swipeHits >= 3) {
      const bonus = s.swipeHits;
      s.score += bonus;
      api.setScore(s.score);
      s.bestCombo = Math.max(s.bestCombo, s.swipeHits);
      fx.current.floaters.add(`${s.swipeHits} fruit combo! +${bonus}`, W / 2, 180, '#fde047', 22, 1.1);
      api.sfx('perfect');
    }
    s.swipeHits = 0;
  };

  const slice = (f: Fruit, angle: number) => {
    const { particles, shake, floaters } = fx.current;
    f.cut = true;
    if (f.kind === 'bomb') {
      shake.add(18);
      particles.burst(f.x, f.y, {
        count: 50,
        colors: ['#fde047', '#f97316', '#fff', '#111'],
        speed: 360,
        life: 0.8,
      });
      api.sfx('explode');
      api.haptic([100, 50, 100]);
      if (s.grace <= 0) die();
      return;
    }
    const info = FRUIT[f.kind];
    for (const side of [1, -1] as const)
      s.halves.push({
        kind: f.kind,
        x: f.x,
        y: f.y,
        vx: f.vx + Math.cos(angle + (side * Math.PI) / 2) * 90,
        vy: f.vy * 0.3 + Math.sin(angle + (side * Math.PI) / 2) * 90,
        rot: angle,
        vr: side * 3,
        side,
        angle,
      });
    particles.burst(f.x, f.y, {
      count: 18,
      colors: [info.flesh, info.skin],
      speed: 220,
      life: 0.6,
      gravity: 500,
    });
    s.splats.push({ x: f.x, y: f.y, r: info.r * 1.3, color: info.flesh, t: 0 });
    if (s.splats.length > 12) s.splats.shift();
    s.sliced += 1;
    s.swipeHits += 1;
    s.score += 1;
    api.setScore(s.score);
    api.sfx('swap');
    if (f.kind === 'golden') {
      s.coins += 3;
      api.addCoins(3);
      floaters.add('+3 coins', f.x, f.y - 20, '#fde047', 18);
      api.sfx('coin');
    } else if (f.kind === 'banana') {
      s.slowmo = 4;
      floaters.add('Slow-mo!', W / 2, 150, '#fef08a', 24, 1.2);
      api.sfx('powerup');
    }
  };

  const die = () => {
    if (s.dead) return;
    s.dead = true;
    s.deadT = 0.9;
  };

  const loseLife = (x: number) => {
    if (s.grace > 0) return;
    s.lives -= 1;
    fx.current.floaters.add('✖', x, H - 40, '#f87171', 28, 0.9);
    api.sfx('miss');
    api.haptic(40);
    if (s.lives <= 0) die();
  };

  useGameLoop((rawDt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += rawDt;
    const dt = rawDt * (s.slowmo > 0 ? 0.4 : 1);

    if (s.started && !s.dead) {
      s.elapsed += rawDt;
      s.slowmo = Math.max(0, s.slowmo - rawDt);
      s.grace = Math.max(0, s.grace - rawDt);
      s.waveT -= dt;
      if (s.waveT <= 0) launch();
      for (const f of s.fruits) {
        f.vy += GRAV * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rot += f.vr * dt;
      }
      for (const f of s.fruits)
        if (!f.cut && f.vy > 0 && f.y > H + 40 && f.kind !== 'bomb') {
          f.cut = true;
          if (f.kind !== 'banana' && f.kind !== 'golden') loseLife(f.x);
        }
      s.fruits = s.fruits.filter((f) => !f.cut && f.y < H + 60);
      if (s.down && s.clock - (s.trail[s.trail.length - 1]?.t ?? 0) > 0.25) endSwipe();
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= rawDt;
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.dead = false;
            s.lives = Math.max(1, Math.min(maxLives, 2));
            s.fruits = [];
            s.grace = 1.5;
            s.waveT = 1;
          },
          () =>
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Fruit sliced', value: String(s.sliced) },
                { label: 'Best combo', value: String(s.bestCombo) },
                { label: 'Coins', value: String(s.coins) },
              ],
            }),
        );
    }
    for (const h of s.halves) {
      h.vy += GRAV * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += h.vr * dt;
    }
    s.halves = s.halves.filter((h) => h.y < H + 80);
    for (const sp of s.splats) sp.t += rawDt;
    s.splats = s.splats.filter((sp) => sp.t < 3);
    particles.update(dt);
    floaters.update(rawDt);
    shake.update(rawDt);

    // ---------- render ----------
    ctx.fillStyle = '#422006';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#4a2508';
    for (let y = 0; y < H; y += 80) ctx.fillRect(0, y, W, 38);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let y = 38; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (const sp of s.splats) {
      ctx.globalAlpha = 0.35 * (1 - sp.t / 3);
      circle(ctx, sp.x, sp.y, sp.r, sp.color);
    }
    ctx.globalAlpha = 1;
    if (s.slowmo > 0) {
      ctx.fillStyle = 'rgba(56,189,248,0.12)';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.save();
    shake.apply(ctx);
    const drawFruit = (kind: Kind, x: number, y: number, rot: number) => {
      const info = FRUIT[kind];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      if (kind === 'bomb') {
        circle(ctx, 0, 0, info.r, '#111827');
        circle(ctx, -7, -7, 5, '#374151');
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -info.r);
        ctx.quadraticCurveTo(8, -info.r - 12, 14, -info.r - 8);
        ctx.stroke();
        circle(ctx, 14, -info.r - 8, 4 + Math.sin(s.clock * 30) * 1.5, '#fde047');
      } else if (kind === 'banana') {
        ctx.strokeStyle = info.skin;
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -10, 22, 0.3, Math.PI - 0.3);
        ctx.stroke();
      } else {
        circle(ctx, 0, 0, info.r, info.skin);
        if (kind === 'melon') {
          ctx.strokeStyle = '#166534';
          ctx.lineWidth = 3;
          for (const off of [-12, 0, 12]) {
            ctx.beginPath();
            ctx.ellipse(off, 0, 4, info.r - 3, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        circle(ctx, -info.r * 0.35, -info.r * 0.35, info.r * 0.25, 'rgba(255,255,255,0.35)');
        if (kind === 'apple') {
          ctx.fillStyle = '#65a30d';
          ctx.fillRect(-1, -info.r - 6, 3, 8);
        }
        if (kind === 'golden') {
          ctx.strokeStyle = '#fff7ed';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, info.r + 4 + Math.sin(s.clock * 8) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    };
    for (const f of s.fruits) drawFruit(f.kind, f.x, f.y, f.rot);
    for (const h of s.halves) {
      const info = FRUIT[h.kind];
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.beginPath();
      ctx.arc(0, 0, info.r, h.side > 0 ? 0 : Math.PI, h.side > 0 ? Math.PI : Math.PI * 2);
      ctx.fillStyle = info.skin;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, info.r - 3, h.side > 0 ? 0 : Math.PI, h.side > 0 ? Math.PI : Math.PI * 2);
      ctx.fillStyle = info.flesh;
      ctx.fill();
      ctx.restore();
    }
    particles.draw(ctx);
    // blade trail
    const recent = s.trail.filter((p) => s.clock - p.t < 0.15);
    if (recent.length > 1) {
      const [c0, c1] = lo.skin.colors;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [width, color, alpha] of [
        [blade * 2.4, c1, 0.35],
        [blade * 0.9, c0, 1],
      ] as const) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        recent.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    floaters.draw(ctx);
    ctx.restore();

    text(ctx, String(s.score), 20, 34, {
      size: 30,
      weight: 900,
      align: 'left',
      color: '#fde047',
      stroke: 'rgba(0,0,0,0.4)',
    });
    for (let i = 0; i < maxLives; i++)
      text(ctx, '✖', W - 24 - i * 26, 30, {
        size: 22,
        weight: 900,
        color: i < maxLives - s.lives ? '#ef4444' : 'rgba(255,255,255,0.25)',
      });
    hudPill(ctx, W - 10, 52, String(s.coins), { align: 'right', coin: true, size: 13 });
    if (!s.started) prompt(ctx, 'Swipe to slice!', W / 2, H * 0.45, s.clock, 22);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Fruit Slash game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
