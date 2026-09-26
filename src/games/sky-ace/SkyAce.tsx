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
  text,
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const H = 480;

type Kind = 'fighter' | 'bomber' | 'kamikaze' | 'balloon';
interface Enemy {
  kind: Kind;
  x: number;
  y: number;
  baseY: number;
  hp: number;
  maxHp: number;
  speed: number;
  t: number;
  fireT: number;
  flash: number;
}

function drawPlane(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  body: string,
  wing: string,
  trim: string,
  dir: 1 | -1,
  prop: number,
  scale = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * scale, scale);
  fillRoundRect(ctx, -26, -5, 50, 12, 6, body);
  ctx.fillStyle = wing;
  ctx.fillRect(-8, -18, 11, 40);
  ctx.fillRect(-5, -22, 5, 48);
  ctx.beginPath();
  ctx.moveTo(-26, -3);
  ctx.lineTo(-36, -12);
  ctx.lineTo(-36, 6);
  ctx.fill();
  ctx.fillStyle = trim;
  ctx.fillRect(20, -3, 6, 8);
  ctx.fillStyle = 'rgba(71,85,105,0.9)';
  ctx.fillRect(27, -12 + Math.sin(prop) * 10, 3, 24 - Math.abs(Math.sin(prop)) * 10);
  circle(ctx, 4, -8, 4, '#fcd34d');
  ctx.restore();
}

