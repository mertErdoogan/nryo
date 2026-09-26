import { angleDiff, TAU } from '../../lib/math';

/** Minimum angular separation (radians) between two stuck pins. */
export const PIN_CLEARANCE = 0.17;

export function collides(angle: number, stuck: readonly number[], clearance = PIN_CLEARANCE): boolean {
  return stuck.some((a) => Math.abs(angleDiff(a, angle)) < clearance);
}

export const normalizeAngle = (a: number) => ((a % TAU) + TAU) % TAU;

export interface LevelPlan {
  pins: number;
  preStuck: number;
  gems: number;
  baseSpeed: number;
  pattern: 'steady' | 'wave' | 'reverse' | 'stutter';
  boss: boolean;
}

export function planLevel(level: number): LevelPlan {
  const boss = level % 5 === 0;
  const patterns: LevelPlan['pattern'][] = ['steady', 'wave', 'reverse', 'stutter'];
  return {
    pins: Math.min(14, 5 + level + (boss ? 2 : 0)),
    preStuck: Math.min(6, Math.floor((level - 1) / 1.5) + (boss ? 2 : 0)),
    gems: level >= 2 ? 1 + (level % 3 === 0 ? 1 : 0) : 0,
    baseSpeed: Math.min(3.4, 1.5 + level * 0.12 + (boss ? 0.5 : 0)),
    pattern: boss ? 'reverse' : patterns[(level - 1) % patterns.length]!,
    boss,
  };
}

/** Angular velocity at time `t` for a plan (radians/s). */
export function angularVelocity(plan: LevelPlan, t: number): number {
  const b = plan.baseSpeed;
  switch (plan.pattern) {
    case 'wave':
      return b * (0.9 + 0.8 * Math.sin(t * 1.4));
    case 'reverse': {
      const cycle = 2.4;
      const phase = (t % cycle) / cycle;
      const dir = Math.floor(t / cycle) % 2 === 0 ? 1 : -1;
      return dir * b * 1.15 * Math.min(1, Math.sin(phase * Math.PI) * 1.8);
    }
    case 'stutter':
      return b * (Math.sin(t * 2.2) > -0.2 ? 1.25 : 0.1);
    default:
      return b;
  }
}
