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
  hsl,
  hudPill,
  makeStars,
  prompt,
  text,
  useGameLoop,
  useHeldKeys,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { clamp, TAU } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const NAMES = ['Crimson Core', 'Hive Mother', 'Iron Warden', 'Void Lotus', 'Star Eater', 'Omega Prime'];

type Pattern = 'burst' | 'spiral' | 'aimed' | 'rain' | 'wave';
interface Boss {
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  hue: number;
  patterns: Pattern[];
  pattern: number;
  patternT: number;
  shotT: number;
  spin: number;
  flash: number;
  enter: number;
}

export function BossRush({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const dmg = 1 * (1 + 0.2 * lo.level('damage'));
  const rate = 11 * (1 + 0.1 * lo.level('rate'));
  const maxHp = 3 + lo.level('hull');
  const fx = useRef({
    particles: new Particles(500, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const stars = useRef(makeStars(rng, 60, W, H)).current;

  const makeBoss = (n: number): Boss => {
    const all: Pattern[] = ['burst', 'aimed', 'spiral', 'rain', 'wave'];
    const patterns = rng.shuffle(all).slice(0, Math.min(5, 2 + Math.floor(n / 2)));
    const hp = 160 * Math.pow(1.45, n);
    return {
      name: NAMES[n % NAMES.length]! + (n >= NAMES.length ? ` Mk ${Math.floor(n / NAMES.length) + 1}` : ''),
      hp,
      maxHp: hp,
      x: W / 2,
      y: -80,
      hue: (n * 67 + 340) % 360,
      patterns,
      pattern: 0,
      patternT: 5,
      shotT: 1,
      spin: 0,
      flash: 0,
      enter: 1.5,
    };
  };

  const s = useRef({
    x: W / 2,
    y: H - 90,
    boss: null as Boss | null,
    bossN: 0,
    nextBossT: 1,
    shots: [] as { x: number; y: number }[],
    bullets: [] as { x: number; y: number; vx: number; vy: number; r: number }[],
    coins: [] as { x: number; y: number; vy: number }[],
    fireT: 0,
    hp: maxHp,
    bombs: lo.level('bombs') + 1,
    bombFlash: 0,
    invuln: 0,
    dead: false,
    deadT: 0,
    started: false,
    score: 0,
    dmgDealt: 0,
    coinCount: 0,
    clock: 0,
    drag: null as null | { id: number; px: number; py: number; sx: number; sy: number },
  }).current;

  const bomb = () => {
    if (s.bombs <= 0 || s.dead || !s.started) return;
    s.bombs -= 1;
    s.bullets = [];
    s.bombFlash = 0.5;
    s.invuln = Math.max(s.invuln, 1);
    if (s.boss && s.boss.enter <= 0) {
      const d = s.boss.maxHp * 0.08;
      s.boss.hp -= d;
      s.dmgDealt += d;
    }
    fx.current.shake.add(14);
    api.sfx('explode');
  };
  useKeyDown((code) => {
    if (code === 'KeyB' || code === 'Space') bomb();
  }, !paused);

  const onDown = (p: StagePointer) => {
    s.started = true;
    if (p.x < 84 && p.y > H - 84) {
      bomb();
      return;
    }
    s.drag = { id: p.id, px: p.x, py: p.y, sx: s.x, sy: s.y };
  };
  const onMove = (p: StagePointer) => {
    if (s.drag?.id !== p.id) return;
    s.x = clamp(s.drag.sx + (p.x - s.drag.px) * 1.3, 14, W - 14);
    s.y = clamp(s.drag.sy + (p.y - s.drag.py) * 1.3, 120, H - 20);
  };
  const onUp = (p: StagePointer) => {
    if (s.drag?.id === p.id) s.drag = null;
  };

  const shoot = (b: Boss) => {
    const p = b.patterns[b.pattern]!;
    const lvl = s.bossN;
    const sp = 150 + Math.min(90, lvl * 12);
    if (p === 'burst') {
      const n = 12 + Math.min(12, lvl * 2);
      const off = rng.range(0, TAU);
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * TAU;
        s.bullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5 });
      }
      b.shotT = Math.max(0.6, 1.3 - lvl * 0.08);
    } else if (p === 'spiral') {
      for (let arm = 0; arm < 3; arm++) {
        const a = b.spin + (arm * TAU) / 3;
        s.bullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4 });
      }
      b.spin += 0.32;
      b.shotT = 0.09;
    } else if (p === 'aimed') {
      const a = Math.atan2(s.y - b.y, s.x - b.x);
      for (const off of [-0.18, 0, 0.18])
        s.bullets.push({
          x: b.x,
          y: b.y + 20,
          vx: Math.cos(a + off) * sp * 1.4,
          vy: Math.sin(a + off) * sp * 1.4,
          r: 5,
        });
      b.shotT = Math.max(0.35, 0.8 - lvl * 0.05);
    } else if (p === 'rain') {
      for (let i = 0; i < 2; i++)
        s.bullets.push({
          x: rng.range(10, W - 10),
          y: -10,
          vx: rng.range(-20, 20),
          vy: sp * rng.range(0.9, 1.3),
          r: 4,
        });
      b.shotT = Math.max(0.08, 0.18 - lvl * 0.01);
    } else {
      for (let i = 0; i < 7; i++) {
        const a = Math.PI / 2 + (i - 3) * 0.22 + Math.sin(s.clock * 2) * 0.4;
        s.bullets.push({ x: b.x, y: b.y + 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4 });
      }
      b.shotT = Math.max(0.4, 0.75 - lvl * 0.04);
    }
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    const mx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    const my = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (mx || my) {
      s.started = true;
      s.x = clamp(s.x + mx * 280 * dt, 14, W - 14);
      s.y = clamp(s.y + my * 280 * dt, 120, H - 20);
    }

    if (s.started && !s.dead) {
      s.invuln = Math.max(0, s.invuln - dt);
      s.bombFlash = Math.max(0, s.bombFlash - dt);
      if (!s.boss) {
        s.nextBossT -= dt;
        if (s.nextBossT <= 0) {
          s.boss = makeBoss(s.bossN);
          floaters.add(`⚠ ${s.boss.name} ⚠`, W / 2, H / 2 - 40, '#fda4af', 24, 1.8);
          api.sfx('levelup');
        }
      }
      // fire
      s.fireT -= dt;
      while (s.fireT <= 0) {
        s.fireT += 1 / rate;
        s.shots.push({ x: s.x - 6, y: s.y - 14 }, { x: s.x + 6, y: s.y - 14 });
      }
      for (const sh of s.shots) sh.y -= 900 * dt;
      const b = s.boss;
      if (b) {
        b.flash = Math.max(0, b.flash - dt);
        if (b.enter > 0) {
          b.enter -= dt;
          b.y += (110 - b.y) * Math.min(1, dt * 3);
        } else {
          b.x = W / 2 + Math.sin(s.clock * 0.7) * 100;
          b.y = 110 + Math.sin(s.clock * 1.3) * 16;
          b.patternT -= dt;
          if (b.patternT <= 0) {
            b.pattern = (b.pattern + 1) % b.patterns.length;
            b.patternT = rng.range(4, 6);
          }
          b.shotT -= dt;
          if (b.shotT <= 0) shoot(b);
        }
        for (const sh of s.shots) {
          if (sh.y > -10 && Math.abs(sh.x - b.x) < 60 && Math.abs(sh.y - b.y) < 36) {
            sh.y = -100;
            if (b.enter <= 0) {
              b.hp -= dmg;
              s.dmgDealt += dmg;
              b.flash = 0.04;
            }
          }
        }
        if (b.hp <= 0) {
          shake.add(20);
          particles.burst(b.x, b.y, {
            count: 90,
            colors: [hsl(b.hue, 80, 60), '#fde047', '#fff'],
            speed: 380,
            life: 1.1,
          });
          api.sfx('explode');
          const bonus = 500 * (s.bossN + 1);
          s.dmgDealt += bonus;
          floaters.add(`${b.name} destroyed! +${bonus}`, W / 2, 200, '#86efac', 18, 1.6);
          for (let i = 0; i < 8 + s.bossN * 2; i++)
            s.coins.push({
              x: b.x + rng.range(-60, 60),
              y: b.y + rng.range(-30, 30),
              vy: rng.range(60, 140),
            });
          s.bullets = [];
          s.boss = null;
          s.bossN += 1;
          s.nextBossT = 2.2;
          api.sfx('win');
        }
      }
      s.shots = s.shots.filter((sh) => sh.y > -10);
      for (const bl of s.bullets) {
        bl.x += bl.vx * dt;
        bl.y += bl.vy * dt;
        if (s.invuln <= 0 && Math.hypot(bl.x - s.x, bl.y - s.y) < bl.r + 4) {
          bl.y = H + 100;
          s.hp -= 1;
          s.invuln = 1.2;
          shake.add(8);
          api.sfx('hit');
          api.haptic(60);
          if (s.hp <= 0) {
            s.dead = true;
            s.deadT = 0.9;
            particles.burst(s.x, s.y, {
              count: 40,
              colors: [lo.skin.colors[0], lo.skin.colors[1], '#fde047'],
              speed: 260,
              life: 0.8,
            });
            api.sfx('explode');
          }
        }
      }
      s.bullets = s.bullets.filter((bl) => bl.y < H + 20 && bl.y > -40 && bl.x > -20 && bl.x < W + 20);
      for (const c of s.coins) {
        c.y += c.vy * dt;
        c.x += (s.x - c.x) * Math.min(1, dt * 1.5);
        if (Math.hypot(c.x - s.x, c.y - s.y) < 26) {
          c.y = H + 100;
          s.coinCount += 1;
          api.addCoins(1);
          api.sfx('coin');
        }
      }
      s.coins = s.coins.filter((c) => c.y < H + 20);
      const sc = Math.floor(s.dmgDealt);
      if (sc !== s.score) {
        s.score = sc;
        api.setScore(sc);
      }
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.dead = false;
            s.hp = maxHp;
            s.invuln = 2.5;
            s.bullets = [];
          },
          () =>
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Bosses beaten', value: String(s.bossN) },
                { label: 'Coins', value: String(s.coinCount) },
              ],
            }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);
    for (const st of stars) {
      const y = (st.y + s.clock * 60 * st.speed) % H;
      ctx.globalAlpha = st.alpha;
      ctx.fillStyle = '#fff';
      ctx.fillRect(st.x, y, st.r, st.r * 3);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    shake.apply(ctx);
    const b = s.boss;
    if (b) {
      const c1 = b.flash > 0 ? '#fff' : hsl(b.hue, 70, 45);
      const c2 = hsl(b.hue, 70, 30);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(-80, 0);
      ctx.lineTo(-50, -34);
      ctx.lineTo(50, -34);
      ctx.lineTo(80, 0);
      ctx.lineTo(50, 34);
      ctx.lineTo(-50, 34);
      ctx.fill();
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.moveTo(-64, 0);
      ctx.lineTo(-40, -24);
      ctx.lineTo(40, -24);
      ctx.lineTo(64, 0);
      ctx.lineTo(40, 24);
      ctx.lineTo(-40, 24);
      ctx.fill();
      ctx.rotate(s.clock);
      for (let i = 0; i < 6; i++) {
        ctx.rotate(TAU / 6);
        ctx.fillStyle = c2;
        ctx.fillRect(22, -3, 12, 6);
      }
      ctx.rotate(-s.clock - 1);
      circle(ctx, 0, 0, 20, '#fecdd3');
      const look = Math.atan2(s.y - b.y, s.x - b.x);
      circle(ctx, Math.cos(look) * 6, Math.sin(look) * 6, 9, c2);
      circle(ctx, Math.cos(look) * 8, Math.sin(look) * 8, 4, '#111');
      ctx.restore();
    }
    for (const sh of s.shots) fillRoundRect(ctx, sh.x - 1.5, sh.y - 6, 3, 12, 1.5, lo.skin.colors[2]);
    for (const bl of s.bullets) {
      circle(ctx, bl.x, bl.y, bl.r + 2, 'rgba(251,113,133,0.4)');
      circle(ctx, bl.x, bl.y, bl.r, '#fda4af');
    }
    for (const c of s.coins) drawCoin(ctx, c.x, c.y, 8, s.clock + c.x);
    if (!s.dead) {
      const [c0, c1, c2] = lo.skin.colors;
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 14) % 2 ? 0.35 : 1;
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.moveTo(s.x - 18, s.y + 14);
      ctx.lineTo(s.x - 6, s.y - 2);
      ctx.lineTo(s.x + 6, s.y - 2);
      ctx.lineTo(s.x + 18, s.y + 14);
      ctx.fill();
      ctx.fillStyle = c0;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 20);
      ctx.lineTo(s.x + 9, s.y + 12);
      ctx.lineTo(s.x - 9, s.y + 12);
      ctx.fill();
      circle(ctx, s.x, s.y + 16, 4 + Math.random() * 2, '#fb923c');
      circle(ctx, s.x, s.y, 4, c2);
      circle(ctx, s.x, s.y, 2, '#fff');
      ctx.globalAlpha = 1;
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();
    if (s.bombFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${s.bombFlash})`;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD
    if (b) {
      text(ctx, b.name, W / 2, 16, { size: 12, weight: 800, color: '#fecdd3' });
      fillRoundRect(ctx, 20, 26, W - 40, 10, 5, 'rgba(255,255,255,0.12)');
      fillRoundRect(ctx, 20, 26, (W - 40) * Math.max(0, b.hp / b.maxHp), 10, 5, hsl(b.hue, 80, 60));
    }
    for (let i = 0; i < maxHp; i++)
      text(ctx, i < s.hp ? '♥' : '♡', 18 + i * 18, 54, { size: 16, color: '#fb7185' });
    hudPill(ctx, W - 10, 42, String(s.coinCount), { align: 'right', coin: true, size: 12 });
    fillRoundRect(ctx, 12, H - 76, 64, 64, 32, s.bombs > 0 ? 'rgba(190,18,60,0.7)' : 'rgba(0,0,0,0.4)');
    text(ctx, 'BOMB', 44, H - 50, { size: 12, weight: 900 });
    text(ctx, `×${s.bombs}`, 44, H - 32, { size: 15, weight: 900 });
    if (!s.started) prompt(ctx, 'Drag to fly', W / 2, H * 0.6, s.clock, 22);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Boss Rush game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
