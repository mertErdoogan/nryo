import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  circle,
  createContinueGate,
  fillRoundRect,
  hudPill,
  shade,
  text,
  useGameLoop,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import type { GameProps } from '../../platform/types';
import {
  GEARS,
  TRACK_M,
  botForTier,
  newCar,
  shiftUp,
  stepCar,
  type BotProfile,
  type CarParams,
  type CarState,
} from './sim';

const W = 360;
const H = 640;
const PX = 16; // pixels per metre in the race view
const PLAYER_SCREEN_X = 110;
const LANE_BOT = 200;
const LANE_ME = 282;
const PERKS: Record<string, number> = { muscle: 0.05, tuner: 0.1, super: 0.16, hyper: 0.24, gold: 0.1 };

type Phase = 'intro' | 'countdown' | 'race' | 'result';

function drawSideCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  body: string,
  dark: string,
  glass: string,
  wheelAngle: number,
  flame: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 18, 58, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (flame) {
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(-58, 2);
    ctx.lineTo(-92 - Math.random() * 16, 6);
    ctx.lineTo(-58, 10);
    ctx.fill();
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-58, 12);
  ctx.lineTo(-56, -4);
  ctx.lineTo(-30, -10);
  ctx.lineTo(-12, -24);
  ctx.lineTo(22, -24);
  ctx.lineTo(38, -10);
  ctx.lineTo(58, -6);
  ctx.lineTo(60, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(-8, -21);
  ctx.lineTo(20, -21);
  ctx.lineTo(32, -10);
  ctx.lineTo(-24, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(-58, 6, 118, 6);
  ctx.fillStyle = '#fde047';
  ctx.fillRect(52, -4, 7, 4);
  for (const wx of [-34, 36]) {
    circle(ctx, wx, 12, 11, '#0a0a0a');
    circle(ctx, wx, 12, 5, '#9ca3af');
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx + Math.cos(wheelAngle) * 5, 12 + Math.sin(wheelAngle) * 5);
    ctx.lineTo(wx - Math.cos(wheelAngle) * 5, 12 - Math.sin(wheelAngle) * 5);
    ctx.stroke();
  }
  ctx.restore();
}

