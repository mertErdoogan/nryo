import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  circle,
  createContinueGate,
  fillRoundRect,
  hudPill,
  prompt,
  text,
  useGameLoop,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const ROWS = [
  { y: 250, scale: 0.45 },
  { y: 330, scale: 0.7 },
  { y: 450, scale: 1 },
];
const TARGET_R = 26;
const SCOPE_R = 92;
const ROUND_TIME = 60;

type Kind = 'red' | 'gold' | 'blue';
interface Target {
  kind: Kind;
  x: number;
  row: number;
  life: number;
  t: number;
  vx: number;
  hit: boolean;
  down: number;
}

const PERKS: Record<string, { sway?: number; mag?: number; reload?: number; points?: number }> = {
  marksman: { sway: 0.2 },
  tactical: { mag: 2 },
  arctic: { sway: 0.2, reload: 0.2 },
  gold: { points: 0.1 },
};

export function SniperRange({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const perk = PERKS[lo.skin.id] ?? {};
  const sway = 14 * Math.pow(0.85, lo.level('steady')) * (1 - (perk.sway ?? 0));
  const zoom = 2 + 0.5 * lo.level('zoom');
  const magSize = 5 + 2 * lo.level('mag') + (perk.mag ?? 0);
  const reloadTime = 1.7 * Math.pow(0.85, lo.level('reload')) * (1 - (perk.reload ?? 0));
  const pointMul = 1 + (perk.points ?? 0);
  const fx = useRef({
    particles: new Particles(200, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    targets: [] as Target[],
    holes: [] as { x: number; y: number; t: number }[],
    spawnT: 0.5,
    time: ROUND_TIME,
    elapsed: 0,
    ammo: magSize,
    reload: 0,
    aiming: null as null | { id: number; px: number; py: number; offset: number },
    score: 0,
    hits: 0,
    shots: 0,
    bullseyes: 0,
    coins: 0,
    recoil: 0,
    over: false,
    started: false,
    clock: 0,
  }).current;

  const spawn = () => {
    const diff = Math.min(1, s.elapsed / 90);
    const row = rng.int(0, 2);
    const r = rng.next();
    const kind: Kind = r < 0.12 ? 'gold' : r < 0.12 + 0.12 + diff * 0.1 ? 'blue' : 'red';
    const moving = rng.chance(0.2 + diff * 0.4);
    s.targets.push({
      kind,
      x: rng.range(40, W - 40),
      row,
      life: (kind === 'gold' ? 1.6 : 2.8) * (1 - diff * 0.4),
      t: 0,
      vx: moving ? rng.range(40, 90) * (rng.chance(0.5) ? 1 : -1) * ROWS[row]!.scale : 0,
      hit: false,
      down: 0,
    });
    s.spawnT = Math.max(0.45, 1.1 - diff * 0.6) * rng.range(0.7, 1.3);
  };

  const rise = (t: Target) => {
    if (t.hit) return Math.max(0, 1 - t.down * 4);
    const up = Math.min(1, t.t * 5);
    const downPhase = t.t > t.life ? Math.max(0, 1 - (t.t - t.life) * 5) : 1;
    return Math.min(up, downPhase);
  };
  const centre = (t: Target) => {
    const row = ROWS[t.row]!;
    return { x: t.x, y: row.y - 44 * row.scale * rise(t), r: TARGET_R * row.scale };
  };

  const swayOffset = () => ({
    x: Math.sin(s.clock * 1.3) * sway + Math.sin(s.clock * 3.1) * sway * 0.3,
    y: Math.cos(s.clock * 1.7) * sway * 0.8,
  });
  const scopeCentre = () => {
    const a = s.aiming!;
    return { x: a.px, y: clamp(a.py - a.offset, SCOPE_R * 0.5, H) };
  };

  const onDown = (p: StagePointer) => {
    if (s.over) return;
    s.started = true;
    s.aiming = { id: p.id, px: p.x, py: p.y, offset: p.type === 'mouse' ? 0 : 110 };
  };
  const onMove = (p: StagePointer) => {
    if (s.aiming?.id === p.id) {
      s.aiming.px = p.x;
      s.aiming.py = p.y;
    }
  };
  const onUp = (p: StagePointer) => {
    if (s.aiming?.id !== p.id) return;
    const c = scopeCentre();
    s.aiming = null;
    fire(c.x, c.y);
  };

  const fire = (sx: number, sy: number) => {
    const { floaters, shake, particles } = fx.current;
    if (s.reload > 0) {
      api.sfx('error');
      return;
    }
    const sw = swayOffset();
    const ax = sx + sw.x;
    const ay = sy + sw.y;
    s.shots += 1;
    s.ammo -= 1;
    s.recoil = 1;
    shake.add(4);
    api.sfx('shoot');
    api.haptic(20);
    // nearest row first
    const hitTarget = [...s.targets]
      .filter((t) => !t.hit && rise(t) > 0.6)
      .sort((a, b) => b.row - a.row)
      .find((t) => {
        const c = centre(t);
        return Math.hypot(c.x - ax, c.y - ay) < c.r;
      });
    if (hitTarget) {
      const c = centre(hitTarget);
      const acc = 1 - Math.hypot(c.x - ax, c.y - ay) / c.r;
      hitTarget.hit = true;
      particles.burst(ax, ay, { count: 14, colors: ['#fff', '#fde047'], speed: 140, life: 0.35 });
      if (hitTarget.kind === 'blue') {
        s.score = Math.max(0, s.score - 200);
        s.time = Math.max(0, s.time - 3);
        floaters.add('Friendly! −200 −3s', c.x, c.y - 30, '#93c5fd', 16);
        api.sfx('error');
      } else {
        const bull = acc > 0.8;
        const distBonus = hitTarget.row === 0 ? 1.6 : hitTarget.row === 1 ? 1.25 : 1;
        const pts = Math.round(
          (50 + 100 * acc) * distBonus * (hitTarget.kind === 'gold' ? 2 : 1) * (bull ? 1.5 : 1) * pointMul,
        );
        s.score += pts;
        s.hits += 1;
        if (bull) s.bullseyes += 1;
        floaters.add(
          bull ? `BULLSEYE +${pts}` : `+${pts}`,
          c.x,
          c.y - 30,
          bull ? '#fde047' : '#fff',
          bull ? 18 : 15,
        );
        if (hitTarget.kind === 'gold') {
          s.coins += 3;
          api.addCoins(3);
          api.sfx('coin');
        } else api.sfx(bull ? 'perfect' : 'hit');
        if (bull) s.time += 1;
      }
      api.setScore(s.score);
    } else {
      s.holes.push({ x: ax, y: ay, t: 0 });
      api.sfx('miss');
    }
    if (s.ammo <= 0) {
      s.reload = reloadTime;
      api.sfx('tick');
    }
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    s.recoil = Math.max(0, s.recoil - dt * 4);

    if (s.started && !s.over) {
      s.elapsed += dt;
      s.time -= dt;
      s.spawnT -= dt;
      if (s.spawnT <= 0) spawn();
      if (s.reload > 0) {
        s.reload -= dt;
        if (s.reload <= 0) {
          s.reload = 0;
          s.ammo = magSize;
          api.sfx('click');
        }
      }
      for (const t of s.targets) {
        t.t += dt;
        if (t.hit) t.down += dt;
        else {
          t.x += t.vx * dt;
          if (t.x < 30 || t.x > W - 30) t.vx = -t.vx;
        }
      }
      s.targets = s.targets.filter((t) => (t.hit ? t.down < 0.3 : t.t < t.life + 0.25));
      for (const h of s.holes) h.t += dt;
      s.holes = s.holes.filter((h) => h.t < 1.5);
      if (s.time <= 0) {
        s.time = 0;
        s.over = true;
        s.aiming = null;
        api.sfx('gameover');
        continueGate(
          () => {
            s.over = false;
            s.time = 20;
            floaters.add('+20 seconds', W / 2, 160, '#86efac', 24, 1.2);
          },
          () =>
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Accuracy', value: s.shots ? `${Math.round((s.hits / s.shots) * 100)}%` : '—' },
                { label: 'Bullseyes', value: String(s.bullseyes) },
                { label: 'Coins', value: String(s.coins) },
              ],
            }),
        );
      }
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- scene ----------
    const drawScene = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, 260);
      sky.addColorStop(0, '#7dd3fc');
      sky.addColorStop(1, '#fde68a');
      ctx.fillStyle = sky;
      ctx.fillRect(-W, -H, W * 3, 260 + H);
      ctx.fillStyle = '#a3a3a3';
      ctx.beginPath();
      ctx.moveTo(-W, 240);
      for (let x = -W; x <= W * 2; x += 60) ctx.lineTo(x, 200 + Math.sin(x * 0.02) * 20);
      ctx.lineTo(W * 2, 260);
      ctx.fill();
      const bands = ['#ca8a04', '#a16207', '#854d0e', '#713f12'];
      bands.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(-W, 240 + i * 70 + (i === 0 ? 0 : 20), W * 3, H * 2);
      });
      for (const row of ROWS) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(-W, row.y, W * 3, 6 * row.scale);
      }
      for (const t of [...s.targets].sort((a, b) => a.row - b.row)) {
        const c = centre(t);
        const row = ROWS[t.row]!;
        ctx.fillStyle = '#57534e';
        ctx.fillRect(c.x - 2 * row.scale, c.y, 4 * row.scale, row.y - c.y);
        const rings =
          t.kind === 'blue'
            ? ['#fff', '#2563eb', '#fff', '#2563eb']
            : t.kind === 'gold'
              ? ['#fef3c7', '#f59e0b', '#fef3c7', '#b45309']
              : ['#fff', '#dc2626', '#fff', '#dc2626'];
        rings.forEach((col, i) => circle(ctx, c.x, c.y, c.r * (1 - i * 0.24), t.hit ? '#a8a29e' : col));
        if (t.kind === 'blue') text(ctx, '✋', c.x, c.y + 1, { size: c.r * 0.7 });
      }
      for (const h of s.holes) circle(ctx, h.x, h.y, 2.5, `rgba(0,0,0,${0.6 * (1 - h.t / 1.5)})`);
    };

    ctx.save();
    shake.apply(ctx);
    drawScene();
    ctx.restore();

    // bench and rifle silhouette
    const [r0, r1, r2] = lo.skin.colors;
    ctx.fillStyle = '#44403c';
    ctx.fillRect(0, H - 70, W, 70);
    ctx.save();
    ctx.translate(W - 70, H - 40 + s.recoil * 10);
    ctx.rotate(-0.5 - s.recoil * 0.1);
    fillRoundRect(ctx, -10, -120, 14, 150, 5, r0);
    fillRoundRect(ctx, -8, -170, 8, 60, 3, r1);
    fillRoundRect(ctx, -16, -100, 22, 36, 6, r2);
    ctx.restore();

    // scope
    if (s.aiming) {
      const c = scopeCentre();
      const sw = swayOffset();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.beginPath();
      ctx.arc(c.x, c.y, SCOPE_R, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(c.x - sw.x * zoom, c.y - sw.y * zoom);
      ctx.scale(zoom, zoom);
      ctx.translate(-c.x, -c.y);
      drawScene();
      ctx.restore();
      ctx.strokeStyle = '#0a0a0a';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(c.x, c.y, SCOPE_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c.x - SCOPE_R, c.y);
      ctx.lineTo(c.x + SCOPE_R, c.y);
      ctx.moveTo(c.x, c.y - SCOPE_R);
      ctx.lineTo(c.x, c.y + SCOPE_R);
      ctx.stroke();
      circle(ctx, c.x, c.y, 2, '#dc2626');
      if (s.reload > 0)
        text(ctx, 'RELOADING', c.x, c.y + SCOPE_R - 22, { size: 12, weight: 900, color: '#fca5a5' });
    }
    particles.draw(ctx);
    floaters.draw(ctx);

    // HUD
    const low = s.time < 10;
    fillRoundRect(ctx, W / 2 - 44, 10, 88, 36, 12, low ? 'rgba(220,38,38,0.75)' : 'rgba(0,0,0,0.5)');
    text(ctx, s.time.toFixed(1), W / 2, 29, { size: 20, weight: 900 });
    hudPill(ctx, W - 10, 12, String(s.coins), { align: 'right', coin: true, size: 13 });
    for (let i = 0; i < magSize; i++)
      fillRoundRect(
        ctx,
        14 + i * 12,
        H - 52,
        7,
        26,
        3,
        i < s.ammo && s.reload <= 0 ? '#fcd34d' : 'rgba(255,255,255,0.2)',
      );
    if (s.reload > 0) {
      text(ctx, 'Reloading…', 14, H - 64, { size: 12, align: 'left', color: '#fca5a5', weight: 800 });
      fillRoundRect(ctx, 14, H - 20, 110 * (1 - s.reload / reloadTime), 5, 2, '#fca5a5');
    }
    if (!s.started) prompt(ctx, 'Hold to aim · release to fire', W / 2, H * 0.6, s.clock, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Sniper Range game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      cursor="crosshair"
    />
  );
}
