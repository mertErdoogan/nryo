import { angleDiff } from '../../lib/math';
import { curvatureAhead, nearestIndex, TRACK_WIDTH, type Point } from './track';

export interface Car {
  x: number;
  y: number;
  angle: number;
  speed: number;
  index: number;
  lap: number;
  /** Laps are only counted after passing the far side of the circuit. */
  halfway: boolean;
  finished: boolean;
  finishTime: number;
  lapStart: number;
  bestLap: number;
  offTrack: boolean;
}

export const MAX_SPEED = 330;
export const OFFROAD_SPEED = 130;
export const ACCEL = 260;
export const TURN_RATE = 2.9;

export function makeCar(points: readonly Point[], startIndex: number, lateral: number, back: number): Car {
  const n = points.length;
  const p = points[(startIndex - back + n) % n]!;
  const q = points[(startIndex - back + 1 + n) % n]!;
  const angle = Math.atan2(q.y - p.y, q.x - p.x);
  return {
    x: p.x - Math.sin(angle) * lateral,
    y: p.y + Math.cos(angle) * lateral,
    angle,
    speed: 0,
    index: (startIndex - back + n) % n,
    lap: 0,
    halfway: false,
    finished: false,
    finishTime: 0,
    lapStart: 0,
    bestLap: Infinity,
    offTrack: false,
  };
}

/** Advances a car one step with steering in [-1, 1] and throttle in [-1, 1]. Returns true on lap completion. */
export function stepCar(
  car: Car,
  points: readonly Point[],
  steer: number,
  throttle: number,
  maxSpeed: number,
  dt: number,
): boolean {
  const n = points.length;
  const near = nearestIndex(points, car.x, car.y, car.index);
  car.offTrack = near.dist > TRACK_WIDTH / 2;
  const limit = car.offTrack ? OFFROAD_SPEED : maxSpeed;
  if (throttle > 0) car.speed = Math.min(limit, car.speed + ACCEL * throttle * dt);
  else if (throttle < 0) car.speed = Math.max(0, car.speed - 520 * -throttle * dt);
  if (car.speed > limit) car.speed = Math.max(limit, car.speed - 420 * dt);
  car.angle += steer * TURN_RATE * Math.min(1, car.speed / 120) * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  const prev = car.index;
  car.index = near.index;
  if (car.index > n * 0.4 && car.index < n * 0.6) car.halfway = true;
  // Wrapped past the start line going forward.
  if (prev > n * 0.85 && car.index < n * 0.15 && car.halfway) {
    car.lap += 1;
    car.halfway = false;
    return true;
  }
  return false;
}

/** Simple racing AI: aim at a point ahead on the centreline, slow for corners. */
export function aiControls(
  car: Car,
  points: readonly Point[],
  skill: number,
): { steer: number; throttle: number; maxSpeed: number } {
  const n = points.length;
  const look = 14 + Math.round(car.speed / 40);
  const target = points[(car.index + look) % n]!;
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  const diff = angleDiff(car.angle, desired);
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const curve = curvatureAhead(points, car.index + 6, 30);
  const maxSpeed = MAX_SPEED * skill * Math.max(0.55, 1 - curve * 0.45);
  return { steer, throttle: car.speed < maxSpeed ? 1 : -0.3, maxSpeed };
}

/** Total race progress used for positions. */
export const raceProgress = (car: Car, n: number) =>
  car.finished
    ? 1e9 - car.finishTime
    : car.lap * n + (car.halfway || car.index < n * 0.5 ? car.index : car.index - n);