export function DragRace({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const params = useRef<CarParams>({
    power: (1 + 0.06 * lo.level('engine')) * (1 + (PERKS[lo.skin.id] ?? 0)),
    grip: Math.min(1, 0.3 + 0.175 * lo.level('tires')),
    perfectFrom: 0.84 - 0.03 * lo.level('gearbox'),
    nitro: lo.level('nitro') > 0 ? 0.9 + 0.35 * lo.level('nitro') : 0,
  }).current;
  const fx = useRef({ particles: new Particles(200, rng.next), floaters: new FloatingText() });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    phase: 'intro' as Phase,
    phaseT: 0,
    tier: 0,
    wins: 0,
    score: 0,
    perfects: 0,
    bestEt: null as number | null,
    bot: botForTier(0, rng.range(-1, 1)) as BotProfile,
    me: newCar(params) as CarState,
    them: newCar(params) as CarState,
    greenAt: 0,
    reaction: null as number | null,
    botShiftAt: 0.86,
    result: null as null | { won: boolean; reason: string; me: number | null; them: number | null },
    lastShift: '' as string,
    shiftFlash: 0,
    clock: 0,
    waiting: false,
  }).current;

  const setupRace = () => {
    s.me = newCar(params);
    s.them = newCar(s.bot.params);
    s.phase = 'intro';
    s.phaseT = 0;
    s.reaction = null;
    s.result = null;
    s.greenAt = 2.1 + rng.range(0.2, 1.1);
    s.botShiftAt = rng.chance(s.bot.skill) ? 0.88 : rng.range(0.72, 0.8);
  };

  const finishRace = (won: boolean, reason: string) => {
    s.phase = 'result';
    s.phaseT = 0;
    s.result = { won, reason, me: s.me.finishTime, them: s.them.finishTime };
    if (won) {
      const pts = 100 + s.tier * 20;
      s.score += pts;
      s.wins += 1;
      if (s.me.finishTime !== null)
        s.bestEt = s.bestEt === null ? s.me.finishTime : Math.min(s.bestEt, s.me.finishTime);
      api.setScore(s.score);
      api.addCoins(5 + s.tier * 2);
      api.sfx('win');
      fx.current.floaters.add(`+${pts}`, W / 2, 150, '#86efac', 28, 1.2);
    } else {
      api.sfx('gameover');
    }
  };

  const afterResult = () => {
    if (!s.result || s.waiting) return;
    if (s.result.won) {
      s.tier += 1;
      s.bot = botForTier(s.tier, rng.range(-1, 1));
      setupRace();
      return;
    }
    s.waiting = true;
    continueGate(
      () => {
        s.waiting = false;
        setupRace();
      },
      () =>
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Races won', value: String(s.wins) },
            { label: 'Best time', value: s.bestEt === null ? '—' : `${s.bestEt.toFixed(2)} s` },
            { label: 'Perfect shifts', value: String(s.perfects) },
          ],
        }),
    );
  };

  const shift = () => {
    const now = s.phaseT;
    if (s.phase === 'intro') {
      s.phase = 'countdown';
      s.phaseT = 0;
      return;
    }
    if (s.phase === 'countdown') {
      if (now < s.greenAt) {
        s.me.launched = false;
        api.haptic([60, 40, 60]);
        finishRace(false, 'False start! You jumped the light.');
        return;
      }
      s.phase = 'race';
    }
    if (s.phase === 'race') {
      if (!s.me.launched) {
        s.me.launched = true;
        s.reaction = now - s.greenAt;
        fx.current.floaters.add(
          `Reaction ${(s.reaction * 1000).toFixed(0)} ms`,
          W / 2,
          110,
          s.reaction < 0.25 ? '#86efac' : '#fde68a',
          18,
        );
        api.sfx('jump');
        return;
      }
      const q = shiftUp(s.me, params);
      if (q) {
        s.lastShift = q;
        s.shiftFlash = 0.8;
        if (q === 'perfect') {
          s.perfects += 1;
          api.sfx('perfect');
          api.haptic(20);
        } else api.sfx(q === 'good' ? 'click' : 'miss');
      }
      return;
    }
    if (s.phase === 'result' && s.phaseT > 0.8) afterResult();
  };

  const nitro = () => {
    if (s.phase === 'race' && s.me.launched && s.me.nitroLeft > 0 && !s.me.nitroOn) {
      s.me.nitroOn = true;
      api.sfx('powerup');
    }
  };

  useKeyDown((code) => {
    if (code === 'Space' || code === 'ArrowUp' || code === 'Enter' || code === 'KeyW') shift();
    if (code === 'KeyN' || code === 'ArrowRight') nitro();
  }, !paused);

  const onDown = (p: StagePointer) => {
    if (p.y > H - 120 && p.x < 130 && params.nitro > 0) nitro();
    else shift();
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters } = fx.current;
    s.clock += dt;
    s.phaseT += dt;
    s.shiftFlash = Math.max(0, s.shiftFlash - dt);

    if (s.phase === 'countdown' && s.phaseT >= s.greenAt) s.phase = 'race';
    if (s.phase === 'race') {
      const raceT = s.phaseT - s.greenAt;
      if (!s.them.launched && raceT >= s.bot.reaction) s.them.launched = true;
      if (
        s.them.launched &&
        s.them.rpm >= s.botShiftAt &&
        s.them.shifting === 0 &&
        s.them.gear < GEARS.length - 1
      ) {
        shiftUp(s.them, s.bot.params);
        s.botShiftAt = rng.chance(s.bot.skill) ? 0.88 : rng.range(0.72, 0.8);
      }
      if (s.them.gear >= 2 && s.them.nitroLeft > 0 && !s.them.nitroOn) s.them.nitroOn = true;
      stepCar(s.me, params, dt);
      stepCar(s.them, s.bot.params, dt);
      if (s.me.launched && s.me.v > 5 && rng.chance(0.4))
        particles.burst(PLAYER_SCREEN_X - 60, LANE_ME + 14, {
          count: 1,
          color: 'rgba(203,213,225,0.5)',
          speed: 60,
          angle: Math.PI,
          spread: 0.8,
          life: 0.5,
          size: 8,
        });
      const meTotal = s.me.finishTime !== null ? s.me.finishTime + (s.reaction ?? 0) : null;
      const themTotal = s.them.finishTime !== null ? s.them.finishTime + s.bot.reaction : null;
      if (meTotal !== null && (themTotal === null || meTotal <= themTotal)) finishRace(true, 'You win!');
      else if (themTotal !== null && (meTotal === null || themTotal < meTotal))
        finishRace(false, `${s.bot.name} (bot) wins this one.`);
    }
    particles.update(dt);
    floaters.update(dt);

    // ---------- render ----------
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, W, H);
    const camX = s.me.x * PX;
    // sky + skyline
    const sky = ctx.createLinearGradient(0, 0, 0, 170);
    sky.addColorStop(0, '#1e1b4b');
    sky.addColorStop(1, '#7c2d12');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 170);
    ctx.fillStyle = '#111827';
    for (let i = 0; i < 14; i++) {
      const bx = ((((i * 60 - camX * 0.2) % 840) + 840) % 840) - 60;
      const bh = 40 + ((i * 37) % 70);
      ctx.fillRect(bx, 170 - bh, 44, bh);
      ctx.fillStyle = 'rgba(253,224,71,0.5)';
      for (let wy = 170 - bh + 8; wy < 162; wy += 12) ctx.fillRect(bx + 8 + ((wy * 7) % 20), wy, 4, 4);
      ctx.fillStyle = '#111827';
    }
    // track
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, 170, W, 150);
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(0, 170, W, 6);
    ctx.fillStyle = '#fbbf24';
    for (let x = -(camX % 60); x < W; x += 60) ctx.fillRect(x, 240, 30, 4);
    // distance markers and finish
    for (let m = 0; m <= TRACK_M; m += 50) {
      const mx = PLAYER_SCREEN_X + (m - s.me.x) * PX;
      if (mx < -20 || mx > W + 20) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(mx, 176, 2, 144);
      text(ctx, `${m}m`, mx + 4, 184, { size: 10, align: 'left', color: 'rgba(255,255,255,0.6)' });
    }
    const fx0 = PLAYER_SCREEN_X + (TRACK_M - s.me.x) * PX;
    if (fx0 < W + 20) {
      for (let r = 0; r < 12; r++)
        for (let c = 0; c < 2; c++) {
          ctx.fillStyle = (r + c) % 2 ? '#fff' : '#111';
          ctx.fillRect(fx0 + c * 8, 176 + r * 12, 8, 12);
        }
    }
    const [mb, md, mg] = lo.skin.colors;
    const botX = PLAYER_SCREEN_X + (s.them.x - s.me.x) * PX;
    drawSideCar(
      ctx,
      botX,
      LANE_BOT,
      s.bot.color[0],
      s.bot.color[1],
      shade(s.bot.color[0], 0.5),
      s.them.x * 0.4,
      s.them.nitroOn,
    );
    drawSideCar(ctx, PLAYER_SCREEN_X, LANE_ME, mb, md, mg, s.me.x * 0.4, s.me.nitroOn);
    text(ctx, `${s.bot.name} (bot)`, Math.max(40, Math.min(W - 40, botX)), LANE_BOT - 40, {
      size: 11,
      color: '#cbd5e1',
    });
    particles.draw(ctx);

    // Christmas tree lights
    if (s.phase === 'countdown' || (s.phase === 'race' && s.phaseT - s.greenAt < 1)) {
      const t = s.phaseT;
      fillRoundRect(ctx, W - 58, 20, 40, 118, 12, '#0a0a0a');
      const lit = (i: number) => t >= (i + 1) * (s.greenAt / 4);
      for (let i = 0; i < 3; i++)
        circle(ctx, W - 38, 42 + i * 30, 11, lit(i) && t < s.greenAt ? '#facc15' : '#3f3f46');
      fillRoundRect(ctx, W - 58, 140, 40, 36, 12, '#0a0a0a');
      circle(ctx, W - 38, 158, 11, t >= s.greenAt ? '#22c55e' : '#3f3f46');
    }

    // Tachometer
    const tx = W / 2;
    const ty = 460;
    const R = 96;
    const a0 = Math.PI * 0.75;
    const a1 = Math.PI * 2.25;
    const ang = (r: number) => a0 + (a1 - a0) * r;
    ctx.lineWidth = 16;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(tx, ty, R, a0, a1);
    ctx.stroke();
    ctx.strokeStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(tx, ty, R, ang(params.perfectFrom - 0.14), ang(params.perfectFrom));
    ctx.stroke();
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(tx, ty, R, ang(params.perfectFrom), ang(0.94));
    ctx.stroke();
    ctx.strokeStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(tx, ty, R, ang(0.97), a1);
    ctx.stroke();
    const needle = ang(
      s.me.launched ? s.me.rpm : s.phase === 'countdown' ? 0.3 + Math.sin(s.clock * 18) * 0.05 : 0.12,
    );
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(needle) * (R - 6), ty + Math.sin(needle) * (R - 6));
    ctx.stroke();
    circle(ctx, tx, ty, 10, '#f8fafc');
    text(ctx, s.me.launched ? String(s.me.gear + 1) : 'N', tx, ty + 42, {
      size: 34,
      weight: 850,
      color: '#fca5a5',
    });
    text(ctx, `${Math.round(s.me.v * 3.6)} km/h`, tx, ty + 74, { size: 15, color: '#cbd5e1' });
    if (s.shiftFlash > 0) {
      const col = s.lastShift === 'perfect' ? '#4ade80' : s.lastShift === 'good' ? '#fde047' : '#f87171';
      text(ctx, s.lastShift.toUpperCase(), tx, ty - 40, {
        size: 20,
        weight: 850,
        color: col,
        alpha: Math.min(1, s.shiftFlash * 2),
      });
    }

    // Buttons
    const label = s.phase === 'intro' ? 'READY' : !s.me.launched ? 'GO' : 'SHIFT';
    fillRoundRect(
      ctx,
      W - 132,
      H - 104,
      120,
      88,
      26,
      s.me.rpm >= params.perfectFrom && s.me.rpm <= 0.94 && s.me.launched ? '#16a34a' : '#b91c1c',
    );
    text(ctx, label, W - 72, H - 60, { size: 26, weight: 850 });
    if (params.nitro > 0) {
      fillRoundRect(
        ctx,
        12,
        H - 104,
        110,
        88,
        26,
        s.me.nitroOn ? '#0891b2' : s.me.nitroLeft > 0 ? '#155e75' : '#1f2937',
      );
      text(ctx, 'NITRO', 67, H - 70, { size: 17, weight: 850, color: '#a5f3fc' });
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(28, H - 48, 78 * (s.me.nitroLeft / Math.max(0.01, params.nitro)), 8);
    }

    // Top HUD
    hudPill(ctx, 10, 10, `Race ${s.tier + 1}`, { size: 14 });
    hudPill(ctx, 10, 44, `${Math.min(TRACK_M, s.me.x).toFixed(0)} / ${TRACK_M} m`, {
      size: 12,
      color: '#fde68a',
    });

    if (s.phase === 'intro') {
      fillRoundRect(ctx, 30, 70, W - 60, 84, 18, 'rgba(0,0,0,0.7)');
      text(ctx, `Race ${s.tier + 1} · vs ${s.bot.name} (bot)`, W / 2, 98, { size: 18, weight: 800 });
      text(ctx, 'Tap READY, then GO on green', W / 2, 128, { size: 14, color: '#cbd5e1' });
    }
    if (s.phase === 'result' && s.result) {
      fillRoundRect(ctx, 24, 60, W - 48, 110, 18, 'rgba(0,0,0,0.78)');
      text(ctx, s.result.won ? 'YOU WIN!' : 'YOU LOSE', W / 2, 90, {
        size: 28,
        weight: 900,
        color: s.result.won ? '#4ade80' : '#f87171',
      });
      text(ctx, s.result.reason, W / 2, 118, { size: 13, color: '#e2e8f0' });
      const f = (t: number | null, r: number) => (t === null ? '—' : `${(t + r).toFixed(2)} s`);
      text(
        ctx,
        `You ${f(s.result.me, s.reaction ?? 0)}  ·  Bot ${f(s.result.them, s.bot.reaction)}`,
        W / 2,
        144,
        { size: 13, color: '#fde68a' },
      );
      if (s.phaseT > 0.8)
        text(ctx, 'Tap to continue', W / 2, 186, { size: 14, alpha: 0.6 + Math.sin(s.clock * 5) * 0.3 });
    }
    floaters.draw(ctx);
  }, !paused);

  return <CanvasStage ref={view} width={W} height={H} label="Drag Race game area" onPointerDown={onDown} />;
}
