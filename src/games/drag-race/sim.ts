/** Quarter-mile drag racing physics, shared by the player and the bots. */

export const TRACK_M = 402;
export const GEARS = [3.2, 2.2, 1.62, 1.24, 0.98] as const;
const K = 1 / (16 * GEARS[0]); // rpm (0..1 of redline) per m/s per ratio unit
const DRAG = 0.0017;
const SHIFT_TIME = 0.28;
const PERFECT_SHIFT_TIME = 0.08;

export type ShiftQuality = 'perfect' | 'good' | 'early' | 'late';

export interface CarParams {
  /** Peak acceleration in m/s² (1.0 = baseline). */
  power: number;
  /** Launch grip 0..1 (wheelspin reduction). */
  grip: number;
  /** Lower edge of the perfect-shift zone (fraction of redline). */
  perfectFrom: number;
  /** Seconds of nitro available. */
  nitro: number;
}

export interface CarState {
  v: number;
  x: number;
  gear: number;
  rpm: number;
  shifting: number;
  boost: number;
  nitroLeft: number;
  nitroOn: boolean;
  launched: boolean;
  t: number;
  finishTime: number | null;
  perfects: number;
}

export const newCar = (p: CarParams): CarState => ({
  v: 0,
  x: 0,
  gear: 0,
  rpm: 0.12,
  shifting: 0,
  boost: 0,
  nitroLeft: p.nitro,
  nitroOn: false,
  launched: false,
  t: 0,
  finishTime: null,
  perfects: 0,
});

const torque = (rn: number) => 0.62 + 0.62 * rn - 0.34 * rn * rn;

export function shiftQuality(rpm: number, p: CarParams): ShiftQuality {
  if (rpm >= 0.985) return 'late';
  if (rpm >= p.perfectFrom && rpm <= 0.94) return 'perfect';
  if (rpm >= p.perfectFrom - 0.14) return 'good';
  return 'early';
}

/** Shifts up one gear. Returns the quality or null when already in top gear. */
export function shiftUp(c: CarState, p: CarParams): ShiftQuality | null {
  if (!c.launched || c.gear >= GEARS.length - 1 || c.shifting > 0) return null;
  const q = shiftQuality(c.rpm, p);
  c.gear += 1;
  c.shifting = q === 'perfect' ? PERFECT_SHIFT_TIME : SHIFT_TIME;
  if (q === 'perfect') {
    c.boost = 0.6;
    c.perfects += 1;
  }
  return q;
}

export function stepCar(c: CarState, p: CarParams, dt: number): void {
  if (!c.launched || c.finishTime !== null) {
    if (!c.launched) c.rpm = 0.12;
    return;
  }
  c.t += dt;
  const ratio = GEARS[c.gear]!;
  c.rpm = Math.min(1, Math.max(0.12, c.v * ratio * K));
  let a = 0;
  if (c.shifting > 0) c.shifting = Math.max(0, c.shifting - dt);
  else if (c.rpm < 0.995) {
    a = 9.2 * p.power * torque(c.rpm) * Math.pow(ratio / GEARS[0], 0.75);
    if (c.t < 1.1) a *= 0.62 + 0.38 * p.grip; // wheelspin off the line
    if (c.boost > 0) a *= 1.1;
  }
  if (c.nitroOn && c.nitroLeft > 0) {
    a += 4.2;
    c.nitroLeft = Math.max(0, c.nitroLeft - dt);
    if (c.nitroLeft === 0) c.nitroOn = false;
  }
  c.boost = Math.max(0, c.boost - dt);
  a -= DRAG * c.v * c.v + 0.15;
  c.v = Math.max(0, c.v + a * dt);
  const prevX = c.x;
  c.x += c.v * dt;
  if (c.x >= TRACK_M && prevX < TRACK_M) {
    const over = (c.x - TRACK_M) / Math.max(0.001, c.v);
    c.finishTime = c.t - over;
  }
}

export interface BotProfile {
  name: string;
  params: CarParams;
  /** Chance of a perfect shift; otherwise a good one. */
  skill: number;
  reaction: number;
  color: [string, string];
}

const BOT_NAMES = [
  'Rookie Ray',
  'Dusty',
  'Nova',
  'Blaze',
  'Kilo',
  'Viper',
  'Ghost',
  'Titan',
  'Raven',
  'Apex',
  'Zenith',
  'Omega',
];
const BOT_COLORS: [string, string][] = [
  ['#94a3b8', '#334155'],
  ['#a16207', '#422006'],
  ['#0ea5e9', '#0c4a6e'],
  ['#f97316', '#431407'],
  ['#10b981', '#064e3b'],
  ['#84cc16', '#1a2e05'],
  ['#e2e8f0', '#1e293b'],
  ['#ef4444', '#450a0a'],
  ['#6366f1', '#1e1b4b'],
  ['#f43f5e', '#4c0519'],
  ['#eab308', '#1c1917'],
  ['#d946ef', '#2e1065'],
];

export function botForTier(tier: number, jitter: number): BotProfile {
  const i = Math.min(tier, BOT_NAMES.length - 1);
  return {
    name: tier < BOT_NAMES.length ? BOT_NAMES[i]! : `${BOT_NAMES[i]} ${tier - BOT_NAMES.length + 2}`,
    params: {
      power: 0.86 + tier * 0.052 + jitter * 0.02,
      grip: Math.min(1, 0.35 + tier * 0.06),
      perfectFrom: 0.84,
      nitro: tier >= 4 ? 0.8 + tier * 0.12 : 0,
    },
    skill: Math.min(0.92, 0.25 + tier * 0.07),
    reaction: Math.max(0.14, 0.34 - tier * 0.018),
    color: BOT_COLORS[i]!,
  };
}
