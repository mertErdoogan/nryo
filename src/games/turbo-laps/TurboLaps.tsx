import { useMemo, useRef } from 'react';
import {
  CanvasStage,
  ControlBar,
  Particles,
  TouchButton,
  useGameLoop,
  useHeldKeys,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { fillRoundRect, text } from '../../engine/draw';
import { formatClock } from '../../lib/format';
import { arr, num, obj, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import { aiControls, makeCar, MAX_SPEED, raceProgress, stepCar, type Car } from './physics';
import { buildTrack, LAPS, TRACK_WIDTH } from './track';

const H = 640;
const RIVALS = [
  { name: 'Blaze', color: '#3b82f6', skill: 0.985 },
  { name: 'Viper', color: '#22c55e', skill: 0.95 },
  { name: 'Nova', color: '#a855f7', skill: 0.91 },
];
const ORDINAL = ['1st', '2nd', '3rd', '4th'];

const progressSchema = obj({ bestTime: num({ min: 0 }), ghost: arr(num(), { max: 9000 }) });
type Progress = Infer<typeof progressSchema>;
export const progressSpec: VersionedSpec<Progress> = { version: 1, is: progressSchema.is };

function drawCar(ctx: CanvasRenderingContext2D, car: Car, color: string, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-15, -8, 32, 20);
  fillRoundRect(ctx, -17, -10, 34, 20, 6, color);
  fillRoundRect(ctx, 0, -7, 9, 14, 3, 'rgba(15,23,42,0.7)');
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-15, -1.5, 13, 3);
  ctx.fillStyle = '#111827';
  ctx.fillRect(-13, -12, 8, 3);
  ctx.fillRect(-13, 9, 8, 3);
  ctx.fillRect(7, -12, 8, 3);
  ctx.fillRect(7, 9, 8, 3);
  ctx.restore();
}

