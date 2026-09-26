import { describe, expect, it } from 'vitest';
import { aiControls, makeCar, stepCar } from './physics';
import { buildTrack, LAPS, trackLength } from './track';

describe('turbo laps physics', () => {
  it('AI drivers complete the race in a sensible time and stay mostly on track', () => {
    const points = buildTrack();
    expect(trackLength(points)).toBeGreaterThan(2500);
    const car = makeCar(points, 0, 0, 2);
    let t = 0;
    let offTicks = 0;
    const dt = 1 / 60;
    while (car.lap < LAPS && t < 120) {
      const c = aiControls(car, points, 1);
      stepCar(car, points, c.steer, c.throttle, c.maxSpeed, dt);
      if (car.offTrack) offTicks++;
      t += dt;
    }
    expect(car.lap).toBe(LAPS);
    expect(t).toBeGreaterThan(20);
    expect(t).toBeLessThan(60);
    expect(offTicks / (t * 60)).toBeLessThan(0.1);
  });
});
