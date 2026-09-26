import { useRef, useState } from 'react';
import { axisFromKeys, CanvasStage, FloatingStick, FloatingText, Particles, Shake, useGameLoop, useHeldKeys, useSeededRng } from '../../engine';
import type { CanvasView } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import { clamp, dist2, TAU } from '../../lib/math';
import type { GameProps } from '../../platform/types';
import { BASE_STATS, UPGRADES, xpForLevel, type Stats, type Upgrade } from './upgrades';
import styles from './ArenaSurvivor.module.css';

const H = 640;
const WORLD = 1100;

type Kind = 'grunt' | 'runner' | 'tank' | 'spitter' | 'boss';
const KINDS: Record<Kind, { hp: number; speed: number; r: number; dmg: number; xp: number; color: string }> = {
  grunt: { hp: 20, speed: 72, r: 13, dmg: 12, xp: 1, color: '#ef4444' },
  runner: { hp: 11, speed: 128, r: 10, dmg: 9, xp: 1, color: '#fb923c' },
  tank: { hp: 95, speed: 46, r: 22, dmg: 22, xp: 4, color: '#a855f7' },
  spitter: { hp: 26, speed: 62, r: 14, dmg: 10, xp: 2, color: '#22c55e' },
  boss: { hp: 900, speed: 58, r: 40, dmg: 35, xp: 30, color: '#e11d48' },
};

interface Enemy {
  kind: Kind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hit: number;
  shoot: number;
  bladeCd: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  pierce: number;
  hostile: boolean;
  hits: Set<Enemy>;
}

