export interface Building {
  id: string;
  name: string;
  icon: string;
  cost: number;
  rate: number;
}

export const BUILDINGS: Building[] = [
  { id: 'miner', name: 'Miner', icon: '⛏️', cost: 15, rate: 0.4 },
  { id: 'cart', name: 'Mine Cart', icon: '🛒', cost: 110, rate: 3 },
  { id: 'drill', name: 'Drill Rig', icon: '🔩', cost: 1_200, rate: 22 },
  { id: 'blast', name: 'Blast Crew', icon: '🧨', cost: 13_000, rate: 150 },
  { id: 'train', name: 'Ore Train', icon: '🚂', cost: 140_000, rate: 1_000 },
  { id: 'magma', name: 'Magma Bore', icon: '🌋', cost: 1_600_000, rate: 7_500 },
  { id: 'lab', name: 'Crystal Lab', icon: '💎', cost: 20_000_000, rate: 60_000 },
];

export const priceOf = (b: Building, owned: number, amount = 1) => {
  // Geometric series: cost × 1.15^owned × (1.15^amount − 1) / 0.15
  return Math.ceil((b.cost * Math.pow(1.15, owned) * (Math.pow(1.15, amount) - 1)) / 0.15);
};

export function maxAffordable(b: Building, owned: number, gold: number): number {
  let n = 0;
  while (n < 1000 && priceOf(b, owned, n + 1) <= gold) n++;
  return n;
}

export interface Upgrade {
  id: string;
  name: string;
  icon: string;
  cost: number;
  description: string;
  /** Visible once this condition holds. */
  visible: (s: EconomyState) => boolean;
}

export interface EconomyState {
  gold: number;
  runEarned: number;
  owned: number[];
  upgrades: string[];
  clicks: number;
}

const PICKAXES = [100, 1_500, 20_000, 300_000, 5_000_000];

export const UPGRADES: Upgrade[] = [
  ...PICKAXES.map((cost, i) => ({
    id: `pick-${i}`,
    name: ['Iron Pickaxe', 'Steel Pickaxe', 'Diamond Pickaxe', 'Laser Pickaxe', 'Quantum Pickaxe'][i]!,
    icon: '⛏️',
    cost,
    description: i >= 2 ? 'Tap power ×2, plus 2% of gold/s per tap' : 'Tap power ×2',
    visible: (s: EconomyState) => s.runEarned >= cost * 0.3,
  })),
  ...BUILDINGS.flatMap((b, i) =>
    [10, 25, 50].map((need, tier) => ({
      id: `b${i}-${tier}`,
      name: `${b.name} ${['Training', 'Overdrive', 'Mastery'][tier]}`,
      icon: b.icon,
      cost: Math.round(b.cost * [20, 200, 5_000][tier]!),
      description: `${b.name}s dig twice as fast`,
      visible: (s: EconomyState) => (s.owned[i] ?? 0) >= need,
    })),
  ),
  {
    id: 'lucky',
    name: 'Lucky Veins',
    icon: '🍀',
    cost: 5_000,
    description: '5% of taps strike a vein for ×15 gold',
    visible: (s) => s.clicks >= 100 || s.runEarned >= 2_000,
  },
];

export function buildingMultiplier(index: number, upgrades: readonly string[]): number {
  let m = 1;
  for (let tier = 0; tier < 3; tier++) if (upgrades.includes(`b${index}-${tier}`)) m *= 2;
  return m;
}

export const gemBonus = (gems: number) => 1 + gems * 0.05;

export function goldPerSecond(owned: readonly number[], upgrades: readonly string[], gems: number): number {
  let total = 0;
  BUILDINGS.forEach((b, i) => {
    total += (owned[i] ?? 0) * b.rate * buildingMultiplier(i, upgrades);
  });
  return total * gemBonus(gems);
}

export function tapPower(upgrades: readonly string[], gems: number, perSecond: number): number {
  let power = 1;
  let percent = 0;
  PICKAXES.forEach((_, i) => {
    if (upgrades.includes(`pick-${i}`)) {
      power *= 2;
      if (i >= 2) percent += 0.02;
    }
  });
  return (power + perSecond * percent) * gemBonus(gems);
}

export const DESCEND_AT = 1_000_000;
export const gemsForRun = (earned: number) =>
  earned < DESCEND_AT ? 0 : Math.floor(Math.sqrt(earned / DESCEND_AT) * 3);

export interface Goal {
  id: string;
  label: string;
  reward: number;
  progress: (s: EconomyState, perSecond: number) => [number, number];
}

export const GOALS: Goal[] = [
  { id: 'tap50', label: 'Tap the rock 50 times', reward: 50, progress: (s) => [s.clicks, 50] },
  { id: 'earn1k', label: 'Dig 1,000 gold', reward: 150, progress: (s) => [s.runEarned, 1_000] },
  { id: 'miner10', label: 'Hire 10 Miners', reward: 400, progress: (s) => [s.owned[0] ?? 0, 10] },
  { id: 'rate25', label: 'Reach 25 gold per second', reward: 1_000, progress: (_s, ps) => [ps, 25] },
  { id: 'earn50k', label: 'Dig 50,000 gold', reward: 5_000, progress: (s) => [s.runEarned, 50_000] },
  { id: 'blast', label: 'Recruit a Blast Crew', reward: 8_000, progress: (s) => [s.owned[3] ?? 0, 1] },
  { id: 'rate1k', label: 'Reach 1,000 gold per second', reward: 60_000, progress: (_s, ps) => [ps, 1_000] },
  { id: 'earn1m', label: 'Dig 1,000,000 gold', reward: 150_000, progress: (s) => [s.runEarned, 1_000_000] },
  { id: 'magma', label: 'Build a Magma Bore', reward: 800_000, progress: (s) => [s.owned[5] ?? 0, 1] },
  {
    id: 'earn50m',
    label: 'Dig 50,000,000 gold',
    reward: 5_000_000,
    progress: (s) => [s.runEarned, 50_000_000],
  },
];

/** Gold earned while away: half speed, capped at 8 hours. */
export function offlineEarnings(perSecond: number, awayMs: number): number {
  const seconds = Math.min(8 * 3600, Math.max(0, awayMs / 1000));
  return seconds < 30 ? 0 : perSecond * seconds * 0.5;
}
