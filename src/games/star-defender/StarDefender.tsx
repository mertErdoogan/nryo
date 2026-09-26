import { useRef } from 'react';
import {
  axisFromKeys,
  CanvasStage,
  FloatingText,
  makeStars,
  Particles,
  Shake,
  createContinueGate,
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, fillRoundRect, prompt, text } from '../../engine/draw';
import { clamp, dist2, TAU } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;

type Pattern = 'sine' | 'dive' | 'hover';
interface Enemy {
  x: number;
  y: number;
  baseX: number;
  t: number;
  hp: number;
  maxHp: number;
  r: number;
  pattern: Pattern;
  fire: number;
  hoverY: number;
  points: number;
  color: string;
  boss: boolean;
  hit: number;
  dir: number;
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  enemy: boolean;
}

type PowerKind = 'P' | 'S' | '+';

export function StarDefender({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const [hullColor, cockpitColor, flameColor] = lo.skin.colors;
  const fireDelay = 0.17 * (1 - 0.07 * lo.level('rapid'));
  const continueGate = useRef(createContinueGate(api)).current;
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const fx = useRef({
    particles: new Particles(700, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const s = useRef({
    x: W / 2,
    y: H - 110,
    drag: null as null | { id: number; px: number; py: number; sx: number; sy: number },
    gun: 1 + lo.level('guns'),
    shield: lo.level('shield') > 0 ? 1 : 0,
    lives: 3 + lo.level('lives'),
    waiting: false,
    invuln: 0,
    fire: 0,
    enemies: [] as Enemy[],
    shots: [] as Shot[],
    powers: [] as { x: number; y: number; kind: PowerKind }[],
    queue: [] as { at: number; spawn: () => Enemy }[],
    wave: 0,
    waveTimer: 1.2,
    clock: 0,
    started: false,
    dead: false,
    deadTimer: 0,
    ended: false,
    score: 0,
    time: 0,
    stars: makeStars(rng, 90, W, H),
    banner: '',
    bannerT: 0,
  }).current;

  const makeEnemy = (pattern: Pattern, x: number, hp: number, boss = false): Enemy => ({
    x,
    y: -30,
    baseX: x,
    t: 0,
    hp,
    maxHp: hp,
    r: boss ? 46 : hp >= 3 ? 18 : 14,
    pattern,
    fire: rng.range(1, 2.5),
    hoverY: rng.range(90, 230),
    points: boss ? 3000 : hp >= 3 ? 250 : hp === 2 ? 150 : 100,
    color: boss ? '#e11d48' : pattern === 'hover' ? '#a855f7' : pattern === 'dive' ? '#f97316' : '#22c55e',
    boss,
    hit: 0,
    dir: rng.chance(0.5) ? 1 : -1,
  });

  const startWave = () => {
    s.wave += 1;
    const w = s.wave;
    s.banner = w % 5 === 0 ? `Wave ${w} · BOSS` : `Wave ${w}`;
    s.bannerT = 1.6;
    api.sfx('powerup');
    const at = s.clock + 1;
    if (w % 5 === 0) {
      s.queue.push({ at, spawn: () => ({ ...makeEnemy('hover', W / 2, 60 + w * 22, true), hoverY: 110 }) });
      for (let i = 0; i < 4; i++)
        s.queue.push({ at: at + 3 + i * 2, spawn: () => makeEnemy('dive', rng.range(40, W - 40), 1) });
      return;
    }
    const count = 6 + w * 2;
    for (let i = 0; i < count; i++) {
      const roll = rng.next();
      const pattern: Pattern = w >= 3 && roll < 0.25 ? 'hover' : w >= 2 && roll < 0.55 ? 'dive' : 'sine';
      const hp = pattern === 'hover' ? 3 : w >= 4 && rng.chance(0.3) ? 2 : 1;
      const group = Math.floor(i / 4);
      const x = pattern === 'sine' ? 60 + ((group * 97) % (W - 120)) : rng.range(40, W - 40);
      s.queue.push({
        at: at + i * Math.max(0.28, 0.6 - w * 0.03) + group * 0.6,
        spawn: () => makeEnemy(pattern, x, hp),
      });
    }
  };

  const onDown = (p: StagePointer) => {
    s.started = true;
    s.drag = { id: p.id, px: p.x, py: p.y, sx: s.x, sy: s.y };
  };
  const onMove = (p: StagePointer) => {
    const d = s.drag;
    if (!d || d.id !== p.id) return;
    s.x = clamp(d.sx + (p.x - d.px) * 1.15, 16, W - 16);
    s.y = clamp(d.sy + (p.y - d.py) * 1.15, H * 0.35, H - 30);
  };
  const onUp = (p: StagePointer) => {
    if (s.drag?.id === p.id) s.drag = null;
  };

  const hitPlayer = () => {
    if (s.invuln > 0 || s.dead) return;
    const { particles, shake } = fx.current;
    if (s.shield > 0) {
      s.shield = 0;
      s.invuln = 1;
      particles.burst(s.x, s.y, { count: 20, colors: ['#93c5fd', '#fff'], speed: 200, life: 0.5 });
      api.sfx('hit');
      return;
    }
    s.lives -= 1;
    s.gun = Math.max(1 + lo.level('guns'), s.gun - 1);
    s.invuln = 2;
    shake.add(12);
    particles.burst(s.x, s.y, { count: 40, colors: ['#fb923c', '#fde047', '#fff'], speed: 260, life: 0.8 });
    api.sfx('explode');
    api.haptic([60, 40, 80]);
    if (s.lives <= 0) {
      s.dead = true;
      s.deadTimer = 1.2;
    }
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters, shake } = fx.current;
    s.time += dt;
    const axis = axisFromKeys(keys.current);
    if (axis.x || axis.y) {
      s.started = true;
      s.x = clamp(s.x + axis.x * 300 * dt, 16, W - 16);
      s.y = clamp(s.y + axis.y * 300 * dt, H * 0.35, H - 30);
    }

    if (s.started && !s.dead) {
      s.clock += dt;
      s.invuln = Math.max(0, s.invuln - dt);
      s.bannerT = Math.max(0, s.bannerT - dt);
      // spawn queue
      for (let i = s.queue.length - 1; i >= 0; i--) {
        if (s.queue[i]!.at <= s.clock) {
          s.enemies.push(s.queue[i]!.spawn());
          s.queue.splice(i, 1);
        }
      }
      if (s.queue.length === 0 && s.enemies.length === 0) {
        s.waveTimer -= dt;
        if (s.waveTimer <= 0) {
          if (s.wave > 0) {
            s.score += 500;
            api.setScore(s.score);
            api.addCoins(1);
          }
          startWave();
          s.waveTimer = 1.5;
        }
      }

      // player fire
      s.fire -= dt;
      if (s.fire <= 0) {
        s.fire = fireDelay;
        const spreads = s.gun === 1 ? [0] : s.gun === 2 ? [-8, 8] : [-12, 0, 12];
        for (const off of spreads)
          s.shots.push({ x: s.x + off, y: s.y - 18, vx: s.gun === 3 ? off * 6 : 0, vy: -620, enemy: false });
        if (Math.floor(s.clock * 6) % 2 === 0) api.sfx('shoot');
      }

      // enemies
      for (const e of s.enemies) {
        e.t += dt;
        e.hit = Math.max(0, e.hit - dt);
        if (e.pattern === 'sine') {
          e.y += 85 * dt;
          e.x = e.baseX + Math.sin(e.t * 2.2) * 70;
        } else if (e.pattern === 'dive') {
          if (e.y < 150) e.y += 140 * dt;
          else {
            e.y += 250 * dt;
            e.x += clamp(s.x - e.x, -160 * dt, 160 * dt);
          }
        } else {
          if (e.y < e.hoverY) e.y += 120 * dt;
          else {
            e.x += e.dir * (e.boss ? 70 : 60) * dt;
            if (e.x < e.r || e.x > W - e.r) e.dir *= -1;
          }
          e.fire -= dt;
          if (e.fire <= 0 && e.y >= e.hoverY - 5) {
            e.fire = e.boss ? 0.9 : rng.range(1.4, 2.4);
            if (e.boss) {
              const n = 7;
              for (let i = 0; i < n; i++) {
                const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.22 + Math.sin(e.t) * 0.3;
                s.shots.push({
                  x: e.x,
                  y: e.y + 30,
                  vx: Math.cos(a) * 190,
                  vy: Math.sin(a) * 190,
                  enemy: true,
                });
              }
            } else {
              const a = Math.atan2(s.y - e.y, s.x - e.x);
              s.shots.push({
                x: e.x,
                y: e.y + 10,
                vx: Math.cos(a) * 210,
                vy: Math.sin(a) * 210,
                enemy: true,
              });
            }
          }
        }
        if (dist2(e.x, e.y, s.x, s.y) < (e.r + 12) ** 2) {
          if (!e.boss) e.hp = 0;
          hitPlayer();
        }
      }
      // shots
      for (const sh of s.shots) {
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        if (sh.enemy) {
          if (dist2(sh.x, sh.y, s.x, s.y) < 11 * 11) {
            sh.y = H + 100;
            hitPlayer();
          }
          continue;
        }
        for (const e of s.enemies) {
          if (e.hp <= 0) continue;
          if (dist2(sh.x, sh.y, e.x, e.y) < (e.r + 4) ** 2) {
            e.hp -= 1;
            e.hit = 0.08;
            sh.y = -100;
            if (e.hp <= 0) {
              s.score += e.points;
              api.setScore(s.score);
              particles.burst(e.x, e.y, {
                count: e.boss ? 80 : 14,
                colors: [e.color, '#fde047', '#fff'],
                speed: e.boss ? 320 : 200,
                life: e.boss ? 1.2 : 0.5,
              });
              floaters.add(`+${e.points}`, e.x, e.y, '#fff', e.boss ? 26 : 14, 0.6);
              if (e.boss) {
                api.addCoins(5);
                shake.add(16);
                api.sfx('win');
                for (const k of ['P', 'S', '+'] as PowerKind[])
                  s.powers.push({ x: e.x + rng.range(-40, 40), y: e.y, kind: k });
              } else {
                api.sfx('hit');
                if (rng.chance(0.07))
                  s.powers.push({
                    x: e.x,
                    y: e.y,
                    kind: rng.chance(0.15) ? '+' : rng.chance(0.4) ? 'S' : 'P',
                  });
              }
            }
            break;
          }
        }
      }
      s.shots = s.shots.filter((sh) => sh.y > -20 && sh.y < H + 20 && sh.x > -20 && sh.x < W + 20);
      s.enemies = s.enemies.filter((e) => e.hp > 0 && e.y < H + 40);
      for (const p of s.powers) {
        p.y += 120 * dt;
        if (dist2(p.x, p.y, s.x, s.y) < 26 * 26) {
          p.y = H + 100;
          if (p.kind === 'P') s.gun = Math.min(3, s.gun + 1);
          else if (p.kind === 'S') s.shield = 1;
          else s.lives = Math.min(5, s.lives + 1);
          floaters.add(
            p.kind === 'P' ? 'Power up!' : p.kind === 'S' ? 'Shield!' : '+1 life',
            s.x,
            s.y - 30,
            '#93c5fd',
            16,
          );
          api.sfx('powerup');
        }
      }
      s.powers = s.powers.filter((p) => p.y < H + 20);
    } else if (s.dead && !s.ended && !s.waiting) {
      s.deadTimer -= dt;
      if (s.deadTimer <= 0) {
        s.waiting = true;
        continueGate(
          () => {
            s.lives = 2;
            s.shield = 1;
            s.invuln = 2.5;
            s.shots = s.shots.filter((sh) => !sh.enemy);
            s.dead = false;
            s.waiting = false;
            fx.current.floaters.add('Reinforcements!', W / 2, H * 0.45, '#86efac', 26, 1.2);
          },
          () => {
            s.ended = true;
            api.gameOver({ score: s.score, stats: [{ label: 'Wave reached', value: String(s.wave) }] });
          },
        );
      }
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---- render
    const ctx = v.ctx;
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, W, H);
    for (const st of s.stars) {
      st.y += st.speed * 90 * dt;
      if (st.y > H) st.y -= H;
      ctx.globalAlpha = st.alpha;
      ctx.fillStyle = '#fff';
      ctx.fillRect(st.x, st.y, st.r, st.r * 2.5);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    shake.apply(ctx);
    for (const p of s.powers) {
      const color = p.kind === 'P' ? '#f472b6' : p.kind === 'S' ? '#60a5fa' : '#4ade80';
      circle(ctx, p.x, p.y, 12, color);
      text(ctx, p.kind, p.x, p.y + 1, { size: 13, weight: 900, color: '#0f172a' });
    }
    for (const e of s.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      const c = e.hit > 0 ? '#fff' : e.color;
      if (e.boss) {
        fillRoundRect(ctx, -e.r, -e.r * 0.5, e.r * 2, e.r, 18, c);
        circle(ctx, 0, 0, e.r * 0.45, '#fda4af');
        ctx.fillStyle = c;
        ctx.fillRect(-e.r - 12, -6, 14, 30);
        ctx.fillRect(e.r - 2, -6, 14, 30);
      } else {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0, e.r);
        ctx.lineTo(e.r, -e.r * 0.4);
        ctx.lineTo(e.r * 0.4, -e.r * 0.8);
        ctx.lineTo(-e.r * 0.4, -e.r * 0.8);
        ctx.lineTo(-e.r, -e.r * 0.4);
        ctx.closePath();
        ctx.fill();
        circle(ctx, 0, -2, e.r * 0.3, 'rgba(255,255,255,0.8)');
      }
      ctx.restore();
      if (e.boss) {
        fillRoundRect(ctx, 30, 58, W - 60, 8, 4, 'rgba(255,255,255,0.15)');
        fillRoundRect(ctx, 30, 58, (W - 60) * (e.hp / e.maxHp), 8, 4, '#f43f5e');
      }
    }
    for (const sh of s.shots) {
      if (sh.enemy) circle(ctx, sh.x, sh.y, 5, '#f87171');
      else fillRoundRect(ctx, sh.x - 2, sh.y - 8, 4, 14, 2, '#fde047');
    }
    if (!s.dead && (s.invuln <= 0 || Math.floor(s.time * 12) % 2 === 0)) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = hullColor;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(14, 12);
      ctx.lineTo(5, 8);
      ctx.lineTo(0, 14);
      ctx.lineTo(-5, 8);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.fill();
      circle(ctx, 0, -4, 4, cockpitColor);
      circle(ctx, 0, 16 + Math.sin(s.time * 30) * 2, 4, flameColor);
      ctx.restore();
      if (s.shield > 0) {
        ctx.strokeStyle = 'rgba(96,165,250,0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 26, 0, TAU);
        ctx.stroke();
      }
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    text(ctx, s.score.toLocaleString('en'), 14, 24, { size: 18, weight: 850, align: 'left' });
    text(ctx, '♥'.repeat(Math.max(0, s.lives)), W - 14, 24, { size: 16, align: 'right', color: '#fb7185' });
    text(ctx, `Guns ${'▮'.repeat(s.gun)}`, W - 14, 44, { size: 11, align: 'right', color: '#f9a8d4' });
    if (s.bannerT > 0)
      text(ctx, s.banner, W / 2, H * 0.4, {
        size: 30,
        weight: 900,
        alpha: Math.min(1, s.bannerT),
        stroke: 'rgba(0,0,0,0.5)',
        strokeWidth: 6,
      });
    if (!s.started) prompt(ctx, 'Drag to fly — you fire automatically', W / 2, H * 0.55, s.time, 17);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Star Defender"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
