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
  useGameLoop,
  useHeldKeys,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView } from '../../engine';
import type { GameProps } from '../../platform/types';

const H = 480;
const PLAYER_X = 110;
const PW = 22;
const PH = 34;
const GRAVITY = 2300;
const JUMP_V = -780;
const AIR_JUMP_V = -700;
const PX_PER_M = 12;

interface Roof {
  x: number;
  w: number;
  y: number;
}
type HazardKind = 'spike' | 'crate' | 'drone';
interface Hazard {
  kind: HazardKind;
  x: number;
  y: number;
  w: number;
  h: number;
  phase: number;
}

export function NinjaRun({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const lo = api.loadout;
  const airJumps = 1 + lo.level('jumps');
  const glide = lo.level('glide');
  const magnet = lo.level('magnet') > 0 ? 40 + 25 * lo.level('magnet') : 0;
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    roofs: [{ x: -200, w: 900, y: 340 }] as Roof[],
    hazards: [] as Hazard[],
    coins: [] as { x: number; y: number; taken: boolean }[],
    dist: 0,
    speed: 300,
    y: 340 - PH,
    vy: 0,
    grounded: true,
    jumpsLeft: airJumps,
    holdT: 0,
    holding: false,
    pointerHold: false,
    shields: lo.level('shield'),
    invuln: 0,
    dead: false,
    deadT: 0,
    started: false,
    score: 0,
    coinCount: 0,
    clock: 0,
    runAnim: 0,
  }).current;

  const generate = (upTo: number) => {
    let last = s.roofs[s.roofs.length - 1]!;
    while (last.x + last.w < upTo) {
      const m = s.dist / PX_PER_M;
      const gap = rng.range(70, 110 + Math.min(90, m / 20));
      const w = rng.range(260, 560);
      const y = Math.min(400, Math.max(250, last.y + rng.range(-70, 60)));
      const roof = { x: last.x + last.w + gap, w, y };
      s.roofs.push(roof);
      // hazards on the roof (keep the landing zone clear)
      let hx = roof.x + 110;
      while (hx < roof.x + w - 80) {
        const r = rng.next();
        if (r < 0.28 && m > 30)
          s.hazards.push({ kind: 'spike', x: hx, y: roof.y - 18, w: 36, h: 18, phase: 0 });
        else if (r < 0.46) {
          const tall = rng.chance(0.35) ? 2 : 1;
          s.hazards.push({ kind: 'crate', x: hx, y: roof.y - 32 * tall, w: 32, h: 32 * tall, phase: 0 });
          for (let i = 0; i < 3; i++)
            s.coins.push({ x: hx + 8 + i * 16 - 8, y: roof.y - 32 * tall - 28, taken: false });
        } else if (r < 0.58 && m > 150)
          s.hazards.push({
            kind: 'drone',
            x: hx,
            y: roof.y - rng.range(70, 110),
            w: 30,
            h: 18,
            phase: rng.range(0, 6),
          });
        else if (r < 0.85) {
          const n = rng.int(3, 6);
          const arc = rng.chance(0.5);
          for (let i = 0; i < n; i++)
            s.coins.push({
              x: hx + i * 22,
              y: roof.y - 30 - (arc ? Math.sin((i / (n - 1)) * Math.PI) * 70 : 0),
              taken: false,
            });
        }
        hx += rng.range(120, 220);
      }
      // coins arcing over the gap
      if (rng.chance(0.5))
        for (let i = 0; i < 4; i++)
          s.coins.push({
            x: roof.x - gap + (gap * (i + 0.5)) / 4,
            y: Math.min(last.y, roof.y) - 70 - Math.sin(((i + 0.5) / 4) * Math.PI) * 40,
            taken: false,
          });
      last = roof;
    }
  };

  const jump = () => {
    s.started = true;
    if (s.dead) return;
    if (s.grounded) {
      s.vy = JUMP_V;
      s.grounded = false;
      s.holdT = 0.18;
      api.sfx('jump');
    } else if (s.jumpsLeft > 0) {
      s.jumpsLeft -= 1;
      s.vy = AIR_JUMP_V;
      s.holdT = 0.1;
      fx.current.particles.burst(PLAYER_X, s.y + PH, { count: 10, color: '#e5e7eb', speed: 120, life: 0.4 });
      api.sfx('swap');
    }
  };

  useKeyDown((code) => {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') jump();
  }, !paused);

  const die = () => {
    if (s.invuln > 0 || s.dead) return;
    if (s.shields > 0) {
      s.shields -= 1;
      s.invuln = 1.2;
      fx.current.shake.add(8);
      fx.current.floaters.add('Vest saved you!', PLAYER_X + 40, s.y - 20, '#93c5fd', 16);
      api.sfx('hit');
      return;
    }
    s.dead = true;
    s.deadT = 0.9;
    fx.current.shake.add(14);
    fx.current.particles.burst(PLAYER_X, s.y + PH / 2, {
      count: 30,
      colors: [lo.skin.colors[0], lo.skin.colors[1], '#fff'],
      speed: 240,
      life: 0.7,
    });
    api.sfx('explode');
    api.haptic([70, 40, 70]);
  };

  const revive = () => {
    // Put the ninja back on the roof under them, or the next one.
    const here = PLAYER_X + s.dist;
    let roof = s.roofs.find((r) => here >= r.x && here <= r.x + r.w - 60);
    if (!roof) {
      roof = s.roofs.find((r) => r.x > here)!;
      s.dist = roof.x + 30 - PLAYER_X;
    }
    s.y = roof.y - PH;
    s.vy = 0;
    s.grounded = true;
    s.jumpsLeft = airJumps;
    s.dead = false;
    s.invuln = 2;
    const reach = s.dist + PLAYER_X + 320;
    s.hazards = s.hazards.filter((h) => h.x > reach || h.x + h.w < s.dist);
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const width = v.width;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = keys.current;
    s.holding = s.pointerHold || k.has('Space') || k.has('ArrowUp') || k.has('KeyW');
    generate(s.dist + width + 400);

    if (s.started && !s.dead) {
      s.speed = Math.min(620, 300 + s.dist * 0.012);
      s.dist += s.speed * dt;
      s.invuln = Math.max(0, s.invuln - dt);
      let g = GRAVITY;
      if (s.holding && s.holdT > 0 && s.vy < 0) {
        s.holdT -= dt;
        g *= 0.45;
      }
      s.vy += g * dt;
      if (glide > 0 && s.holding && !s.grounded && s.vy > 0) s.vy = Math.min(s.vy, 170 - glide * 30);
      const prevBottom = s.y + PH;
      s.y += s.vy * dt;
      const px = PLAYER_X + s.dist;
      s.grounded = false;
      for (const r of s.roofs) {
        if (px + PW / 2 < r.x || px - PW / 2 > r.x + r.w) continue;
        if (prevBottom <= r.y + 2 && s.y + PH >= r.y && s.vy >= 0) {
          s.y = r.y - PH;
          s.vy = 0;
          s.grounded = true;
          s.jumpsLeft = airJumps;
        } else if (s.y + PH > r.y + 8 && prevBottom > r.y + 2 && px + PW / 2 - r.x < 20) {
          // ran into the side of a taller building
          die();
        }
      }
      for (const h of s.hazards) {
        if (h.kind === 'drone') h.y += Math.sin(s.clock * 3 + h.phase) * 30 * dt;
        const left = px - PW / 2;
        const right = px + PW / 2;
        if (right < h.x || left > h.x + h.w || s.y + PH < h.y || s.y > h.y + h.h) continue;
        if (h.kind === 'crate') {
          if (prevBottom <= h.y + 4 && s.vy >= 0) {
            s.y = h.y - PH;
            s.vy = 0;
            s.grounded = true;
            s.jumpsLeft = airJumps;
          } else die();
        } else if (h.kind === 'spike') {
          if (s.y + PH > h.y + 6) die();
        } else die();
      }
      for (const c of s.coins) {
        if (c.taken) continue;
        const d = Math.hypot(c.x - px, c.y - (s.y + PH / 2));
        if (magnet && d < magnet) {
          c.x += (px - c.x) * Math.min(1, dt * 10);
          c.y += (s.y + PH / 2 - c.y) * Math.min(1, dt * 10);
        }
        if (d < 22) {
          c.taken = true;
          s.coinCount += 1;
          api.addCoins(1);
          api.sfx('coin');
        }
      }
      if (s.y > H + 60) die();
      s.runAnim += dt * s.speed * 0.05;
      const m = Math.floor(s.dist / PX_PER_M);
      if (m !== s.score) {
        s.score = m;
        api.setScore(m);
      }
      s.roofs = s.roofs.filter((r) => r.x + r.w > s.dist - 100);
      s.hazards = s.hazards.filter((h) => h.x + h.w > s.dist - 100);
      s.coins = s.coins.filter((c) => !c.taken && c.x > s.dist - 50);
    } else if (s.dead && s.deadT > 0) {
      s.deadT -= dt;
      if (s.deadT <= 0)
        continueGate(revive, () =>
          api.gameOver({
            score: s.score,
            stats: [
              { label: 'Distance', value: `${s.score} m` },
              { label: 'Coins', value: String(s.coinCount) },
            ],
          }),
        );
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    // ---------- render ----------
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0f172a');
    sky.addColorStop(1, '#4c1d95');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, H);
    circle(ctx, width - 70, 70, 34, '#fef3c7');
    circle(ctx, width - 58, 62, 30, '#1e1b4b');
    for (let layer = 0; layer < 2; layer++) {
      const f = layer === 0 ? 0.15 : 0.35;
      ctx.fillStyle = layer === 0 ? '#1e1b4b' : '#171537';
      for (let i = -1; i < width / 50 + 2; i++) {
        const bx = i * 50 - ((s.dist * f) % 50);
        const seed = Math.floor((s.dist * f) / 50) + i + layer * 97;
        const bh = 60 + ((seed * 53) % 100) + layer * 40;
        ctx.fillRect(bx, H - 120 - bh, 44, bh + 120);
      }
    }
    ctx.save();
    shake.apply(ctx);
    ctx.translate(-s.dist, 0);
    for (const r of s.roofs) {
      if (r.x > s.dist + width + 50 || r.x + r.w < s.dist - 50) continue;
      ctx.fillStyle = '#0b0b1a';
      ctx.fillRect(r.x, r.y, r.w, H - r.y + 10);
      ctx.fillStyle = '#334155';
      ctx.fillRect(r.x - 4, r.y - 6, r.w + 8, 8);
      ctx.fillStyle = 'rgba(245,158,11,0.5)';
      for (let wx = r.x + 20; wx < r.x + r.w - 20; wx += 44)
        for (let wy = r.y + 30; wy < H; wy += 40) if ((wx * 7 + wy * 3) % 5 < 2) ctx.fillRect(wx, wy, 12, 14);
    }
    for (const h of s.hazards) {
      if (h.x > s.dist + width + 50 || h.x + h.w < s.dist - 50) continue;
      if (h.kind === 'spike') {
        ctx.fillStyle = '#e5e7eb';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(h.x + i * 12, h.y + h.h);
          ctx.lineTo(h.x + i * 12 + 6, h.y);
          ctx.lineTo(h.x + i * 12 + 12, h.y + h.h);
          ctx.fill();
        }
      } else if (h.kind === 'crate') {
        fillRoundRect(ctx, h.x, h.y, h.w, h.h, 3, '#92400e');
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 3;
        for (let yy = h.y; yy < h.y + h.h; yy += 32) {
          ctx.strokeRect(h.x + 3, yy + 3, h.w - 6, 26);
          ctx.beginPath();
          ctx.moveTo(h.x + 4, yy + 4);
          ctx.lineTo(h.x + h.w - 4, yy + 28);
          ctx.stroke();
        }
      } else {
        fillRoundRect(ctx, h.x, h.y, h.w, h.h, 6, '#475569');
        circle(ctx, h.x + h.w / 2, h.y + h.h / 2, 5, Math.floor(s.clock * 6) % 2 ? '#ef4444' : '#7f1d1d');
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(h.x - 6, h.y - 4, h.w + 12, 3);
      }
    }
    for (const c of s.coins)
      if (c.x > s.dist - 20 && c.x < s.dist + width + 20) drawCoin(ctx, c.x, c.y, 8, s.clock + c.x * 0.01);
    // ninja
    if (!s.dead) {
      const [body, band, eyes] = lo.skin.colors;
      const px = PLAYER_X + s.dist;
      ctx.save();
      ctx.translate(px, s.y);
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.clock * 14) % 2 ? 0.4 : 1;
      const legA = s.grounded ? Math.sin(s.runAnim) * 9 : 6;
      ctx.strokeStyle = body;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.lineTo(legA, PH);
      ctx.moveTo(0, 22);
      ctx.lineTo(-legA, PH);
      ctx.stroke();
      fillRoundRect(ctx, -9, 6, 18, 20, 6, body);
      circle(ctx, 0, 0, 10, body);
      ctx.fillStyle = band;
      ctx.fillRect(-10, -3, 20, 4);
      ctx.beginPath();
      ctx.moveTo(-9, -1);
      ctx.lineTo(-24, -8 + Math.sin(s.clock * 20) * 3);
      ctx.lineTo(-22, 3);
      ctx.fill();
      ctx.fillStyle = eyes;
      ctx.fillRect(2, -2, 7, 2);
      if (glide > 0 && s.holding && !s.grounded && s.vy > 0) {
        ctx.fillStyle = band;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(-4, 6);
        ctx.quadraticCurveTo(-30, -20, -44, 10);
        ctx.lineTo(-4, 18);
        ctx.fill();
      }
      ctx.restore();
      if (s.shields > 0) {
        ctx.strokeStyle = 'rgba(147,197,253,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, s.y + PH / 2 - 4, 26, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    hudPill(ctx, 10, 10, `${s.score} m`, { size: 14 });
    hudPill(ctx, width - 10, 10, String(s.coinCount), { align: 'right', coin: true, size: 14 });
    if (!s.started) prompt(ctx, 'Tap to jump', width / 2, H * 0.35, s.clock, 22);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={360}
      height={H}
      fit="fill"
      minAspect={0.75}
      maxAspect={2.2}
      label="Ninja Run game area"
      onPointerDown={() => {
        s.pointerHold = true;
        jump();
      }}
      onPointerUp={() => {
        s.pointerHold = false;
      }}
    />
  );
}
