export type TargetKind = 'normal' | 'gold' | 'decoy';

export interface Target {
  x: number;
  y: number;
  age: number;
  life: number;
  maxR: number;
  kind: TargetKind;
}

/** Radius over the target's lifetime: quick bloom, then a steady shrink. */
export function radiusAt(t: Target): number {
  const p = t.age / t.life;
  if (p < 0.2) return t.maxR * (p / 0.2);
  return t.maxR * Math.max(0, 1 - (p - 0.2) / 0.8);
}

export const spawnInterval = (elapsed: number) => Math.max(0.36, 1.05 - elapsed * 0.012);
export const lifeFor = (elapsed: number) => Math.max(1.05, 2.2 - elapsed * 0.014);
export const sizeFor = (elapsed: number) => Math.max(22, 40 - elapsed * 0.2);

/** Points for a hit at normalised distance `d` (0 = bullseye, 1 = rim). */
export function hitPoints(kind: TargetKind, d: number, combo: number): number {
  if (kind === 'gold') return 50;
  const precision = Math.round((1 - Math.min(1, d)) * 10);
  return (10 + precision) * Math.min(4, 1 + Math.floor(combo / 5));
}
