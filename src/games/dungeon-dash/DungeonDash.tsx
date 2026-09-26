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
const L = 20;
const R = W - 20;
const T = 90;
const B = H - 30;
const HERO_R = 13;

type Kind = 'slime' | 'bat' | 'archer' | 'knight';
interface Enemy {
  kind: Kind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  t: number;
  vx: number;
  vy: number;
  flash: number;
  knock: number;
}

const PERKS: Record<string, { speed?: number; reach?: number; dmg?: number }> = {
  ranger: { speed: 0.1 },
  mage: { reach: 0.2 },
  samurai: { dmg: 0.15 },
  golden: { dmg: 0.1 },
};

export function DungeonDash({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const perk = PERKS[lo.skin.id] ?? {};
  const dmg = 12 * (1 + 0.2 * lo.level('sword')) * (1 + (perk.dmg ?? 0));
  const maxHearts = 5 + lo.level('armor');
  const speed = 150 * (1 + 0.08 * lo.level('boots')) * (1 + (perk.speed ?? 0));
  const reach = 50 * (1 + (perk.reach ?? 0));
  const crit = 0.08 * lo.level('crit');
  const fx = useRef({
    particles: new Particles(400, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const stick = useRef(new FloatingStick(56)).current;
  const s = useRef({
    room: 0,
    pillars: [] as Rect[],
    enemies: [] as Enemy[],
    arrows: [] as { x: number; y: number; vx: number; vy: number }[],
    drops: [] as { x: number; y: number; kind: 'coin' | 'potion'; t: number }[],
    x: W / 2,
    y: B - 40,
    face: -Math.PI / 2,
    swingT: 0,
    swingA: 0,
    cooldown: 0,
    hearts: maxHearts,
    invuln: 0,
    doorOpen: false,
    score: 0,
    kills: 0,
    coins: 0,
    dead: false,
    deadT: 0,
    started: false,
    clock: 0,
    banner: 0,
  }).current;

  const blocked = (x: number, y: number, r: number) =>
    x - r < L || x + r > R || y - r < T || y + r > B || s.pillars.some((p) => circleRect(x, y, r, p));

  const enterRoom = (n: number) => {
    s.room = n;
    s.pillars = [];
    const layout = rng.int(0, 3);
    if (layout === 1)
      s.pillars.push(
        { x: 80, y: 250, w: 36, h: 36 },
        { x: 244, y: 250, w: 36, h: 36 },
        { x: 80, y: 430, w: 36, h: 36 },
        { x: 244, y: 430, w: 36, h: 36 },
      );
    else if (layout === 2) s.pillars.push({ x: 150, y: 300, w: 60, h: 60 });
    else if (layout === 3) s.pillars.push({ x: 60, y: 330, w: 90, h: 24 }, { x: 210, y: 330, w: 90, h: 24 });
    s.enemies = [];
    s.arrows = [];
    const count = 3 + Math.floor(n * 0.9);
    for (let i = 0; i < count; i++) {
      const r = rng.next();
      const kind: Kind =
        n >= 4 && r < 0.12 ? 'knight' : n >= 2 && r < 0.35 ? 'archer' : n >= 1 && r < 0.55 ? 'bat' : 'slime';
      const scale = 1 + n * 0.14;
      const hp = { slime: 22, bat: 12, archer: 26, knight: 70 }[kind] * scale;
      let x = W / 2;
      let y = T + 60;
      for (let tries = 0; tries < 20; tries++) {
        x = rng.range(L + 30, R - 30);
        y = rng.range(T + 30, T + 280);
        if (!blocked(x, y, 16)) break;
      }
      s.enemies.push({
        kind,
        x,
        y,
        hp,
        maxHp: hp,
        speed: { slime: 45, bat: 105, archer: 55, knight: 70 }[kind] * (1 + Math.min(0.4, n * 0.03)),
        t: rng.range(0, 2),
        vx: 0,
        vy: 0,
        flash: 0,
        knock: 0,
      });
    }
    s.doorOpen = false;
    s.x = W / 2;
    s.y = B - 40;
    s.banner = 1.4;
  };
  if (s.enemies.length === 0 && s.room === 0 && !s.doorOpen) enterRoom(0);

  const hurt = (amount = 1) => {
    if (s.invuln > 0 || s.dead) return;
    s.hearts -= amount;
    s.invuln = 0.9;
    fx.current.shake.add(8);
    api.sfx('hit');
    api.haptic(50);
    if (s.hearts <= 0) {
      s.dead = true;
      s.deadT = 1;
      fx.current.particles.burst(s.x, s.y, {
        count: 40,
        colors: [lo.skin.colors[0], lo.skin.colors[1], '#ef4444'],
        speed: 240,
        life: 0.8,
      });
      api.sfx('gameover');
    }
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

    if (s.started && !s.dead) {
      s.invuln = Math.max(0, s.invuln - dt);
      s.banner = Math.max(0, s.banner - dt);
      const mag = Math.min(1, Math.hypot(mx, my));
      if (mag > 0.1) {
        const a = Math.atan2(my, mx);
        s.face = a;
        const nx = s.x + Math.cos(a) * speed * mag * dt;
        const ny = s.y + Math.sin(a) * speed * mag * dt;
        const inDoor = s.doorOpen && Math.abs(nx - W / 2) < 26 && ny < T + 20;
        if (!blocked(nx, s.y, HERO_R) || (inDoor && Math.abs(nx - W / 2) < 26)) s.x = nx;
        if (!blocked(s.x, ny, HERO_R) || inDoor) s.y = ny;
      }
      if (s.doorOpen && s.y < T - 4) {
        s.score += 100;
        api.setScore(s.score);
        api.sfx('levelup');
        enterRoom(s.room + 1);
      }
      // sword
      s.cooldown -= dt;
      s.swingT = Math.max(0, s.swingT - dt);
      let nearest: Enemy | null = null;
      let nd = Infinity;
      for (const e of s.enemies) {
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < nd) {
          nd = d;
          nearest = e;
        }
      }
      if (nearest && nd < reach + 12 && s.cooldown <= 0) {
        s.cooldown = 0.42;
        s.swingT = 0.18;
        s.swingA = Math.atan2(nearest.y - s.y, nearest.x - s.x);
        api.sfx('swap');
        for (const e of s.enemies) {
          const d = Math.hypot(e.x - s.x, e.y - s.y);
          const a = Math.atan2(e.y - s.y, e.x - s.x);
          if (d < reach + 14 && Math.abs(angleDiff(a, s.swingA)) < 1.1) {
            const isCrit = rng.chance(crit);
            const amount = dmg * (isCrit ? 2 : 1);
            e.hp -= amount;
            e.flash = 0.08;
            e.knock = 0.15;
            e.vx = Math.cos(a) * 260;
            e.vy = Math.sin(a) * 260;
            floaters.add(
              isCrit ? `${Math.round(amount)}!` : String(Math.round(amount)),
              e.x,
              e.y - 20,
              isCrit ? '#fde047' : '#fff',
              isCrit ? 18 : 13,
              0.5,
            );
            particles.burst(e.x, e.y, { count: 6, color: '#fff', speed: 120, life: 0.25 });
          }
        }
      }
      // enemies
      for (const e of s.enemies) {
        e.flash = Math.max(0, e.flash - dt);
        e.t += dt;
        if (e.knock > 0) {
          e.knock -= dt;
          const nx = e.x + e.vx * dt;
          const ny = e.y + e.vy * dt;
          if (!blocked(nx, ny, 12)) {
            e.x = nx;
            e.y = ny;
          }
          continue;
        }
        const dx = s.x - e.x;
        const dy = s.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        let vx = 0;
        let vy = 0;
        if (e.kind === 'slime' || e.kind === 'knight') {
          const hop = e.kind === 'slime' ? Math.max(0, Math.sin(e.t * 5)) : e.t % 3 > 2.2 ? 2.4 : 0.8;
          vx = (dx / d) * e.speed * hop;
          vy = (dy / d) * e.speed * hop;
        } else if (e.kind === 'bat') {
          vx = (dx / d) * e.speed + Math.cos(e.t * 7) * 80;
          vy = (dy / d) * e.speed + Math.sin(e.t * 5) * 80;
        } else {
          const want = d < 150 ? -1 : d > 230 ? 1 : 0;
          vx = (dx / d) * e.speed * want + Math.cos(e.t) * 30;
          vy = (dy / d) * e.speed * want;
          if (e.t > 2.2) {
            e.t = rng.range(0, 0.6);
            s.arrows.push({ x: e.x, y: e.y, vx: (dx / d) * 230, vy: (dy / d) * 230 });
            api.sfx('shoot');
          }
        }
        const nx = e.x + vx * dt;
        const ny = e.y + vy * dt;
        if (e.kind === 'bat' || !blocked(nx, e.y, 12)) e.x = clamp(nx, L + 10, R - 10);
        if (e.kind === 'bat' || !blocked(e.x, ny, 12)) e.y = clamp(ny, T + 10, B - 10);
        if (d < HERO_R + (e.kind === 'knight' ? 16 : 11)) hurt(e.kind === 'knight' ? 2 : 1);
      }
      for (const a of s.arrows) {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if (Math.hypot(a.x - s.x, a.y - s.y) < HERO_R + 3) {
          a.x = -100;
          hurt(1);
        }
      }
      s.arrows = s.arrows.filter(
        (a) => a.x > L && a.x < R && a.y > T && a.y < B && !s.pillars.some((p) => circleRect(a.x, a.y, 2, p)),
      );
      for (const e of s.enemies) {
        if (e.hp > 0) continue;
        s.kills += 1;
        s.score += e.kind === 'knight' ? 40 : 10;
        api.setScore(s.score);
        particles.burst(e.x, e.y, {
          count: 20,
          colors: e.kind === 'slime' ? ['#22c55e', '#86efac'] : ['#e5e7eb', '#a8a29e'],
          speed: 180,
          life: 0.6,
        });
        api.sfx('explode');
        const r = rng.next();
        if (r < 0.12) s.drops.push({ x: e.x, y: e.y, kind: 'potion', t: 0 });
        else if (r < 0.5 || e.kind === 'knight') s.drops.push({ x: e.x, y: e.y, kind: 'coin', t: 0 });
      }
      s.enemies = s.enemies.filter((e) => e.hp > 0);
      if (!s.doorOpen && s.enemies.length === 0) {
        s.doorOpen = true;
        floaters.add('Room clear! The door is open', W / 2, T + 60, '#c4b5fd', 16, 1.4);
        api.sfx('win');
      }
      for (const d of s.drops) {
        d.t += dt;
        if (Math.hypot(d.x - s.x, d.y - s.y) < 26) {
          d.t = 999;
          if (d.kind === 'coin') {
            const n = 1 + Math.floor(s.room / 3);
            s.coins += n;
            api.addCoins(n);
            api.sfx('coin');
          } else if (s.hearts < maxHearts) {
            s.hearts += 1;
            floaters.add('+❤', s.x, s.y - 26, '#fca5a5', 18);
            api.sfx('powerup');
          } else d.t = 0;
        }
      }
      s.drops = s.drops.filter((d) => d.t < 999);
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.dead = false;
            s.hearts = maxHearts;
            s.invuln = 2;
            s.arrows = [];
            for (const e of s.enemies) {
              const a = Math.atan2(e.y - s.y, e.x - s.x);
              e.vx = Math.cos(a) * 400;
              e.vy = Math.sin(a) * 400;
              e.knock = 0.4;
            }
          },
          () =>
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Rooms cleared', value: String(s.room) },
                { label: 'Monsters', value: String(s.kills) },
                { label: 'Coins', value: String(s.coins) },
              ],
            }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    for (let y = T; y < B; y += 32)
      for (let x = L; x < R; x += 32) {
        ctx.fillStyle = ((x + y) / 32) % 2 ? '#292524' : '#2e2a27';
        ctx.fillRect(x, y, 32, 32);
      }
    ctx.strokeStyle = '#57534e';
    ctx.lineWidth = 8;
    ctx.strokeRect(L - 4, T - 4, R - L + 8, B - T + 8);
    // door
    fillRoundRect(ctx, W / 2 - 26, T - 16, 52, 20, 4, s.doorOpen ? '#0c0a09' : '#78350f');
    if (!s.doorOpen) {
      ctx.fillStyle = '#a16207';
      ctx.fillRect(W / 2 - 2, T - 14, 4, 16);
    } else {
      text(ctx, '▲', W / 2, T - 6, { size: 14, color: '#c4b5fd', alpha: 0.6 + Math.sin(s.clock * 6) * 0.4 });
    }
    for (const p of s.pillars) {
      fillRoundRect(ctx, p.x, p.y, p.w, p.h, 4, '#57534e');
      ctx.fillStyle = '#44403c';
      ctx.fillRect(p.x + 4, p.y + p.h - 8, p.w - 8, 5);
    }
    for (const d of s.drops) {
      if (d.kind === 'coin') drawCoin(ctx, d.x, d.y, 8, s.clock);
      else {
        fillRoundRect(ctx, d.x - 7, d.y - 6, 14, 14, 5, '#ef4444');
        ctx.fillStyle = '#fecaca';
        ctx.fillRect(d.x - 3, d.y - 11, 6, 6);
      }
    }
    for (const e of s.enemies) {
      const fl = e.flash > 0;
      if (e.kind === 'slime') {
        const sq = 1 + Math.sin(e.t * 10) * 0.1;
        ctx.fillStyle = fl ? '#fff' : '#22c55e';
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + 2, 15 * sq, 12 / sq, 0, 0, Math.PI * 2);
        ctx.fill();
        circle(ctx, e.x - 5, e.y - 2, 3, '#052e16');
        circle(ctx, e.x + 5, e.y - 2, 3, '#052e16');
      } else if (e.kind === 'bat') {
        const flap = Math.sin(e.t * 20) * 8;
        ctx.fillStyle = fl ? '#fff' : '#6d28d9';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x - 18, e.y - 6 + flap);
        ctx.lineTo(e.x - 8, e.y + 4);
        ctx.lineTo(e.x + 8, e.y + 4);
        ctx.lineTo(e.x + 18, e.y - 6 + flap);
        ctx.fill();
        circle(ctx, e.x, e.y, 7, fl ? '#fff' : '#4c1d95');
        circle(ctx, e.x - 2.5, e.y - 1, 1.5, '#fde047');
        circle(ctx, e.x + 2.5, e.y - 1, 1.5, '#fde047');
      } else if (e.kind === 'archer') {
        fillRoundRect(ctx, e.x - 8, e.y, 16, 16, 4, fl ? '#fff' : '#d6d3d1');
        circle(ctx, e.x, e.y - 6, 9, fl ? '#fff' : '#e7e5e4');
        circle(ctx, e.x - 3, e.y - 7, 2, '#111');
        circle(ctx, e.x + 3, e.y - 7, 2, '#111');
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x + 10, e.y + 4, 10, -1.2, 1.2);
        ctx.stroke();
      } else {
        fillRoundRect(ctx, e.x - 14, e.y - 4, 28, 24, 5, fl ? '#fff' : '#475569');
        circle(ctx, e.x, e.y - 12, 12, fl ? '#fff' : '#64748b');
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(e.x - 7, e.y - 14, 14, 3);
      }
      if (e.hp < e.maxHp) {
        fillRoundRect(ctx, e.x - 14, e.y - 28, 28, 4, 2, 'rgba(0,0,0,0.6)');
        fillRoundRect(ctx, e.x - 14, e.y - 28, 28 * (e.hp / e.maxHp), 4, 2, '#f87171');
      }
    }
    ctx.strokeStyle = '#d6d3d1';
    ctx.lineWidth = 2;
    for (const a of s.arrows) {
      const ang = Math.atan2(a.vy, a.vx);
      ctx.beginPath();
      ctx.moveTo(a.x - Math.cos(ang) * 10, a.y - Math.sin(ang) * 10);
      ctx.lineTo(a.x, a.y);
      ctx.stroke();
    }
    // hero
    if (!s.dead) {
      const [armor, cloth, trim] = lo.skin.colors;
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 14) % 2 ? 0.4 : 1;
      fillRoundRect(ctx, s.x - 10, s.y - 4, 20, 20, 6, cloth);
      circle(ctx, s.x, s.y - 10, 10, armor);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(s.x - 6, s.y - 12, 12, 3);
      ctx.fillStyle = trim;
      ctx.fillRect(s.x - 10, s.y + 2, 20, 3);
      const sa = s.swingT > 0 ? s.swingA - 1 + (1 - s.swingT / 0.18) * 2 : s.face;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x + Math.cos(sa) * 10, s.y + Math.sin(sa) * 10);
      ctx.lineTo(s.x + Math.cos(sa) * (reach - 8), s.y + Math.sin(sa) * (reach - 8));
      ctx.stroke();
      if (s.swingT > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(s.x, s.y, reach - 10, s.swingA - 1, sa);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    stick.draw(ctx);
    ctx.restore();

    // HUD
    for (let i = 0; i < maxHearts; i++) text(ctx, i < s.hearts ? '❤️' : '🖤', 20 + i * 22, 30, { size: 17 });
    hudPill(ctx, W - 10, 14, String(s.coins), { align: 'right', coin: true, size: 13 });
    hudPill(ctx, W / 2, 46, `Room ${s.room + 1}`, { size: 12, align: 'center' });
    if (s.banner > 0)
      text(ctx, `Room ${s.room + 1}`, W / 2, H / 2, {
        size: 34,
        weight: 900,
        alpha: Math.min(1, s.banner),
        stroke: 'rgba(0,0,0,0.5)',
      });
    if (!s.started) prompt(ctx, 'Drag to move — your sword swings itself', W / 2, H * 0.8, s.clock, 15);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Dungeon Dash game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
