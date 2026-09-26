import { useRef } from 'react';
import {
  CanvasStage,
  FloatingStick,
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
  text,
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { angleDiff, circleRect, clamp, type Rect } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const TOP = 60;
const BOTTOM = H - 20;
const TANK_R = 16;

interface Tank {
  x: number;
  y: number;
  body: number;
  turret: number;
  hp: number;
  maxHp: number;
  reload: number;
  speed: number;
  goal: { x: number; y: number } | null;
  goalT: number;
  flash: number;
}
interface Shell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
  mine: boolean;
  dmg: number;
}

const LAYOUTS: Rect[][] = [
  [
    { x: 150, y: 290, w: 60, h: 60 },
    { x: 40, y: 200, w: 80, h: 24 },
    { x: 240, y: 200, w: 80, h: 24 },
    { x: 40, y: 430, w: 80, h: 24 },
    { x: 240, y: 430, w: 80, h: 24 },
  ],
  [
    { x: 60, y: 260, w: 24, h: 120 },
    { x: 276, y: 260, w: 24, h: 120 },
    { x: 140, y: 180, w: 80, h: 24 },
    { x: 140, y: 450, w: 80, h: 24 },
  ],
  [
    { x: 100, y: 230, w: 160, h: 22 },
    { x: 100, y: 410, w: 160, h: 22 },
    { x: 20, y: 320, w: 50, h: 22 },
    { x: 290, y: 320, w: 50, h: 22 },
  ],
];

