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
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const WALL_Y = 520;
const GUN_X = W / 2;
const GUN_Y = 585;

interface Weapon {
  dmg: number;
  rate: number;
  pellets: number;
  spread: number;
  pierce: number;
  speed: number;
}
const WEAPONS: Record<string, Weapon> = {
  pistol: { dmg: 14, rate: 3.2, pellets: 1, spread: 0.03, pierce: 0, speed: 900 },
  smg: { dmg: 8, rate: 10, pellets: 1, spread: 0.09, pierce: 0, speed: 950 },
  shotgun: { dmg: 10, rate: 1.4, pellets: 6, spread: 0.32, pierce: 0, speed: 850 },
  rifle: { dmg: 36, rate: 2.4, pellets: 1, spread: 0.01, pierce: 2, speed: 1200 },
  laser: { dmg: 13, rate: 8, pellets: 1, spread: 0.02, pierce: 3, speed: 1400 },
};

type ZKind = 'walker' | 'runner' | 'brute';
interface Zombie {
  kind: ZKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  wobble: number;
  flash: number;
  atWall: boolean;
}
interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  pierce: number;
  hit: Set<Zombie>;
}

export function ZombieSiege({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const weapon = WEAPONS[lo.skin.id] ?? WEAPONS.pistol!;
  const dmgMul = 1 + 0.15 * lo.level('damage');
  const rateMul = 1 + 0.1 * lo.level('rate');
  const wallMax = 100 * (1 + 0.25 * lo.level('wall'));
  const gLvl = lo.level('grenade');
  const grenadeCd = 6 * Math.pow(0.88, gLvl);
  const grenadeR = 62 + gLvl * 6;
  const fx = useRef({
    particles: new Particles(500, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    zombies: [] as Zombie[],
    bullets: [] as Bullet[],
    grenades: [] as { x: number; y: number; tx: number; ty: number; t: number }[],
    coins: [] as { x: number; y: number; t: number }[],
    aim: -Math.PI / 2,
    fireT: 0,
    grenadeT: 0,
    wall: wallMax,
    wave: 0,
    toSpawn: 0,
    spawnT: 0,
    between: 1,
    score: 0,
    kills: 0,
    coinCount: 0,
    dead: false,
    deadT: 0,
    started: false,
    clock: 0,
    recoil: 0,
  }).current;

  const startWave = () => {
    s.wave += 1;
    s.toSpawn = 6 + s.wave * 3;
    s.spawnT = 0.3;
    fx.current.floaters.add(`Wave ${s.wave}`, W / 2, 200, '#bbf7d0', 32, 1.5);
    api.sfx('levelup');
  };

  const spawn = () => {
    const w = s.wave;
    const r = rng.next();
    const kind: ZKind = w >= 3 && r < 0.12 ? 'brute' : w >= 2 && r < 0.4 ? 'runner' : 'walker';
    const scale = 1 + (w - 1) * 0.17;
    const base = kind === 'brute' ? 150 : kind === 'runner' ? 18 : 32;
    const hp = base * scale;
    s.zombies.push({
      kind,
      x: rng.range(24, W - 24),
      y: -30,
      hp,
      maxHp: hp,
      speed:
        (kind === 'brute' ? 17 : kind === 'runner' ? 62 : 28) *
        rng.range(0.85, 1.15) *
        (1 + Math.min(0.5, w * 0.03)),
      wobble: rng.range(0, 6),
      flash: 0,
      atWall: false,
    });
  };

  const throwGrenade = (tx: number, ty: number) => {
    if (s.grenadeT > 0 || s.dead) return;
    s.grenadeT = grenadeCd;
    s.grenades.push({ x: GUN_X, y: GUN_Y - 20, tx, ty: Math.min(ty, WALL_Y - 20), t: 0 });
    api.sfx('swap');
  };

  const onDown = (p: StagePointer) => {
    s.started = true;
    if (p.y < WALL_Y) throwGrenade(p.x, p.y);
  };
  useKeyDown((code) => {
    s.started = true;
    if (code === 'Space' || code === 'KeyG') {
      // aim at the densest spot near the wall
      let best: Zombie | null = null;
      for (const z of s.zombies) if (!best || z.y > best.y) best = z;
      if (best) throwGrenade(best.x, best.y);
    }
  }, !paused);

  const damage = (z: Zombie, amount: number) => {
    z.hp -= amount;
    z.flash = 0.06;
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    if (!s.started && s.clock > 1.2) s.started = true;

    if (s.started && !s.dead) {
      s.grenadeT = Math.max(0, s.grenadeT - dt);
      s.recoil = Math.max(0, s.recoil - dt * 10);
      if (s.zombies.length === 0 && s.toSpawn === 0) {
        s.between -= dt;
        if (s.between <= 0) {
          if (s.wave > 0) {
            const bonus = 50 * s.wave;
            s.score += bonus;
            api.setScore(s.score);
            api.addCoins(3 + s.wave);
            s.coinCount += 3 + s.wave;
            floaters.add(`Wave cleared! +${bonus}`, W / 2, 260, '#86efac', 20, 1.2);
          }
          startWave();
          s.between = 3;
        }
      }
      if (s.toSpawn > 0) {
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          spawn();
          s.toSpawn -= 1;
          s.spawnT = Math.max(0.35, 1.3 - s.wave * 0.07) * rng.range(0.6, 1.3);
        }
      }
      // aim at the most urgent zombie
      let target: Zombie | null = null;
      for (const z of s.zombies) if (z.y > -10 && (!target || z.y > target.y)) target = z;
      if (target) {
        const lead = target.atWall ? 0 : target.speed * 0.15;
        const want = Math.atan2(target.y + lead - GUN_Y, target.x - GUN_X);
        s.aim += (want - s.aim) * Math.min(1, dt * 14);
        s.fireT -= dt;
        if (s.fireT <= 0) {
          s.fireT = 1 / (weapon.rate * rateMul);
          for (let p = 0; p < weapon.pellets; p++) {
            const a =
              s.aim +
              (weapon.pellets > 1
                ? (p / (weapon.pellets - 1) - 0.5) * weapon.spread
                : (rng.next() - 0.5) * weapon.spread);
            s.bullets.push({
              x: GUN_X + Math.cos(a) * 30,
              y: GUN_Y + Math.sin(a) * 30,
              vx: Math.cos(a) * weapon.speed,
              vy: Math.sin(a) * weapon.speed,
              dmg: weapon.dmg * dmgMul,
              pierce: weapon.pierce,
              hit: new Set(),
            });
          }
          s.recoil = 1;
          api.sfx('shoot');
        }
      }
      for (const b of s.bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        for (const z of s.zombies) {
          if (b.pierce < 0 || b.hit.has(z)) continue;
          const r = z.kind === 'brute' ? 22 : 14;
          if (Math.hypot(z.x - b.x, z.y - 6 - b.y) < r) {
            damage(z, b.dmg);
            b.hit.add(z);
            b.pierce -= 1;
            particles.burst(b.x, b.y, { count: 4, color: '#84cc16', speed: 90, life: 0.3 });
          }
        }
      }
      s.bullets = s.bullets.filter((b) => b.pierce >= 0 && b.y > -20 && b.x > -20 && b.x < W + 20);
      for (const g of s.grenades) {
        g.t += dt / 0.55;
        g.x = GUN_X + (g.tx - GUN_X) * Math.min(1, g.t);
        g.y = GUN_Y - 20 + (g.ty - GUN_Y + 20) * Math.min(1, g.t) - Math.sin(Math.min(1, g.t) * Math.PI) * 80;
        if (g.t >= 1) {
          for (const z of s.zombies) {
            const d = Math.hypot(z.x - g.tx, z.y - g.ty);
            if (d < grenadeR) damage(z, (70 + gLvl * 15) * (1 - d / (grenadeR * 1.4)) * (1 + s.wave * 0.1));
          }
          particles.burst(g.tx, g.ty, {
            count: 50,
            colors: ['#f97316', '#fde047', '#78716c'],
            speed: 300,
            life: 0.7,
          });
          shake.add(10);
          api.sfx('explode');
        }
      }
      s.grenades = s.grenades.filter((g) => g.t < 1);
      // zombies
      for (const z of s.zombies) {
        z.flash = Math.max(0, z.flash - dt);
        if (z.y < WALL_Y - 22) {
          z.y += z.speed * dt;
          z.x += Math.sin(s.clock * 3 + z.wobble) * 10 * dt;
        } else {
          z.atWall = true;
          s.wall -= (z.kind === 'brute' ? 22 : z.kind === 'runner' ? 6 : 9) * dt;
          if (rng.chance(0.05))
            particles.burst(z.x, WALL_Y - 4, { count: 2, color: '#a16207', speed: 60, life: 0.3 });
        }
      }
      for (const z of s.zombies) {
        if (z.hp > 0) continue;
        s.kills += 1;
        const pts = z.kind === 'brute' ? 60 : z.kind === 'runner' ? 15 : 10;
        s.score += pts;
        api.setScore(s.score);
        particles.burst(z.x, z.y, {
          count: 16,
          colors: ['#65a30d', '#3f6212', '#a3e635'],
          speed: 160,
          life: 0.5,
        });
        api.sfx('hit');
        if (rng.chance(z.kind === 'brute' ? 1 : 0.18)) s.coins.push({ x: z.x, y: z.y, t: 0 });
      }
      s.zombies = s.zombies.filter((z) => z.hp > 0);
      for (const c of s.coins) {
        c.t += dt;
        c.x += (GUN_X - c.x) * Math.min(1, dt * (c.t > 0.6 ? 6 : 0));
        c.y += (GUN_Y - c.y) * Math.min(1, dt * (c.t > 0.6 ? 6 : 0));
        if (Math.hypot(c.x - GUN_X, c.y - GUN_Y) < 20) {
          c.t = 99;
          s.coinCount += 1;
          api.addCoins(1);
          api.sfx('coin');
        }
      }
      s.coins = s.coins.filter((c) => c.t < 99);
      if (s.wall <= 0) {
        s.wall = 0;
        s.dead = true;
        s.deadT = 1;
        shake.add(14);
        api.sfx('gameover');
        api.haptic([80, 40, 80]);
      }
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.dead = false;
            s.wall = wallMax * 0.6;
            for (const z of s.zombies) {
              z.y = Math.min(z.y, WALL_Y - 180 - rng.range(0, 80));
              z.atWall = false;
            }
            fx.current.floaters.add('Barricade repaired!', W / 2, WALL_Y - 40, '#fde68a', 18);
          },
          () =>
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Wave', value: String(s.wave) },
                { label: 'Zombies', value: String(s.kills) },
                { label: 'Coins', value: String(s.coinCount) },
              ],
            }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#44403c';
    for (let i = 0; i < 20; i++) ctx.fillRect((i * 67) % W, (i * 97) % WALL_Y, 30, 14);
    ctx.save();
    shake.apply(ctx);
    // zombies (sorted so nearer ones overlap)
    for (const z of [...s.zombies].sort((a, b) => a.y - b.y)) {
      const big = z.kind === 'brute';
      const r = big ? 18 : z.kind === 'runner' ? 11 : 13;
      const step = Math.sin(s.clock * (z.speed / 5) + z.wobble) * 3;
      const skin = z.flash > 0 ? '#fff' : big ? '#4d7c0f' : z.kind === 'runner' ? '#84cc16' : '#65a30d';
      fillRoundRect(ctx, z.x - r * 0.8, z.y - 2, r * 1.6, r * 1.9, 5, big ? '#7c2d12' : '#57534e');
      ctx.strokeStyle = skin;
      ctx.lineWidth = big ? 7 : 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(z.x - r * 0.8, z.y + 6);
      ctx.lineTo(z.x - r * 1.2, z.y + 16 + step);
      ctx.moveTo(z.x + r * 0.8, z.y + 6);
      ctx.lineTo(z.x + r * 1.2, z.y + 16 - step);
      ctx.stroke();
      circle(ctx, z.x, z.y - r * 0.6, r, skin);
      circle(ctx, z.x - r * 0.35, z.y - r * 0.6, r * 0.2, '#fef08a');
      circle(ctx, z.x + r * 0.35, z.y - r * 0.6, r * 0.2, '#fef08a');
      if (z.hp < z.maxHp) {
        fillRoundRect(ctx, z.x - 14, z.y - r * 1.9, 28, 4, 2, 'rgba(0,0,0,0.5)');
        fillRoundRect(ctx, z.x - 14, z.y - r * 1.9, 28 * (z.hp / z.maxHp), 4, 2, '#ef4444');
      }
    }
    // barricade
    ctx.fillStyle = '#57534e';
    ctx.fillRect(0, WALL_Y, W, 22);
    const health = s.wall / wallMax;
    for (let i = 0; i < 9; i++) {
      const bx = i * 41 - 4;
      const broken = health < (i % 3) / 3 + 0.1;
      fillRoundRect(ctx, bx, WALL_Y - 4 + (broken ? 8 : 0), 40, 18, 8, broken ? '#78350f' : '#a16207');
      fillRoundRect(ctx, bx + 18, WALL_Y + 10, 40, 18, 8, '#92400e');
    }
    // gunner
    const [g0, g1, g2] = lo.skin.colors;
    circle(ctx, GUN_X, GUN_Y + 10, 20, '#1e3a8a');
    ctx.save();
    ctx.translate(GUN_X, GUN_Y);
    ctx.rotate(s.aim + Math.PI / 2);
    const len = lo.skin.id === 'rifle' ? 40 : lo.skin.id === 'pistol' ? 26 : 34;
    fillRoundRect(ctx, -5, -len + s.recoil * 4, 10, len, 3, g0);
    fillRoundRect(ctx, -7, -12, 14, 16, 3, g1);
    if (s.recoil > 0.6) circle(ctx, 0, -len - 4, 6, g2);
    ctx.restore();
    circle(ctx, GUN_X, GUN_Y, 11, '#fcd34d');
    for (const b of s.bullets)
      circle(
        ctx,
        b.x,
        b.y,
        lo.skin.id === 'laser' ? 3.5 : 2.5,
        lo.skin.id === 'laser' ? '#67e8f9' : '#fde047',
      );
    for (const g of s.grenades) circle(ctx, g.x, g.y, 6, '#365314');
    for (const c of s.coins) drawCoin(ctx, c.x, c.y, 8, s.clock);
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    // HUD
    fillRoundRect(ctx, 10, 12, 150, 14, 7, 'rgba(0,0,0,0.45)');
    fillRoundRect(ctx, 10, 12, 150 * health, 14, 7, health < 0.3 ? '#ef4444' : '#f59e0b');
    text(ctx, '🧱 Barricade', 85, 19, { size: 10, weight: 800 });
    hudPill(ctx, W - 10, 8, String(s.coinCount), { align: 'right', coin: true, size: 13 });
    hudPill(ctx, W / 2 + 30, 36, `Wave ${Math.max(1, s.wave)}`, { size: 12, align: 'center' });
    // grenade button indicator
    const ready = s.grenadeT <= 0;
    fillRoundRect(ctx, W - 76, H - 64, 64, 50, 16, ready ? 'rgba(22,101,52,0.85)' : 'rgba(0,0,0,0.45)');
    text(ctx, '💣', W - 44, H - 46, { size: 18 });
    text(ctx, ready ? 'READY' : `${s.grenadeT.toFixed(1)}s`, W - 44, H - 25, { size: 11, weight: 800 });
    if (s.clock < 4) prompt(ctx, 'Tap the horde to throw grenades', W / 2, H * 0.4, s.clock, 16);
  }, !paused);

  return (
    <CanvasStage ref={view} width={W} height={H} label="Zombie Siege game area" onPointerDown={onDown} />
  );
}