export function TurboLaps({ api, paused }: GameProps<unknown, Progress>) {
  const rng = useSeededRng(api.seed);
  const points = useMemo(() => buildTrack(), []);
  const path = useMemo(() => {
    const p = new Path2D();
    points.forEach((pt, i) => (i === 0 ? p.moveTo(pt.x, pt.y) : p.lineTo(pt.x, pt.y)));
    p.closePath();
    return p;
  }, [points]);
  const view = useRef<CanvasView | null>(null);
  const keys = useHeldKeys(!paused);
  const fx = useRef({ particles: new Particles(300, rng.next) });
  const ghostData = api.progress?.ghost ?? [];
  const s = useRef({
    player: makeCar(points, 0, 18, 8),
    rivals: RIVALS.map((r, i) => ({
      ...r,
      car: makeCar(points, 0, i % 2 === 0 ? -18 : 18, i === 0 ? 8 : 16 + i * 4),
      skill: r.skill * rng.range(0.985, 1.01),
    })),
    countdown: 3.2,
    t: 0,
    touches: new Map<number, number>(),
    touchSteer: 0,
    brake: false,
    finished: false,
    endTimer: 0,
    ended: false,
    record: [] as number[],
    recordTimer: 0,
    cam: { x: points[0]!.x, y: points[0]!.y },
    lapFlash: 0,
    lastLapTime: 0,
  }).current;

  const onDown = (p: StagePointer) => {
    const v = view.current;
    if (!v) return;
    s.touches.set(p.id, p.x < v.width / 2 ? -1 : 1);
  };
  const onUp = (p: StagePointer) => {
    s.touches.delete(p.id);
  };

  const position = () => {
    const n = points.length;
    const mine = raceProgress(s.player, n);
    return 1 + s.rivals.filter((r) => raceProgress(r.car, n) > mine).length;
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const W = v.width;
    const { particles } = fx.current;
    const k = keys.current;
    let steer =
      (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    for (const d of s.touches.values()) steer += d;
    steer += s.touchSteer;
    steer = Math.max(-1, Math.min(1, steer));
    const braking = k.has('ArrowDown') || k.has('KeyS') || s.brake;

    if (s.countdown > 0) {
      const before = Math.ceil(s.countdown);
      s.countdown -= dt;
      if (Math.ceil(s.countdown) !== before && s.countdown > 0) api.sfx('tick');
      if (s.countdown <= 0) api.sfx('powerup');
    } else {
      s.t += dt;
      const n = points.length;
      if (!s.player.finished) {
        const lapDone = stepCar(s.player, points, steer, braking ? -1 : 1, MAX_SPEED, dt);
        if (s.player.offTrack && s.player.speed > 60 && rng.chance(0.5)) {
          particles.burst(s.player.x, s.player.y, {
            count: 1,
            color: '#a3e635',
            speed: 40,
            life: 0.4,
            size: 4,
          });
        }
        if (lapDone) {
          const lapTime = s.t - s.player.lapStart;
          s.player.bestLap = Math.min(s.player.bestLap, lapTime);
          s.player.lapStart = s.t;
          s.lastLapTime = lapTime;
          s.lapFlash = 2;
          if (s.player.lap >= LAPS) {
            s.player.finished = true;
            s.player.finishTime = s.t;
            s.finished = true;
            s.endTimer = 1.6;
            const pos = position();
            api.setScore(Math.round(s.t * 1000));
            api.sfx(pos === 1 ? 'win' : 'score');
            const ms = Math.round(s.t * 1000);
            if (api.mode === 'normal' && (!api.progress || ms < api.progress.bestTime)) {
              api.saveProgress({ bestTime: ms, ghost: s.record });
            }
          } else api.sfx('coin');
        }
        s.recordTimer -= dt;
        if (s.recordTimer <= 0 && s.record.length < 9000 - 3) {
          s.recordTimer = 0.1;
          s.record.push(Math.round(s.player.x), Math.round(s.player.y), Math.round(s.player.angle * 100));
        }
      }
      for (const r of s.rivals) {
        if (r.car.finished) {
          r.car.speed = Math.max(0, r.car.speed - 200 * dt);
          r.car.x += Math.cos(r.car.angle) * r.car.speed * dt;
          r.car.y += Math.sin(r.car.angle) * r.car.speed * dt;
          continue;
        }
        const c = aiControls(r.car, points, r.skill);
        // Gentle rubber-banding keeps races close.
        const gap = raceProgress(r.car, n) - raceProgress(s.player, n);
        const band = gap > 40 ? 0.95 : gap < -60 ? 1.04 : 1;
        if (stepCar(r.car, points, c.steer, c.throttle, c.maxSpeed * band, dt) && r.car.lap >= LAPS) {
          r.car.finished = true;
          r.car.finishTime = s.t;
        }
      }
      // Car-to-car bumps.
      const all = [s.player, ...s.rivals.map((r) => r.car)];
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i]!;
          const b = all[j]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < 26) {
            const push = (26 - d) / 2;
            a.x -= (dx / d) * push;
            a.y -= (dy / d) * push;
            b.x += (dx / d) * push;
            b.y += (dy / d) * push;
            a.speed *= 0.97;
            b.speed *= 0.97;
            if (i === 0) api.sfx('tap');
          }
        }
      }
    }
    if (s.finished && !s.ended) {
      s.endTimer -= dt;
      if (s.endTimer <= 0) {
        s.ended = true;
        const pos = position();
        api.gameOver({
          score: Math.round(s.player.finishTime * 1000),
          won: pos === 1,
          stats: [
            { label: 'Finished', value: ORDINAL[pos - 1]! },
            { label: 'Best lap', value: formatClock(s.player.bestLap, true) },
          ],
        });
      }
    }
    s.lapFlash = Math.max(0, s.lapFlash - dt);
    particles.update(dt);

    // ---- camera (look ahead in the direction of travel)
    const lookX = s.player.x + Math.cos(s.player.angle) * Math.min(120, s.player.speed * 0.3);
    const lookY = s.player.y + Math.sin(s.player.angle) * Math.min(120, s.player.speed * 0.3);
    s.cam.x += (lookX - s.cam.x) * Math.min(1, dt * 4);
    s.cam.y += (lookY - s.cam.y) * Math.min(1, dt * 4);

    // ---- render
    const ctx = v.ctx;
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(Math.round(W / 2 - s.cam.x), Math.round(H / 2 - s.cam.y));
    // grass texture
    ctx.fillStyle = 'rgba(22, 101, 52, 0.6)';
    const gx0 = Math.floor((s.cam.x - W) / 80) * 80;
    const gy0 = Math.floor((s.cam.y - H) / 80) * 80;
    for (let x = gx0; x < s.cam.x + W; x += 80)
      for (let y = gy0; y < s.cam.y + H; y += 80) if (((x + y) / 80) % 2 === 0) ctx.fillRect(x, y, 80, 80);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = TRACK_WIDTH + 14;
    ctx.stroke(path);
    ctx.strokeStyle = '#dc2626';
    ctx.setLineDash([18, 18]);
    ctx.stroke(path);
    ctx.setLineDash([]);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = TRACK_WIDTH;
    ctx.stroke(path);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([22, 26]);
    ctx.stroke(path);
    ctx.setLineDash([]);
    // start/finish line
    const p0 = points[0]!;
    const p1 = points[1]!;
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(ang);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#fff' : '#111';
        ctx.fillRect(j * 8 - 8, -TRACK_WIDTH / 2 + i * (TRACK_WIDTH / 8), 8, TRACK_WIDTH / 8);
      }
    }
    ctx.restore();
    // ghost
    if (ghostData.length >= 6 && s.countdown <= 0) {
      const f = s.t / 0.1;
      const i = Math.min(Math.floor(f), ghostData.length / 3 - 2);
      const tt = Math.min(1, f - i);
      const gx = ghostData[i * 3]! + (ghostData[i * 3 + 3]! - ghostData[i * 3]!) * tt;
      const gy = ghostData[i * 3 + 1]! + (ghostData[i * 3 + 4]! - ghostData[i * 3 + 1]!) * tt;
      const ga = ghostData[i * 3 + 2]! / 100;
      drawCar(ctx, { x: gx, y: gy, angle: ga } as Car, '#e2e8f0', 0.35);
    }
    particles.draw(ctx);
    for (const r of s.rivals) drawCar(ctx, r.car, r.color);
    drawCar(ctx, s.player, '#ef4444');
    ctx.restore();

    // ---- HUD
    const pos = position();
    fillRoundRect(ctx, 10, 10, 120, 58, 14, 'rgba(0,0,0,0.5)');
    text(ctx, ORDINAL[pos - 1]!, 22, 32, {
      size: 24,
      weight: 850,
      align: 'left',
      color: pos === 1 ? '#fde047' : '#fff',
    });
    text(ctx, `Lap ${Math.min(LAPS, s.player.lap + 1)}/${LAPS}`, 22, 55, {
      size: 13,
      weight: 700,
      align: 'left',
      color: '#cbd5e1',
    });
    fillRoundRect(ctx, W - 130, 10, 120, 58, 14, 'rgba(0,0,0,0.5)');
    text(ctx, formatClock(s.player.finished ? s.player.finishTime : s.t, true), W - 20, 32, {
      size: 20,
      weight: 800,
      align: 'right',
    });
    text(
      ctx,
      api.progress ? `Ghost ${formatClock(api.progress.bestTime / 1000, true)}` : 'No ghost yet',
      W - 20,
      55,
      { size: 12, align: 'right', color: '#cbd5e1' },
    );
    // minimap
    const mm = 0.07;
    ctx.save();
    ctx.translate(W - 110, H - 100);
    fillRoundRect(ctx, -6, -6, 104, 78, 10, 'rgba(0,0,0,0.45)');
    ctx.scale(mm, mm);
    ctx.translate(-120, -100);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 40;
    ctx.stroke(path);
    for (const r of s.rivals) {
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(r.car.x, r.car.y, 45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(s.player.x, s.player.y, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (s.countdown > 0) {
      const n = Math.ceil(s.countdown);
      text(ctx, n > 3 ? '' : String(n), W / 2, H / 2 - 40, {
        size: 90,
        weight: 900,
        stroke: 'rgba(0,0,0,0.5)',
        strokeWidth: 10,
      });
    } else if (s.t < 0.8) {
      text(ctx, 'GO!', W / 2, H / 2 - 40, {
        size: 80,
        weight: 900,
        color: '#4ade80',
        stroke: 'rgba(0,0,0,0.5)',
        strokeWidth: 10,
      });
    }
    if (s.lapFlash > 0 && !s.player.finished) {
      text(ctx, `Lap ${formatClock(s.lastLapTime, true)}`, W / 2, 100, {
        size: 22,
        weight: 800,
        color: '#fde047',
        alpha: Math.min(1, s.lapFlash),
      });
    }
    if (s.player.finished)
      text(ctx, `${ORDINAL[pos - 1]} place!`, W / 2, H / 2 - 40, {
        size: 44,
        weight: 900,
        color: pos === 1 ? '#fde047' : '#fff',
        stroke: 'rgba(0,0,0,0.5)',
        strokeWidth: 8,
      });
  }, !paused);

  return (
    <CanvasStage
      ref={view}
      width={360}
      height={H}
      fit="fill"
      minAspect={0.5}
      maxAspect={1.9}
      label="Turbo Laps race track"
      onPointerDown={onDown}
      onPointerUp={onUp}
    >
      <ControlBar
        left={
          <>
            <TouchButton
              label="Steer left"
              onPress={() => (s.touchSteer = -1)}
              onRelease={() => (s.touchSteer = 0)}
            >
              ◀
            </TouchButton>
            <TouchButton
              label="Steer right"
              onPress={() => (s.touchSteer = 1)}
              onRelease={() => (s.touchSteer = 0)}
            >
              ▶
            </TouchButton>
          </>
        }
        right={
          <TouchButton
            label="Brake"
            size="small"
            onPress={() => (s.brake = true)}
            onRelease={() => (s.brake = false)}
          >
            ⏷
          </TouchButton>
        }
      />
    </CanvasStage>
  );
}