export function TankDuel({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const maxHp = 100 + 25 * lo.level('armor');
  const dmgMul = 1 + 0.15 * lo.level('cannon');
  const reloadTime = 0.9 / (1 + 0.12 * lo.level('reload'));
  const ricochet = 1 + lo.level('ricochet');
  const speed = 120 * (1 + 0.08 * lo.level('engine'));
  const fx = useRef({
    particles: new Particles(400, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const stick = useRef(new FloatingStick(56)).current;
  const s = useRef({
    walls: LAYOUTS[0]!,
    me: {
      x: W / 2,
      y: BOTTOM - 50,
      body: -Math.PI / 2,
      turret: -Math.PI / 2,
      hp: maxHp,
      maxHp,
      reload: 0,
      speed,
      goal: null,
      goalT: 0,
      flash: 0,
    } as Tank,
    enemies: [] as Tank[],
    shells: [] as Shell[],
    pickups: [] as { x: number; y: number; kind: 'coin' | 'repair'; t: number }[],
    wave: 0,
    toSpawn: 0,
    spawnT: 0,
    between: 1.5,
    score: 0,
    kills: 0,
    coins: 0,
    invuln: 0,
    dead: false,
    deadT: 0,
    started: false,
    clock: 0,
    tracks: [] as { x: number; y: number; a: number; t: number }[],
  }).current;

  const blocked = (x: number, y: number) =>
    x < 10 ||
    x > W - 10 ||
    y < TOP + 10 ||
    y > BOTTOM - 10 ||
    s.walls.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);

  const los = (ax: number, ay: number, bx: number, by: number) => {
    const d = Math.hypot(bx - ax, by - ay);
    const steps = Math.ceil(d / 8);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (blocked(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  };

  const moveTank = (t: Tank, dx: number, dy: number) => {
    t.x = clamp(t.x + dx, 10 + TANK_R, W - 10 - TANK_R);
    t.y = clamp(t.y + dy, TOP + 10 + TANK_R, BOTTOM - 10 - TANK_R);
    for (const r of s.walls) {
      if (!circleRect(t.x, t.y, TANK_R, r)) continue;
      const nx = clamp(t.x, r.x, r.x + r.w);
      const ny = clamp(t.y, r.y, r.y + r.h);
      const ox = t.x - nx;
      const oy = t.y - ny;
      const d = Math.hypot(ox, oy) || 0.001;
      const push = TANK_R - d;
      t.x += (ox / d) * push;
      t.y += (oy / d) * push;
    }
  };

  const nextWave = () => {
    s.wave += 1;
    s.walls = LAYOUTS[(s.wave - 1) % LAYOUTS.length]!;
    s.toSpawn = 1 + s.wave;
    s.spawnT = 0.5;
    s.between = 0;
    fx.current.floaters.add(`Wave ${s.wave}`, W / 2, 250, '#d9f99d', 30, 1.4);
    api.sfx('levelup');
    if (s.wave > 1) {
      s.me.x = W / 2;
      s.me.y = BOTTOM - 50;
    }
  };

  const spawnEnemy = () => {
    let x = W / 2;
    let y = TOP + 40;
    for (let tries = 0; tries < 20; tries++) {
      x = rng.range(40, W - 40);
      y = rng.range(TOP + 30, TOP + 140);
      if (!blocked(x, y) && Math.hypot(x - s.me.x, y - s.me.y) > 200) break;
    }
    const hp = 40 + s.wave * 12;
    s.enemies.push({
      x,
      y,
      body: Math.PI / 2,
      turret: Math.PI / 2,
      hp,
      maxHp: hp,
      reload: rng.range(1, 2),
      speed: 60 + Math.min(50, s.wave * 5),
      goal: null,
      goalT: 0,
      flash: 0,
    });
  };

  const fire = (t: Tank, mine: boolean) => {
    const sp = mine ? 420 : 300 + Math.min(120, s.wave * 10);
    s.shells.push({
      x: t.x + Math.cos(t.turret) * 24,
      y: t.y + Math.sin(t.turret) * 24,
      vx: Math.cos(t.turret) * sp,
      vy: Math.sin(t.turret) * sp,
      bounces: mine ? ricochet : 1,
      mine,
      dmg: mine ? 20 * dmgMul : 12 + s.wave * 1.5,
    });
    fx.current.particles.burst(t.x + Math.cos(t.turret) * 26, t.y + Math.sin(t.turret) * 26, {
      count: 6,
      colors: ['#fde047', '#fb923c'],
      speed: 120,
      life: 0.25,
      angle: t.turret,
      spread: 0.8,
    });
    api.sfx('shoot');
  };

  const onDown = (p: StagePointer) => {
    s.started = true;
    stick.down(p.id, p.x, p.y);
  };
  const onMove = (p: StagePointer) => stick.move(p.id, p.x, p.y);
  const onUp = (p: StagePointer) => stick.up(p.id);

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    let mx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let my = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    const sv = stick.vector();
    if (sv.x || sv.y) {
      mx = sv.x;
      my = sv.y;
    }
    if (mx || my) s.started = true;
    const me = s.me;

    if (s.started && !s.dead) {
      s.invuln = Math.max(0, s.invuln - dt);
      if (s.enemies.length === 0 && s.toSpawn === 0) {
        s.between -= dt;
        if (s.between <= 0) nextWave();
      }
      if (s.toSpawn > 0) {
        s.spawnT -= dt;
        if (s.spawnT <= 0 && s.enemies.length < 2 + Math.floor(s.wave / 3)) {
          spawnEnemy();
          s.toSpawn -= 1;
          s.spawnT = 1.4;
        }
      }
      // player movement
      const mag = Math.min(1, Math.hypot(mx, my));
      if (mag > 0.1) {
        const want = Math.atan2(my, mx);
        me.body += clamp(angleDiff(me.body, want), -6 * dt, 6 * dt);
        const aligned = Math.cos(angleDiff(me.body, want));
        const sp = me.speed * mag * Math.max(0.2, aligned);
        moveTank(me, Math.cos(me.body) * sp * dt, Math.sin(me.body) * sp * dt);
        if (rng.chance(0.3)) s.tracks.push({ x: me.x, y: me.y, a: me.body, t: s.clock });
      }
      // auto aim
      let target: Tank | null = null;
      let best = Infinity;
      for (const e of s.enemies) {
        const d = Math.hypot(e.x - me.x, e.y - me.y);
        const score = d + (los(me.x, me.y, e.x, e.y) ? 0 : 400);
        if (score < best) {
          best = score;
          target = e;
        }
      }
      me.reload -= dt;
      if (target) {
        const want = Math.atan2(target.y - me.y, target.x - me.x);
        me.turret += clamp(angleDiff(me.turret, want), -7 * dt, 7 * dt);
        if (
          me.reload <= 0 &&
          Math.abs(angleDiff(me.turret, want)) < 0.12 &&
          los(me.x, me.y, target.x, target.y)
        ) {
          fire(me, true);
          me.reload = reloadTime;
        }
      }
      // enemies
      for (const e of s.enemies) {
        e.flash = Math.max(0, e.flash - dt);
        e.goalT -= dt;
        if (!e.goal || e.goalT <= 0 || Math.hypot(e.goal.x - e.x, e.goal.y - e.y) < 12) {
          const chase = rng.chance(0.55);
          e.goal = chase
            ? { x: me.x + rng.range(-80, 80), y: me.y - rng.range(80, 180) }
            : { x: rng.range(40, W - 40), y: rng.range(TOP + 30, H * 0.6) };
          e.goalT = rng.range(1.5, 3);
        }
        const want = Math.atan2(e.goal.y - e.y, e.goal.x - e.x);
        e.body += clamp(angleDiff(e.body, want), -3 * dt, 3 * dt);
        const bx = e.x;
        const by = e.y;
        moveTank(e, Math.cos(e.body) * e.speed * dt, Math.sin(e.body) * e.speed * dt);
        if (Math.hypot(e.x - bx, e.y - by) < e.speed * dt * 0.3) e.goalT = 0;
        const aim = Math.atan2(me.y - e.y, me.x - e.x);
        e.turret += clamp(angleDiff(e.turret, aim), -2.5 * dt, 2.5 * dt);
        e.reload -= dt;
        if (e.reload <= 0 && Math.abs(angleDiff(e.turret, aim)) < 0.2 && los(e.x, e.y, me.x, me.y)) {
          fire(e, false);
          e.reload = Math.max(0.9, 2.2 - s.wave * 0.08) * rng.range(0.8, 1.2);
        }
      }
      // shells
      for (const sh of s.shells) {
        const nx = sh.x + sh.vx * dt;
        const ny = sh.y + sh.vy * dt;
        if (blocked(nx, ny)) {
          if (sh.bounces <= 0) {
            sh.bounces = -1;
            particles.burst(sh.x, sh.y, { count: 6, color: '#d6d3d1', speed: 80, life: 0.3 });
            continue;
          }
          sh.bounces -= 1;
          if (blocked(nx, sh.y)) sh.vx = -sh.vx;
          if (blocked(sh.x, ny)) sh.vy = -sh.vy;
          api.sfx('tick');
          continue;
        }
        sh.x = nx;
        sh.y = ny;
        if (sh.mine) {
          for (const e of s.enemies) {
            if (Math.hypot(e.x - sh.x, e.y - sh.y) < TANK_R + 3) {
              e.hp -= sh.dmg;
              e.flash = 0.08;
              sh.bounces = -1;
              particles.burst(sh.x, sh.y, {
                count: 10,
                colors: ['#fde047', '#f97316'],
                speed: 140,
                life: 0.35,
              });
              api.sfx('hit');
              break;
            }
          }
        } else if (Math.hypot(me.x - sh.x, me.y - sh.y) < TANK_R + 3) {
          sh.bounces = -1;
          if (s.invuln <= 0) {
            me.hp -= sh.dmg;
            me.flash = 0.1;
            shake.add(6);
            api.haptic(40);
            api.sfx('hit');
          }
        }
      }
      s.shells = s.shells.filter((sh) => sh.bounces >= 0);
      for (const e of s.enemies) {
        if (e.hp > 0) continue;
        s.kills += 1;
        s.score += 100;
        api.setScore(s.score);
        shake.add(10);
        particles.burst(e.x, e.y, {
          count: 40,
          colors: ['#f97316', '#fde047', '#44403c'],
          speed: 240,
          life: 0.8,
        });
        api.sfx('explode');
        s.pickups.push({ x: e.x, y: e.y, kind: rng.chance(0.2) ? 'repair' : 'coin', t: 0 });
      }
      s.enemies = s.enemies.filter((e) => e.hp > 0);
      if (s.enemies.length === 0 && s.toSpawn === 0 && s.between <= 0 && s.wave > 0) {
        const bonus = 150 * s.wave;
        s.score += bonus;
        api.setScore(s.score);
        floaters.add(`Wave clear +${bonus}`, W / 2, 220, '#86efac', 22, 1.3);
        api.addCoins(2 + s.wave);
        s.coins += 2 + s.wave;
        s.between = 2;
      }
      for (const p of s.pickups) {
        p.t += dt;
        if (Math.hypot(p.x - me.x, p.y - me.y) < 28) {
          p.t = 99;
          if (p.kind === 'coin') {
            const n = 2 + Math.floor(s.wave / 2);
            s.coins += n;
            api.addCoins(n);
            api.sfx('coin');
          } else {
            me.hp = Math.min(me.maxHp, me.hp + 35);
            floaters.add('+35 HP', me.x, me.y - 30, '#86efac', 16);
            api.sfx('powerup');
          }
        }
      }
      s.pickups = s.pickups.filter((p) => p.t < 12);
      me.flash = Math.max(0, me.flash - dt);
      if (me.hp <= 0) {
        s.dead = true;
        s.deadT = 1;
        particles.burst(me.x, me.y, {
          count: 50,
          colors: ['#f97316', '#fde047', lo.skin.colors[0]],
          speed: 260,
          life: 0.9,
        });
        shake.add(16);
        api.sfx('explode');
      }
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.dead = false;
            me.hp = me.maxHp;
            s.invuln = 2;
            s.shells = [];
          },
          () =>
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Wave', value: String(s.wave) },
                { label: 'Tanks destroyed', value: String(s.kills) },
                { label: 'Coins', value: String(s.coins) },
              ],
            }),
        );
    }
    s.tracks = s.tracks.filter((t) => s.clock - t.t < 4);
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    ctx.fillStyle = '#57534e';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    ctx.fillStyle = '#615b56';
    for (let y = TOP; y < BOTTOM; y += 40)
      for (let x = (y / 40) % 2 ? 0 : 40; x < W; x += 80) ctx.fillRect(x, y, 40, 40);
    for (const t of s.tracks) {
      ctx.save();
      ctx.globalAlpha = 0.25 * (1 - (s.clock - t.t) / 4);
      ctx.translate(t.x, t.y);
      ctx.rotate(t.a);
      ctx.fillStyle = '#292524';
      ctx.fillRect(-3, -14, 6, 4);
      ctx.fillRect(-3, 10, 6, 4);
      ctx.restore();
    }
    ctx.fillStyle = '#292524';
    ctx.fillRect(0, TOP, W, 10);
    ctx.fillRect(0, BOTTOM - 10, W, 10);
    ctx.fillRect(0, TOP, 10, BOTTOM - TOP);
    ctx.fillRect(W - 10, TOP, 10, BOTTOM - TOP);
    for (const r of s.walls) {
      fillRoundRect(ctx, r.x, r.y, r.w, r.h, 4, '#78716c');
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    }
    for (const p of s.pickups) {
      if (p.kind === 'coin') drawCoin(ctx, p.x, p.y, 9, s.clock);
      else {
        circle(ctx, p.x, p.y, 12, '#16a34a');
        text(ctx, '🔧', p.x, p.y + 1, { size: 13 });
      }
    }
    const drawTank = (t: Tank, colors: readonly [string, string, string], alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(t.x, t.y);
      ctx.save();
      ctx.rotate(t.body);
      ctx.fillStyle = colors[1];
      ctx.fillRect(-18, -17, 36, 8);
      ctx.fillRect(-18, 9, 36, 8);
      fillRoundRect(ctx, -15, -12, 30, 24, 4, t.flash > 0 ? '#fff' : colors[0]);
      ctx.restore();
      ctx.rotate(t.turret);
      ctx.fillStyle = colors[1];
      ctx.fillRect(0, -3.5, 24, 7);
      circle(ctx, 0, 0, 9, t.flash > 0 ? '#fff' : shade(colors[0], -0.15));
      circle(ctx, 0, 0, 4, colors[2]);
      ctx.restore();
    };
    for (const e of s.enemies) {
      drawTank(e, ['#b91c1c', '#450a0a', '#fca5a5']);
      fillRoundRect(ctx, e.x - 16, e.y - 28, 32, 4, 2, 'rgba(0,0,0,0.5)');
      fillRoundRect(ctx, e.x - 16, e.y - 28, 32 * (e.hp / e.maxHp), 4, 2, '#f87171');
    }
    if (!s.dead) drawTank(me, lo.skin.colors, s.invuln > 0 && Math.floor(s.clock * 12) % 2 ? 0.4 : 1);
    for (const sh of s.shells) circle(ctx, sh.x, sh.y, 4, sh.mine ? '#fde047' : '#fca5a5');
    particles.draw(ctx);
    floaters.draw(ctx);
    stick.draw(ctx);
    ctx.restore();

    // HUD
    fillRoundRect(ctx, 10, 14, 140, 14, 7, 'rgba(0,0,0,0.45)');
    fillRoundRect(
      ctx,
      10,
      14,
      140 * Math.max(0, me.hp / me.maxHp),
      14,
      7,
      me.hp / me.maxHp < 0.3 ? '#ef4444' : '#22c55e',
    );
    text(ctx, `${Math.max(0, Math.ceil(me.hp))} HP`, 80, 21, { size: 10, weight: 800 });
    hudPill(ctx, W / 2 + 20, 8, `Wave ${Math.max(1, s.wave)}`, { size: 13, align: 'center' });
    hudPill(ctx, W - 10, 8, String(s.coins), { align: 'right', coin: true, size: 13 });
    if (!s.started) prompt(ctx, 'Drag to drive — it shoots itself', W / 2, H * 0.55, s.clock, 17);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Tank Duel game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