export function ArenaSurvivor({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const fx = useRef({ particles: new Particles(700, rng.next), floaters: new FloatingText(), shake: new Shake(rng.next) });
  const stick = useRef(new FloatingStick(56)).current;
  const [choices, setChoices] = useState<Upgrade[] | null>(null);
  const s = useRef({
    x: 0,
    y: 0,
    facing: 0,
    stats: { ...BASE_STATS } as Stats,
    hp: BASE_STATS.maxHp,
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    gems: [] as { x: number; y: number; v: number }[],
    t: 0,
    spawn: 1,
    fire: 0,
    level: 1,
    xp: 0,
    kills: 0,
    bossTimer: 120,
    started: false,
    dead: false,
    deadTimer: 0,
    ended: false,
    choosing: false,
    hurt: 0,
    bladeAngle: 0,
    score: 0,
    pendingLevels: 0,
  }).current;

  const offerUpgrade = () => {
    const pool = UPGRADES.filter((u) => !u.max?.(s.stats));
    setChoices(rng.shuffle(pool).slice(0, 3));
    s.choosing = true;
    api.sfx('levelup');
  };

  const choose = (u: Upgrade) => {
    const before = s.stats.maxHp;
    s.stats = u.apply(s.stats);
    if (s.stats.maxHp > before) s.hp = s.stats.maxHp;
    setChoices(null);
    s.choosing = false;
    api.sfx('powerup');
    if (s.pendingLevels > 0) {
      s.pendingLevels -= 1;
      offerUpgrade();
    }
  };

  const spawnEnemy = (W: number, kind?: Kind) => {
    const t = s.t;
    const roll = rng.next();
    const k: Kind = kind ?? (t > 90 && roll < 0.14 ? 'spitter' : t > 40 && roll < 0.3 ? 'tank' : t > 15 && roll < 0.55 ? 'runner' : 'grunt');
    const def = KINDS[k];
    const a = rng.range(0, TAU);
    const d = Math.hypot(W, H) / 2 + 50;
    const hp = def.hp * (1 + t / 80);
    s.enemies.push({
      kind: k,
      x: clamp(s.x + Math.cos(a) * d, -WORLD, WORLD),
      y: clamp(s.y + Math.sin(a) * d, -WORLD, WORLD),
      hp,
      maxHp: hp,
      hit: 0,
      shoot: rng.range(1, 3),
      bladeCd: 0,
    });
  };

  const damageEnemy = (e: Enemy, dmg: number) => {
    e.hp -= dmg;
    e.hit = 0.1;
    if (e.hp <= 0) {
      const def = KINDS[e.kind];
      s.kills += 1;
      fx.current.particles.burst(e.x, e.y, { count: e.kind === 'boss' ? 60 : 10, colors: [def.color, '#fff'], speed: 180, life: 0.5 });
      for (let i = 0; i < Math.min(8, def.xp); i++) s.gems.push({ x: e.x + rng.range(-10, 10), y: e.y + rng.range(-10, 10), v: def.xp > 8 ? 4 : 1 });
      if (e.kind === 'boss') {
        fx.current.floaters.add('BOSS DOWN!', e.x, e.y - 50, '#fde047', 26, 1.4);
        api.sfx('win');
      } else if (s.kills % 3 === 0) api.sfx('hit');
    }
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const W = v.width;
    const { particles, floaters, shake } = fx.current;
    const st = s.stats;
    const axis = axisFromKeys(keys.current);
    const joy = stick.vector();
    let mx = axis.x || joy.x;
    let my = axis.y || joy.y;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    if (len > 0.05) s.started = true;
    const running = s.started && !s.dead && !s.choosing;

    if (running) {
      s.t += dt;
      s.x = clamp(s.x + mx * st.moveSpeed * dt, -WORLD, WORLD);
      s.y = clamp(s.y + my * st.moveSpeed * dt, -WORLD, WORLD);
      s.hp = Math.min(st.maxHp, s.hp + st.regen * dt);

      // spawning
      s.spawn -= dt;
      if (s.spawn <= 0) {
        const rate = Math.min(7, 0.9 + s.t * 0.035);
        s.spawn = 1 / rate;
        spawnEnemy(W);
        if (s.t > 60 && rng.chance(0.2)) for (let i = 0; i < 3; i++) spawnEnemy(W, 'runner');
      }
      s.bossTimer -= dt;
      if (s.bossTimer <= 0) {
        s.bossTimer = 120;
        spawnEnemy(W, 'boss');
        floaters.add('A BOSS APPROACHES', s.x, s.y - 80, '#fda4af', 22, 1.6);
        api.sfx('explode');
      }

      // auto-fire at nearest enemy in range
      s.fire -= dt;
      let nearest: Enemy | null = null;
      let nd = 380 * 380;
      for (const e of s.enemies) {
        const d = dist2(e.x, e.y, s.x, s.y);
        if (d < nd) {
          nd = d;
          nearest = e;
        }
      }
      if (nearest) s.facing = Math.atan2(nearest.y - s.y, nearest.x - s.x);
      if (s.fire <= 0 && nearest) {
        s.fire = 1 / st.fireRate;
        const spread = 0.16;
        for (let i = 0; i < st.projectiles; i++) {
          const a = s.facing + (i - (st.projectiles - 1) / 2) * spread;
          s.bullets.push({ x: s.x, y: s.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, life: 0.9, pierce: st.pierce, hostile: false, hits: new Set() });
        }
        api.sfx('shoot');
      }

      // enemies
      for (const e of s.enemies) {
        const def = KINDS[e.kind];
        const dx = s.x - e.x;
        const dy = s.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        let speed = def.speed;
        if (e.kind === 'spitter' && d < 220) speed = -def.speed * 0.5;
        e.x += (dx / d) * speed * dt;
        e.y += (dy / d) * speed * dt;
        e.hit = Math.max(0, e.hit - dt);
        e.bladeCd = Math.max(0, e.bladeCd - dt);
        if (e.kind === 'spitter') {
          e.shoot -= dt;
          if (e.shoot <= 0 && d < 420) {
            e.shoot = rng.range(1.8, 2.8);
            s.bullets.push({ x: e.x, y: e.y, vx: (dx / d) * 190, vy: (dy / d) * 190, life: 3, pierce: 0, hostile: true, hits: new Set() });
          }
        }
        if (d < def.r + 14) {
          s.hp -= def.dmg * dt;
          s.hurt = 0.15;
        }
      }
      // soft separation so crowds spread out
      for (let i = 0; i < s.enemies.length; i++) {
        const a = s.enemies[i]!;
        for (let j = i + 1; j < s.enemies.length; j++) {
          const b = s.enemies[j]!;
          const rr = KINDS[a.kind].r + KINDS[b.kind].r;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0 && d2 < rr * rr) {
            const d = Math.sqrt(d2);
            const push = (rr - d) * 0.5;
            a.x -= (dx / d) * push;
            a.y -= (dy / d) * push;
            b.x += (dx / d) * push;
            b.y += (dy / d) * push;
          }
        }
      }

      // bullets
      for (const b of s.bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.hostile) {
          if (dist2(b.x, b.y, s.x, s.y) < 16 * 16) {
            s.hp -= 12;
            s.hurt = 0.2;
            b.life = 0;
            shake.add(4);
          }
          continue;
        }
        for (const e of s.enemies) {
          if (e.hp <= 0 || b.hits.has(e)) continue;
          const r = KINDS[e.kind].r + 4;
          if (dist2(b.x, b.y, e.x, e.y) < r * r) {
            b.hits.add(e);
            damageEnemy(e, st.damage);
            if (b.hits.size > b.pierce) {
              b.life = 0;
              break;
            }
          }
        }
      }
      s.bullets = s.bullets.filter((b) => b.life > 0);

      // orbit blades
      s.bladeAngle += dt * 3.2;
      if (st.blades > 0) {
        for (let i = 0; i < st.blades; i++) {
          const a = s.bladeAngle + (i / st.blades) * TAU;
          const bx = s.x + Math.cos(a) * 72;
          const by = s.y + Math.sin(a) * 72;
          for (const e of s.enemies) {
            if (e.hp <= 0 || e.bladeCd > 0) continue;
            const r = KINDS[e.kind].r + 12;
            if (dist2(bx, by, e.x, e.y) < r * r) {
              damageEnemy(e, st.damage * 0.8);
              e.bladeCd = 0.35;
            }
          }
        }
      }
      s.enemies = s.enemies.filter((e) => e.hp > 0);

      // gems
      for (const g of s.gems) {
        const d2 = dist2(g.x, g.y, s.x, s.y);
        if (d2 < st.magnet * st.magnet) {
          const d = Math.sqrt(d2) || 1;
          g.x += ((s.x - g.x) / d) * 420 * dt;
          g.y += ((s.y - g.y) / d) * 420 * dt;
        }
        if (d2 < 18 * 18) {
          s.xp += g.v;
          g.v = 0;
          if (rng.chance(0.4)) api.sfx('tick');
        }
      }
      s.gems = s.gems.filter((g) => g.v > 0);
      while (s.xp >= xpForLevel(s.level)) {
        s.xp -= xpForLevel(s.level);
        s.level += 1;
        s.pendingLevels += 1;
      }
      if (s.pendingLevels > 0 && !s.choosing) {
        s.pendingLevels -= 1;
        offerUpgrade();
      }

      const score = s.kills * 10 + Math.floor(s.t) * 5;
      if (score !== s.score) {
        s.score = score;
        api.setScore(score);
      }
      if (s.hp <= 0) {
        s.dead = true;
        s.deadTimer = 1.2;
        particles.burst(s.x, s.y, { count: 60, colors: ['#60a5fa', '#fff', '#f87171'], speed: 280, life: 1 });
        shake.add(16);
        api.sfx('gameover');
        api.haptic([100, 50, 100]);
      }
    }
    if (s.dead && !s.ended) {
      s.deadTimer -= dt;
      if (s.deadTimer <= 0) {
        s.ended = true;
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Survived', value: `${Math.floor(s.t / 60)}:${String(Math.floor(s.t % 60)).padStart(2, '0')}` },
            { label: 'Kills', value: String(s.kills) },
            { label: 'Level', value: String(s.level) },
          ],
        });
      }
    }
    s.hurt = Math.max(0, s.hurt - dt);
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    ctx.fillStyle = '#0b0b14';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);
    ctx.translate(W / 2 - s.x, H / 2 - s.y);
    ctx.fillStyle = '#12121f';
    ctx.fillRect(-WORLD - 20, -WORLD - 20, WORLD * 2 + 40, WORLD * 2 + 40);
    ctx.strokeStyle = 'rgba(248,113,113,0.07)';
    ctx.lineWidth = 1;
    const x0 = Math.floor((s.x - W / 2) / 64) * 64;
    const y0 = Math.floor((s.y - H / 2) / 64) * 64;
    for (let x = x0; x < s.x + W / 2; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, s.y - H / 2);
      ctx.lineTo(x, s.y + H / 2);
      ctx.stroke();
    }
    for (let y = y0; y < s.y + H / 2; y += 64) {
      ctx.beginPath();
      ctx.moveTo(s.x - W / 2, y);
      ctx.lineTo(s.x + W / 2, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 6;
    ctx.strokeRect(-WORLD - 20, -WORLD - 20, WORLD * 2 + 40, WORLD * 2 + 40);

    for (const g of s.gems) {
      ctx.fillStyle = g.v > 1 ? '#a78bfa' : '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - 6);
      ctx.lineTo(g.x + 4, g.y);
      ctx.lineTo(g.x, g.y + 6);
      ctx.lineTo(g.x - 4, g.y);
      ctx.fill();
    }
    for (const e of s.enemies) {
      const def = KINDS[e.kind];
      circle(ctx, e.x, e.y, def.r, e.hit > 0 ? '#fff' : def.color);
      const ang = Math.atan2(s.y - e.y, s.x - e.x);
      circle(ctx, e.x + Math.cos(ang) * def.r * 0.4, e.y + Math.sin(ang) * def.r * 0.4, def.r * 0.28, '#111');
      if (e.kind === 'boss' || e.kind === 'tank') {
        fillRoundRect(ctx, e.x - def.r, e.y - def.r - 10, def.r * 2, 4, 2, 'rgba(0,0,0,0.5)');
        fillRoundRect(ctx, e.x - def.r, e.y - def.r - 10, def.r * 2 * Math.max(0, e.hp / e.maxHp), 4, 2, '#f87171');
      }
    }
    for (const b of s.bullets) circle(ctx, b.x, b.y, b.hostile ? 6 : 4, b.hostile ? '#4ade80' : '#fde047');
    if (s.stats.blades > 0 && !s.dead) {
      for (let i = 0; i < s.stats.blades; i++) {
        const a = s.bladeAngle + (i / s.stats.blades) * TAU;
        ctx.save();
        ctx.translate(s.x + Math.cos(a) * 72, s.y + Math.sin(a) * 72);
        ctx.rotate(s.bladeAngle * 3);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-10, -3, 20, 6);
        ctx.fillRect(-3, -10, 6, 20);
        ctx.restore();
      }
    }
    if (!s.dead) {
      circle(ctx, s.x, s.y, 15, s.hurt > 0 ? '#fca5a5' : '#3b82f6');
      circle(ctx, s.x, s.y, 9, '#bfdbfe');
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(s.facing) * 20, s.y + Math.sin(s.facing) * 20);
      ctx.stroke();
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();
    stick.draw(ctx);

    // ---- HUD
    const barW = Math.min(W - 24, 360);
    const bx = (W - barW) / 2;
    fillRoundRect(ctx, bx, 10, barW, 12, 6, 'rgba(0,0,0,0.5)');
    fillRoundRect(ctx, bx, 10, barW * Math.max(0, s.hp / s.stats.maxHp), 12, 6, s.hp < s.stats.maxHp * 0.3 ? '#ef4444' : '#22c55e');
    fillRoundRect(ctx, bx, 26, barW, 7, 4, 'rgba(0,0,0,0.5)');
    fillRoundRect(ctx, bx, 26, barW * (s.xp / xpForLevel(s.level)), 7, 4, '#38bdf8');
    text(ctx, `Lv ${s.level}`, bx, 48, { size: 13, align: 'left', weight: 800, color: '#bae6fd' });
    text(ctx, `${Math.floor(s.t / 60)}:${String(Math.floor(s.t % 60)).padStart(2, '0')}`, W / 2, 48, { size: 14, weight: 800 });
    text(ctx, `☠ ${s.kills}`, bx + barW, 48, { size: 13, align: 'right', weight: 700, color: '#fca5a5' });
    if (!s.started) prompt(ctx, 'Drag or use WASD to move', W / 2, H * 0.7, s.t + performance.now() / 1000, 18);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={360}
      height={H}
      fit="fill"
      minAspect={0.5}
      maxAspect={1.9}
      label="Arena Survivor"
      onPointerDown={(p) => stick.down(p.id, p.x, p.y)}
      onPointerMove={(p) => stick.move(p.id, p.x, p.y)}
      onPointerUp={(p) => stick.up(p.id)}
    >
      {choices && (
        <div className={styles.choice} data-game-overlay>
          <div className={styles.panel}>
            <p className={styles.title}>Level {s.level}! Choose an upgrade</p>
            <div className={styles.cards}>
              {choices.map((u, i) => (
                <button
                  key={u.id}
                  type="button"
                  className={styles.card}
                  style={{ animationDelay: `${i * 60}ms` }}
                  onClick={() => choose(u)}
                  autoFocus={i === 0}
                >
                  <span className={styles.icon} aria-hidden="true">
                    {u.icon}
                  </span>
                  <span>
                    <span className={styles.name}>{u.title}</span>
                    <br />
                    <span className={styles.desc}>{u.describe(s.stats)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </CanvasStage>
  );
}