export function SkyAce({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const dmg = 10 * (1 + 0.2 * lo.level('damage'));
  const rate = 6 * (1 + 0.1 * lo.level('rate'));
  const maxHp = 3 + lo.level('hull');
  const wingman = lo.level('wingman');
  const fx = useRef({
    particles: new Particles(400, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    x: 90,
    y: H / 2,
    vy: 0,
    shots: [] as { x: number; y: number; vy: number }[],
    enemies: [] as Enemy[],
    bullets: [] as { x: number; y: number; vx: number; vy: number }[],
    items: [] as { x: number; y: number; kind: 'coin' | 'crate'; vy: number }[],
    clouds: [] as { x: number; y: number; w: number; speed: number }[],
    fireT: 0,
    double: 0,
    hp: maxHp,
    invuln: 0,
    spawnT: 1,
    time: 0,
    dist: 0,
    score: 0,
    kills: 0,
    coins: 0,
    dead: false,
    deadT: 0,
    started: false,
    clock: 0,
    drag: null as null | { id: number; px: number; py: number; sx: number; sy: number },
  }).current;
  if (s.clouds.length === 0)
    for (let i = 0; i < 8; i++)
      s.clouds.push({
        x: rng.range(0, 900),
        y: rng.range(20, H - 40),
        w: rng.range(50, 120),
        speed: rng.range(0.3, 0.9),
      });

  const width = () => view.current?.width ?? 360;

  const spawn = () => {
    const w = width();
    const diff = Math.min(1, s.time / 150);
    const r = rng.next();
    const kind: Kind =
      r < 0.1
        ? 'balloon'
        : r < 0.25 + diff * 0.1
          ? 'bomber'
          : r < 0.4 + diff * 0.15 && s.time > 20
            ? 'kamikaze'
            : 'fighter';
    const count = kind === 'fighter' ? rng.int(1, 2 + Math.round(diff * 3)) : 1;
    const baseY = rng.range(50, H - 60);
    for (let i = 0; i < count; i++) {
      const hp = { fighter: 20, bomber: 110, kamikaze: 14, balloon: 10 }[kind] * (1 + diff * 1.2);
      s.enemies.push({
        kind,
        x: w + 40 + i * 50,
        y: baseY + (kind === 'fighter' ? (i - count / 2) * 36 : 0),
        baseY: baseY + (kind === 'fighter' ? (i - count / 2) * 36 : 0),
        hp,
        maxHp: hp,
        speed: { fighter: 150, bomber: 60, kamikaze: 120, balloon: 50 }[kind] * (1 + diff * 0.4),
        t: rng.range(0, 6),
        fireT: rng.range(0.8, 2),
        flash: 0,
      });
    }
    s.spawnT = Math.max(0.6, 1.8 - diff * 1.1) * rng.range(0.8, 1.2);
  };

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.drag = { id: p.id, px: p.x, py: p.y, sx: s.x, sy: s.y };
  };
  const onMove = (p: StagePointer) => {
    if (s.drag?.id !== p.id) return;
    s.x = clamp(s.drag.sx + (p.x - s.drag.px) * 1.2, 40, width() * 0.55);
    s.y = clamp(s.drag.sy + (p.y - s.drag.py) * 1.2, 24, H - 24);
  };
  const onUp = (p: StagePointer) => {
    if (s.drag?.id === p.id) s.drag = null;
  };

  const hurt = () => {
    if (s.invuln > 0 || s.dead) return;
    s.hp -= 1;
    s.invuln = 1.3;
    fx.current.shake.add(8);
    api.sfx('hit');
    api.haptic(50);
    if (s.hp <= 0) {
      s.dead = true;
      s.deadT = 1;
      fx.current.particles.burst(s.x, s.y, {
        count: 40,
        colors: [lo.skin.colors[0], '#fde047', '#57534e'],
        speed: 240,
        life: 0.9,
      });
      api.sfx('explode');
    }
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const w = v.width;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    const mx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    const my = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (mx || my) {
      s.started = true;
      s.x = clamp(s.x + mx * 240 * dt, 40, w * 0.55);
      s.y = clamp(s.y + my * 260 * dt, 24, H - 24);
    }
    for (const c of s.clouds) {
      c.x -= (60 + c.speed * 80) * dt;
      if (c.x + c.w < -20) {
        c.x = w + rng.range(20, 200);
        c.y = rng.range(20, H - 40);
      }
    }

    if (s.started && !s.dead) {
      s.time += dt;
      s.dist += dt;
      s.invuln = Math.max(0, s.invuln - dt);
      s.double = Math.max(0, s.double - dt);
      s.spawnT -= dt;
      if (s.spawnT <= 0) spawn();
      s.fireT -= dt;
      if (s.fireT <= 0) {
        s.fireT = 1 / rate;
        if (s.double > 0)
          s.shots.push({ x: s.x + 30, y: s.y - 6, vy: -20 }, { x: s.x + 30, y: s.y + 6, vy: 20 });
        else s.shots.push({ x: s.x + 30, y: s.y, vy: 0 });
        if (wingman > 0) s.shots.push({ x: s.x + 10, y: s.y + 44, vy: 0 });
        if (wingman > 1) s.shots.push({ x: s.x + 10, y: s.y - 44, vy: 0 });
      }
      for (const sh of s.shots) {
        sh.x += 700 * dt;
        sh.y += sh.vy * dt;
      }
      for (const e of s.enemies) {
        e.t += dt;
        e.flash = Math.max(0, e.flash - dt);
        if (e.kind === 'fighter') {
          e.x -= e.speed * dt;
          e.y = e.baseY + Math.sin(e.t * 2) * 40;
        } else if (e.kind === 'bomber' || e.kind === 'balloon') {
          e.x -= e.speed * dt;
          e.y = e.baseY + Math.sin(e.t) * 10;
        } else {
          e.x -= e.speed * dt * (e.t > 1.2 ? 2.6 : 0.6);
          if (e.t > 1.2) e.y += clamp(s.y - e.y, -200 * dt, 200 * dt);
        }
        if (e.kind === 'fighter' || e.kind === 'bomber') {
          e.fireT -= dt;
          if (e.fireT <= 0 && e.x < w - 20 && e.x > s.x + 60) {
            e.fireT = e.kind === 'bomber' ? 1.1 : rng.range(1.6, 3);
            const a = Math.atan2(s.y - e.y, s.x - e.x);
            const sp = 230;
            if (e.kind === 'bomber')
              for (const off of [-0.2, 0, 0.2])
                s.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a + off) * sp, vy: Math.sin(a + off) * sp });
            else s.bullets.push({ x: e.x - 20, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
          }
        }
        for (const sh of s.shots) {
          if (sh.x > w + 20) continue;
          const hw = e.kind === 'bomber' ? 40 : 26;
          if (Math.abs(sh.x - e.x) < hw && Math.abs(sh.y - e.y) < (e.kind === 'bomber' ? 22 : 14)) {
            sh.x = w + 100;
            e.hp -= dmg;
            e.flash = 0.05;
          }
        }
        if (Math.abs(e.x - s.x) < 34 && Math.abs(e.y - s.y) < 18 && e.kind !== 'balloon') {
          e.hp = 0;
          hurt();
        }
      }
      for (const e of s.enemies) {
        if (e.hp > 0) continue;
        s.kills += 1;
        const pts = { fighter: 50, bomber: 200, kamikaze: 60, balloon: 30 }[e.kind];
        s.score += pts;
        floaters.add(`+${pts}`, e.x, e.y - 20, '#fff', 14, 0.6);
        particles.burst(e.x, e.y, {
          count: 24,
          colors: ['#f97316', '#fde047', '#57534e'],
          speed: 200,
          life: 0.7,
        });
        api.sfx(e.kind === 'balloon' ? 'score' : 'explode');
        if (e.kind === 'balloon' || e.kind === 'bomber')
          for (let i = 0; i < (e.kind === 'bomber' ? 4 : 3); i++)
            s.items.push({ x: e.x + i * 10, y: e.y, kind: 'coin', vy: 30 });
        else if (rng.chance(0.07)) s.items.push({ x: e.x, y: e.y, kind: 'crate', vy: 40 });
        else if (rng.chance(0.2)) s.items.push({ x: e.x, y: e.y, kind: 'coin', vy: 30 });
      }
      s.enemies = s.enemies.filter((e) => e.hp > 0 && e.x > -60);
      s.shots = s.shots.filter((sh) => sh.x < w + 20);
      for (const b of s.bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (Math.abs(b.x - s.x) < 20 && Math.abs(b.y - s.y) < 10) {
          b.x = -100;
          hurt();
        }
      }
      s.bullets = s.bullets.filter((b) => b.x > -20 && b.x < w + 20 && b.y > -20 && b.y < H + 20);
      for (const it of s.items) {
        it.x -= 90 * dt;
        it.y += it.vy * dt;
        if (Math.hypot(it.x - s.x, it.y - s.y) < 34) {
          it.x = -100;
          if (it.kind === 'coin') {
            s.coins += 1;
            api.addCoins(1);
            api.sfx('coin');
          } else {
            s.double = 8;
            floaters.add('Double guns!', s.x + 40, s.y - 30, '#fde047', 18);
            api.sfx('powerup');
          }
        }
      }
      s.items = s.items.filter((it) => it.x > -20 && it.y < H + 20);
      const sc = s.score + Math.floor(s.dist * 5);
      api.setScore(sc);
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.dead = false;
            s.hp = maxHp;
            s.invuln = 2.5;
            s.bullets = [];
            s.enemies = s.enemies.filter((e) => e.x > s.x + 250);
          },
          () =>
            api.gameOver({
              score: s.score + Math.floor(s.dist * 5),
              stats: [
                { label: 'Planes downed', value: String(s.kills) },
                { label: 'Flight time', value: `${Math.floor(s.dist)} s` },
                { label: 'Coins', value: String(s.coins) },
              ],
            }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0284c7');
    sky.addColorStop(1, '#fcd34d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, H);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const c of s.clouds) {
      ctx.globalAlpha = 0.5 + c.speed * 0.5;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w, c.w * 0.28, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + c.w * 0.3, c.y - c.w * 0.15, c.w * 0.5, c.w * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    shake.apply(ctx);
    for (const it of s.items) {
      if (it.kind === 'coin') drawCoin(ctx, it.x, it.y, 8, s.clock + it.x);
      else {
        fillRoundRect(ctx, it.x - 11, it.y - 11, 22, 22, 4, '#a16207');
        text(ctx, '×2', it.x, it.y + 1, { size: 11, weight: 900 });
      }
    }
    for (const e of s.enemies) {
      if (e.kind === 'balloon') {
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + 16);
        ctx.lineTo(e.x, e.y + 34);
        ctx.stroke();
        circle(ctx, e.x, e.y, 16, e.flash > 0 ? '#fff' : '#f472b6');
        drawCoin(ctx, e.x, e.y + 38, 6, s.clock);
      } else if (e.kind === 'bomber') {
        ctx.save();
        ctx.translate(e.x, e.y);
        fillRoundRect(ctx, -44, -12, 88, 24, 12, e.flash > 0 ? '#fff' : '#475569');
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-16, -30, 22, 60);
        ctx.fillRect(40, -18, 6, 36);
        ctx.fillStyle = '#94a3b8';
        for (let i = -30; i < 30; i += 12) ctx.fillRect(i, -4, 6, 6);
        ctx.restore();
        fillRoundRect(ctx, e.x - 30, e.y - 40, 60, 4, 2, 'rgba(0,0,0,0.4)');
        fillRoundRect(ctx, e.x - 30, e.y - 40, 60 * (e.hp / e.maxHp), 4, 2, '#f87171');
      } else
        drawPlane(
          ctx,
          e.x,
          e.y,
          e.flash > 0 ? '#fff' : e.kind === 'kamikaze' ? '#0f172a' : '#475569',
          '#1e293b',
          '#ef4444',
          -1,
          s.clock * 40,
          e.kind === 'kamikaze' ? 0.8 : 1,
        );
    }
    for (const b of s.bullets) circle(ctx, b.x, b.y, 4, '#ef4444');
    ctx.fillStyle = '#fde047';
    for (const sh of s.shots) ctx.fillRect(sh.x - 6, sh.y - 1.5, 12, 3);
    if (!s.dead) {
      const [c0, c1, c2] = lo.skin.colors;
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 12) % 2 ? 0.4 : 1;
      drawPlane(ctx, s.x, s.y + Math.sin(s.clock * 3) * 2, c0, c1, c2, 1, s.clock * 40);
      if (wingman > 0) drawPlane(ctx, s.x - 20, s.y + 44, c0, c1, c2, 1, s.clock * 40, 0.6);
      if (wingman > 1) drawPlane(ctx, s.x - 20, s.y - 44, c0, c1, c2, 1, s.clock * 40, 0.6);
      ctx.globalAlpha = 1;
      if (rng.chance(0.4))
        particles.burst(s.x - 36, s.y, {
          count: 1,
          color: 'rgba(255,255,255,0.6)',
          speed: 60,
          angle: Math.PI,
          spread: 0.3,
          life: 0.5,
          size: 6,
        });
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    for (let i = 0; i < maxHp; i++)
      text(ctx, i < s.hp ? '♥' : '♡', 18 + i * 18, 20, { size: 17, color: '#be123c' });
    hudPill(ctx, w - 10, 8, String(s.coins), { align: 'right', coin: true, size: 13 });
    if (s.double > 0)
      hudPill(ctx, w / 2, 8, `×2 guns ${s.double.toFixed(0)}s`, {
        align: 'center',
        size: 12,
        color: '#fde047',
      });
    if (!s.started) prompt(ctx, 'Drag to fly', w / 2, H * 0.5, s.clock, 22);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={360}
      height={H}
      fit="fill"
      minAspect={0.75}
      maxAspect={2.2}
      label="Sky Ace game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
