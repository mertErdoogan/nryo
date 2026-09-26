import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  circle,
  createContinueGate,
  drawCoin,
  hsl,
  hudPill,
  prompt,
  useGameLoop,
  useHeldKeys,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView } from '../../engine';
import type { GameProps } from '../../platform/types';

const H = 480;
const G = 400;
const S = 30;
const PLAYER_SCREEN_X = 110;
const GRAVITY = 2700;
const JUMP_V = -720;
const PAD_V = -1020;

type Kind = 'spike' | 'block' | 'pad' | 'orb';
interface Ob {
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  used?: boolean;
}

export function GeoJump({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const magnet = lo.level('magnet') > 0 ? 30 + 25 * lo.level('magnet') : 0;
  const coinChance = 0.35 + 0.12 * lo.level('lucky');
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    obs: [] as Ob[],
    coins: [] as { x: number; y: number; taken: boolean }[],
    checkpoints: [] as number[],
    genX: 600,
    x: 0,
    y: G - S,
    vy: 0,
    rot: 0,
    grounded: true,
    speed: 330,
    checkpoint: 0,
    shields: lo.level('shield'),
    invuln: 0,
    dead: false,
    deadT: 0,
    started: false,
    pointer: false,
    queuedTap: false,
    score: 0,
    coinCount: 0,
    attempts: 1,
    clock: 0,
  }).current;

  const spike = (x: number, y = G) => s.obs.push({ kind: 'spike', x, y: y - S, w: S, h: S });
  const block = (x: number, top: number, w = S, h = G - top) =>
    s.obs.push({ kind: 'block', x, y: top, w, h });
  const coin = (x: number, y: number) => {
    if (rng.chance(coinChance)) s.coins.push({ x, y, taken: false });
  };

  const genChunk = () => {
    const x = s.genX;
    s.checkpoints.push(x - 60);
    const lvl = Math.min(8, Math.floor(x / 3000));
    const pick = rng.int(0, 2 + lvl);
    let len = 0;
    switch (pick) {
      case 0:
        spike(x);
        coin(x + 15, G - 130);
        len = 60;
        break;
      case 1:
        spike(x);
        spike(x + S);
        coin(x + 30, G - 140);
        len = 90;
        break;
      case 2:
        block(x, G - S);
        spike(x + 150);
        coin(x + 15, G - 80);
        len = 200;
        break;
      case 3:
        block(x, G - S);
        block(x + 110, G - 2 * S);
        block(x + 220, G - 3 * S, S * 2);
        spike(x + 330);
        coin(x + 235, G - 3 * S - 40);
        len = 380;
        break;
      case 4:
        s.obs.push({ kind: 'pad', x, y: G - 6, w: S, h: 6 });
        for (let i = 0; i < 4; i++) spike(x + 70 + i * S);
        coin(x + 130, G - 230);
        len = 230;
        break;
      case 5:
        block(x, G - 2 * S, S, 2 * S);
        spike(x, G - 2 * S);
        spike(x + 150);
        spike(x + 150 + S);
        len = 230;
        break;
      case 6:
        for (let i = 0; i < 5; i++) spike(x + i * S);
        s.obs.push({ kind: 'orb', x: x + 60, y: G - 100, w: 26, h: 26 });
        coin(x + 75, G - 180);
        len = 190;
        break;
      case 7: {
        // floating platforms over a spike floor
        block(x, G - S);
        for (let i = 0; i < 6; i++) spike(x + S + i * S);
        block(x + 70, G - 2.5 * S, S * 3, S * 0.6);
        block(x + 210, G - S);
        coin(x + 115, G - 2.5 * S - 30);
        len = 260;
        break;
      }
      default:
        spike(x);
        block(x + 90, G - S);
        spike(x + 120);
        spike(x + 150);
        block(x + 180, G - S);
        coin(x + 135, G - 150);
        len = 230;
    }
    s.genX = x + len + rng.range(170, 260) - Math.min(60, lvl * 8);
  };

  const tap = () => {
    s.started = true;
    s.queuedTap = true;
  };
  useKeyDown((code) => {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') tap();
  }, !paused);

  const die = () => {
    if (s.dead || s.invuln > 0) return;
    if (s.shields > 0) {
      s.shields -= 1;
      s.invuln = 1;
      fx.current.floaters.add('Force field!', PLAYER_SCREEN_X + 30, s.y - 30, '#93c5fd', 16);
      api.sfx('hit');
      return;
    }
    s.dead = true;
    s.deadT = 0.8;
    fx.current.shake.add(12);
    fx.current.particles.burst(PLAYER_SCREEN_X, s.y + S / 2, {
      count: 36,
      colors: [lo.skin.colors[0], lo.skin.colors[1], '#fff'],
      speed: 280,
      life: 0.7,
      shape: 'square',
    });
    api.sfx('explode');
    api.haptic([60, 30, 60]);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const width = v.width;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    const holding = s.pointer || k.has('Space') || k.has('ArrowUp') || k.has('KeyW');
    while (s.genX < s.x + width + 400) genChunk();

    if (s.started && !s.dead) {
      s.invuln = Math.max(0, s.invuln - dt);
      s.speed = Math.min(470, 330 + s.x * 0.004);
      s.x += s.speed * dt;
      while (s.checkpoints.length && s.checkpoints[0]! < s.x) s.checkpoint = s.checkpoints.shift()!;
      const wantJump = s.queuedTap || holding;
      s.queuedTap = false;
      if (wantJump && s.grounded) {
        s.vy = JUMP_V;
        s.grounded = false;
        api.sfx('jump');
      } else if (wantJump) {
        const orb = s.obs.find(
          (o) =>
            o.kind === 'orb' && !o.used && Math.abs(o.x - s.x) < 34 && Math.abs(o.y - (s.y + S / 2)) < 40,
        );
        if (orb) {
          orb.used = true;
          s.vy = JUMP_V * 1.05;
          particles.burst(PLAYER_SCREEN_X, s.y + S / 2, {
            count: 14,
            color: '#fde047',
            speed: 160,
            life: 0.4,
          });
          api.sfx('powerup');
        }
      }
      const prevBottom = s.y + S;
      const prevTop = s.y;
      s.vy += GRAVITY * dt;
      s.y += s.vy * dt;
      s.grounded = false;
      if (s.y + S >= G) {
        s.y = G - S;
        s.vy = 0;
        s.grounded = true;
      }
      const left = s.x - S / 2;
      const right = s.x + S / 2;
      for (const o of s.obs) {
        if (o.x > right + 5 || o.x + o.w < left - 5) continue;
        if (o.kind === 'block') {
          if (right <= o.x || left >= o.x + o.w || s.y + S <= o.y || s.y >= o.y + o.h) continue;
          if (prevBottom <= o.y + 6 && s.vy >= 0) {
            s.y = o.y - S;
            s.vy = 0;
            s.grounded = true;
          } else if (prevTop >= o.y + o.h - 4 && s.vy < 0) {
            s.y = o.y + o.h;
            s.vy = 0;
          } else die();
        } else if (o.kind === 'spike') {
          const hx = o.x + 9;
          const hw = o.w - 18;
          if (right > hx && left < hx + hw && s.y + S > o.y + 10 && s.y < o.y + o.h) die();
        } else if (o.kind === 'pad') {
          if (right > o.x && left < o.x + o.w && s.y + S >= o.y - 2 && s.vy >= 0) {
            s.vy = PAD_V;
            s.grounded = false;
            api.sfx('powerup');
          }
        }
      }
      if (s.grounded) s.rot = Math.round(s.rot / (Math.PI / 2)) * (Math.PI / 2);
      else s.rot += 7.6 * dt;
      for (const c of s.coins) {
        if (c.taken) continue;
        const d = Math.hypot(c.x - s.x, c.y - (s.y + S / 2));
        if (magnet && d < magnet) {
          c.x += (s.x - c.x) * Math.min(1, dt * 10);
          c.y += (s.y + S / 2 - c.y) * Math.min(1, dt * 10);
        }
        if (d < 24) {
          c.taken = true;
          s.coinCount += 1;
          api.addCoins(1);
          api.sfx('coin');
        }
      }
      if (s.grounded && rng.chance(0.4))
        particles.burst(PLAYER_SCREEN_X - S / 2, G - 2, {
          count: 1,
          color: lo.skin.colors[0],
          speed: 60,
          angle: Math.PI,
          spread: 0.6,
          life: 0.3,
          size: 4,
          shape: 'square',
        });
      const sc = Math.floor(s.x / S);
      if (sc !== s.score) {
        s.score = sc;
        api.setScore(sc);
      }
      s.obs = s.obs.filter((o) => o.x + o.w > s.x - 300);
      s.coins = s.coins.filter((c) => !c.taken && c.x > s.x - 300);
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(
          () => {
            s.x = s.checkpoint;
            s.y = G - S;
            s.vy = 0;
            s.rot = 0;
            s.grounded = true;
            s.dead = false;
            s.invuln = 0.6;
            s.attempts += 1;
            for (const o of s.obs) o.used = false;
            floaters.add(`Attempt ${s.attempts}`, width / 2, 120, '#fff', 22, 1);
          },
          () =>
            api.gameOver({
              score: s.score,
              stats: [
                { label: 'Attempts', value: String(s.attempts) },
                { label: 'Coins', value: String(s.coinCount) },
              ],
            }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    const hue = 220 + Math.sin(s.x / 2000) * 60;
    const bg = ctx.createLinearGradient(0, 0, width, H);
    bg.addColorStop(0, hsl(hue, 70, 35));
    bg.addColorStop(1, hsl(hue + 80, 70, 30));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, H);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 12; i++) {
      const size = 30 + ((i * 37) % 60);
      const bx = ((((i * 131 - s.x * 0.2) % (width + 200)) + width + 200) % (width + 200)) - 100;
      ctx.fillRect(bx, 40 + ((i * 71) % 260), size, size);
    }
    ctx.save();
    shake.apply(ctx);
    const ox = PLAYER_SCREEN_X - s.x;
    ctx.fillStyle = hsl(hue, 60, 18);
    ctx.fillRect(0, G, width, H - G);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, G, width, 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let gx = ((ox % 60) + 60) % 60; gx < width; gx += 60) {
      ctx.strokeRect(gx, G + 2, 60, 60);
    }
    for (const o of s.obs) {
      const x = o.x + ox;
      if (x > width + 40 || x + o.w < -40) continue;
      if (o.kind === 'spike') {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, o.y + o.h);
        ctx.lineTo(x + o.w / 2, o.y);
        ctx.lineTo(x + o.w, o.y + o.h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (o.kind === 'block') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x, o.y, o.w, o.h);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, o.y + 1, o.w - 2, o.h - 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(x + 7, o.y + 7, o.w - 14, Math.max(0, o.h - 14));
      } else if (o.kind === 'pad') {
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.ellipse(x + o.w / 2, o.y + 4, o.w / 2, 6, 0, Math.PI, 0);
        ctx.fill();
      } else if (o.kind === 'orb') {
        const pulse = 1 + Math.sin(s.clock * 8) * 0.1;
        ctx.strokeStyle = o.used ? 'rgba(253,224,71,0.3)' : '#fde047';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, o.y, 13 * pulse + 5, 0, Math.PI * 2);
        ctx.stroke();
        circle(ctx, x, o.y, 11, o.used ? 'rgba(253,224,71,0.3)' : '#fde047');
      }
    }
    for (const c of s.coins) {
      const x = c.x + ox;
      if (x > -20 && x < width + 20) drawCoin(ctx, x, c.y, 9, s.clock + c.x);
    }
    if (!s.dead) {
      const [c0, c1, c2] = lo.skin.colors;
      ctx.save();
      ctx.translate(PLAYER_SCREEN_X, s.y + S / 2);
      ctx.rotate(s.rot);
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 14) % 2 ? 0.4 : 1;
      ctx.fillStyle = c0;
      ctx.fillRect(-S / 2, -S / 2, S, S);
      ctx.strokeStyle = c2;
      ctx.lineWidth = 3;
      ctx.strokeRect(-S / 2 + 1.5, -S / 2 + 1.5, S - 3, S - 3);
      ctx.fillStyle = c2;
      const id = lo.skin.id;
      if (id === 'robo') {
        ctx.fillRect(-9, -6, 18, 6);
        ctx.fillStyle = c1;
        ctx.fillRect(-7, 5, 14, 3);
      } else if (id === 'angry') {
        ctx.beginPath();
        ctx.moveTo(-10, -9);
        ctx.lineTo(-3, -5);
        ctx.lineTo(-10, -3);
        ctx.moveTo(10, -9);
        ctx.lineTo(3, -5);
        ctx.lineTo(10, -3);
        ctx.fill();
        ctx.fillRect(-6, 5, 12, 3);
      } else {
        ctx.fillRect(-9, -7, 6, 6);
        ctx.fillRect(3, -7, 6, 6);
        ctx.fillStyle = c1;
        ctx.fillRect(-8, 4, 16, 4);
      }
      ctx.restore();
      if (s.shields > 0) {
        ctx.strokeStyle = 'rgba(147,197,253,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(PLAYER_SCREEN_X, s.y + S / 2, 26, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    hudPill(ctx, 10, 10, `${s.score}`, { size: 15 });
    hudPill(ctx, width - 10, 10, String(s.coinCount), { align: 'right', coin: true, size: 14 });
    if (!s.started) prompt(ctx, 'Tap to start · tap to jump', width / 2, H * 0.4, s.clock, 20);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={360}
      height={H}
      fit="fill"
      minAspect={0.75}
      maxAspect={2.2}
      label="Geo Jump game area"
      onPointerDown={() => {
        s.pointer = true;
        tap();
      }}
      onPointerUp={() => {
        s.pointer = false;
      }}
    />
  );
}
