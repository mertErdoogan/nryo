import { useRef } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  Shake,
  circle,
  createContinueGate,
  fillRoundRect,
  hudPill,
  prompt,
  text,
  useGameLoop,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { clamp } from '../../lib/math';
import type { GameProps } from '../../platform/types';

const W = 360;
const H = 640;
const GOAL_L = 58;
const GOAL_R = 302;
const BAR_Y = 150;
const LINE_Y = 262;
const BALL_X = W / 2;
const BALL_Y = 560;

type Phase = 'aim' | 'flight' | 'result';

export function PenaltyKick({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const lo = api.loadout;
  const flightTime = 0.72 * Math.pow(0.93, lo.level('power'));
  const spread = 16 * Math.pow(0.75, lo.level('accuracy'));
  const curveMul = 1 + 0.2 * lo.level('curve');
  const maxLives = 3 + lo.level('life');
  const fx = useRef({
    particles: new Particles(300, rng.next),
    floaters: new FloatingText(),
    shake: new Shake(rng.next),
  });
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    phase: 'aim' as Phase,
    path: [] as { x: number; y: number; t: number }[],
    shot: null as null | { tx: number; ty: number; curve: number; t: number },
    ball: { x: BALL_X, y: BALL_Y, scale: 1 },
    keeper: { x: W / 2, dive: 0, targetX: W / 2, react: 0, jump: 0 },
    target: null as null | { x: number; y: number; r: number },
    resultText: '',
    resultColor: '#fff',
    resultT: 0,
    lives: maxLives,
    goals: 0,
    streak: 0,
    score: 0,
    coins: 0,
    skill: 0,
    over: false,
    clock: 0,
  }).current;

  const newTarget = () => {
    s.target = rng.chance(0.55)
      ? {
          x: rng.chance(0.5) ? GOAL_L + rng.range(22, 50) : GOAL_R - rng.range(22, 50),
          y: BAR_Y + rng.range(22, 60),
          r: 18,
        }
      : null;
  };
  if (s.goals === 0 && s.target === null && s.clock === 0) newTarget();

  const onDown = (p: StagePointer) => {
    if (s.phase !== 'aim' || s.over) return;
    s.path = [{ x: p.x, y: p.y, t: s.clock }];
  };
  const onMove = (p: StagePointer) => {
    if (s.phase !== 'aim' || s.path.length === 0) return;
    s.path.push({ x: p.x, y: p.y, t: s.clock });
  };
  const onUp = (p: StagePointer) => {
    if (s.phase !== 'aim' || s.path.length === 0) return;
    s.path.push({ x: p.x, y: p.y, t: s.clock });
    const a = s.path[0]!;
    const b = s.path[s.path.length - 1]!;
    const len = a.y - b.y;
    if (len < 40) {
      s.path = [];
      return;
    }
    // curve = signed max deviation of the swipe from its straight line
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    let dev = 0;
    for (const q of s.path) {
      const d = ((q.x - a.x) * dy - (q.y - a.y) * dx) / L;
      if (Math.abs(d) > Math.abs(dev)) dev = d;
    }
    const height = clamp((len - 90) / 200, 0, 1.25);
    const tx = BALL_X + dx * 1.15 + rng.range(-spread, spread);
    const ty = LINE_Y - height * (LINE_Y - BAR_Y) + rng.range(-spread, spread) * 0.5;
    s.shot = { tx, ty, curve: clamp(-dev / 60, -1, 1) * curveMul, t: 0 };
    s.phase = 'flight';
    s.path = [];
    // the keeper guesses
    const guessErr = (1 - s.skill) * rng.range(-90, 90);
    s.keeper.targetX = clamp(tx + s.shot.curve * 25 + guessErr, GOAL_L + 20, GOAL_R - 20);
    s.keeper.react = 0.18 + (1 - s.skill) * 0.12;
    s.keeper.jump = ty < BAR_Y + 50 ? 1 : 0.5;
    api.sfx('jump');
  };

  const finishShot = (text2: string, color: string, goal: boolean) => {
    s.phase = 'result';
    s.resultT = 1.3;
    s.resultText = text2;
    s.resultColor = color;
    if (goal) {
      s.goals += 1;
      s.streak += 1;
      if (s.goals % 3 === 0) s.skill = Math.min(0.95, s.skill + 0.12);
    } else {
      s.streak = 0;
      s.lives -= 1;
    }
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const ctx = v.ctx;
    const { particles, floaters, shake } = fx.current;
    s.clock += dt;
    const k = s.keeper;

    if (s.phase === 'flight' && s.shot) {
      const sh = s.shot;
      sh.t += dt / flightTime;
      const t = Math.min(1, sh.t);
      s.ball.x = BALL_X + (sh.tx - BALL_X) * t + Math.sin(Math.PI * t) * sh.curve * 70;
      s.ball.y = BALL_Y + (sh.ty - BALL_Y) * t - Math.sin(Math.PI * t) * 40;
      s.ball.scale = 1 - t * 0.55;
      if (sh.t * flightTime > k.react) {
        k.x += clamp(k.targetX - k.x, -560 * dt, 560 * dt);
        k.dive = Math.min(1, k.dive + dt * 4);
      }
      if (sh.t >= 1) {
        const bx = s.ball.x;
        const by = s.ball.y;
        const inGoal = bx > GOAL_L + 6 && bx < GOAL_R - 6 && by > BAR_Y + 6 && by < LINE_Y;
        const keeperReach = 30 + k.dive * 34;
        const keeperTop = LINE_Y - 70 - k.jump * k.dive * 50;
        const saved = inGoal && Math.abs(bx - k.x) < keeperReach && by > keeperTop;
        if (!inGoal) {
          finishShot(by <= BAR_Y + 6 ? 'Over the bar!' : 'Wide!', '#fca5a5', false);
          api.sfx('miss');
        } else if (saved) {
          finishShot('SAVED!', '#fca5a5', false);
          shake.add(6);
          api.sfx('hit');
          api.haptic(50);
        } else {
          const cornerBonus = Math.min(bx - GOAL_L, GOAL_R - bx) < 40 || by < BAR_Y + 35 ? 50 : 0;
          let pts = 100 + cornerBonus + Math.min(5, s.streak) * 20;
          if (s.target && Math.hypot(bx - s.target.x, by - s.target.y) < s.target.r + 8) {
            pts += 200;
            s.coins += 3;
            api.addCoins(3);
            floaters.add('TARGET +200', s.target.x, s.target.y - 30, '#fde047', 18, 1.2);
            api.sfx('coin');
          }
          s.score += pts;
          api.setScore(s.score);
          finishShot(`GOAL! +${pts}`, '#86efac', true);
          particles.burst(bx, by, {
            count: 30,
            colors: ['#fff', '#86efac', '#fde047'],
            speed: 220,
            life: 0.8,
          });
          api.sfx('win');
        }
      }
    } else if (s.phase === 'result') {
      s.resultT -= dt;
      if (s.resultT <= 0) {
        if (s.lives <= 0 && !s.over) {
          s.over = true;
          continueGate(
            () => {
              s.over = false;
              s.lives = 1;
              reset();
            },
            () =>
              api.gameOver({
                score: s.score,
                stats: [
                  { label: 'Goals', value: String(s.goals) },
                  { label: 'Coins', value: String(s.coins) },
                ],
              }),
          );
        } else if (!s.over) reset();
      }
    } else if (s.phase === 'aim') {
      k.x = W / 2 + Math.sin(s.clock * 2) * 12;
    }
    particles.update(dt);
    floaters.update(dt);
    shake.update(dt);

    function reset() {
      s.phase = 'aim';
      s.shot = null;
      s.ball = { x: BALL_X, y: BALL_Y, scale: 1 };
      k.x = W / 2;
      k.dive = 0;
      newTarget();
    }

    // ---------- render ----------
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, 120);
    for (let i = 0; i < 30; i++)
      circle(ctx, (i * 53) % W, 40 + ((i * 29) % 70), 5, ['#ef4444', '#f8fafc', '#3b82f6'][i % 3]!);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? '#16a34a' : '#15803d';
      ctx.fillRect(0, 120 + i * 58, W, 58);
    }
    ctx.save();
    shake.apply(ctx);
    // box lines
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, LINE_Y);
    ctx.lineTo(W - 10, LINE_Y);
    ctx.moveTo(30, LINE_Y);
    ctx.lineTo(0, 470);
    ctx.moveTo(W - 30, LINE_Y);
    ctx.lineTo(W, 470);
    ctx.stroke();
    circle(ctx, BALL_X, BALL_Y + 8, 4, 'rgba(255,255,255,0.7)');
    // net
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(GOAL_L, BAR_Y, GOAL_R - GOAL_L, LINE_Y - BAR_Y);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (let x = GOAL_L; x < GOAL_R; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, BAR_Y);
      ctx.lineTo(x, LINE_Y);
      ctx.stroke();
    }
    for (let y = BAR_Y; y < LINE_Y; y += 12) {
      ctx.beginPath();
      ctx.moveTo(GOAL_L, y);
      ctx.lineTo(GOAL_R, y);
      ctx.stroke();
    }
    if (s.target) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.target.x, s.target.y, s.target.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(GOAL_L, LINE_Y);
    ctx.lineTo(GOAL_L, BAR_Y);
    ctx.lineTo(GOAL_R, BAR_Y);
    ctx.lineTo(GOAL_R, LINE_Y);
    ctx.stroke();
    // keeper
    const dir = Math.sign(k.targetX - W / 2) || 1;
    ctx.save();
    ctx.translate(k.x, LINE_Y - 34 - k.jump * k.dive * 30);
    ctx.rotate(dir * k.dive * 1.1 * (s.phase === 'aim' ? 0 : 1));
    fillRoundRect(ctx, -14, -18, 28, 38, 8, '#f97316');
    ctx.fillStyle = '#111827';
    ctx.fillRect(-12, 16, 24, 12);
    circle(ctx, 0, -28, 11, '#fcd34d');
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, -12);
    ctx.lineTo(-30, -30 - k.dive * 6);
    ctx.moveTo(12, -12);
    ctx.lineTo(30, -30 - k.dive * 6);
    ctx.stroke();
    circle(ctx, -32, -32 - k.dive * 6, 6, '#22c55e');
    circle(ctx, 32, -32 - k.dive * 6, 6, '#22c55e');
    ctx.restore();
    // ball
    const [b0, b1] = lo.skin.colors;
    const br = 16 * s.ball.scale;
    circle(ctx, s.ball.x, s.ball.y + br * 0.8, br * 0.9, 'rgba(0,0,0,0.2)');
    circle(ctx, s.ball.x, s.ball.y, br, b0);
    ctx.fillStyle = b1;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + s.clock * (s.phase === 'flight' ? 12 : 0);
      circle(ctx, s.ball.x + Math.cos(a) * br * 0.55, s.ball.y + Math.sin(a) * br * 0.55, br * 0.22, b1);
    }
    circle(ctx, s.ball.x, s.ball.y, br * 0.28, b1);
    // swipe trail
    if (s.path.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      s.path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    if (s.phase === 'result')
      text(ctx, s.resultText, W / 2, 330, {
        size: 34,
        weight: 900,
        color: s.resultColor,
        stroke: 'rgba(0,0,0,0.5)',
        strokeWidth: 6,
      });
    text(ctx, '❤️'.repeat(Math.max(0, s.lives)) + '🖤'.repeat(Math.max(0, maxLives - s.lives)), 14, 20, {
      size: 15,
      align: 'left',
    });
    hudPill(ctx, W - 10, 8, String(s.coins), { align: 'right', coin: true, size: 13 });
    text(ctx, `Keeper skill ${Math.round(s.skill * 100)}%`, W - 12, 52, {
      size: 11,
      align: 'right',
      color: '#cbd5e1',
      weight: 700,
    });
    if (s.phase === 'aim' && s.goals === 0 && s.lives === maxLives)
      prompt(ctx, 'Swipe up from the ball to shoot', W / 2, 470, s.clock, 17);
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Penalty Kick game area"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
