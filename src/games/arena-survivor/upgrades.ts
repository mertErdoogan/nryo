export interface Stats {
  damage: number;
  fireRate: number;
  projectiles: number;
  pierce: number;
  moveSpeed: number;
  maxHp: number;
  blades: number;
  magnet: number;
  regen: number;
}

export const BASE_STATS: Stats = {
  damage: 10,
  fireRate: 2.4,
  projectiles: 1,
  pierce: 0,
  moveSpeed: 185,
  maxHp: 100,
  blades: 0,
  magnet: 70,
  regen: 0,
};

export interface Upgrade {
  id: string;
  icon: string;
  title: string;
  describe: (s: Stats) => string;
  apply: (s: Stats) => Stats;
  max?: (s: Stats) => boolean;
}

export const UPGRADES: Upgrade[] = [
  { id: 'damage', icon: '💥', title: 'Heavy Rounds', describe: (s) => `Damage ${s.damage} → ${Math.round(s.damage * 1.25)}`, apply: (s) => ({ ...s, damage: Math.round(s.damage * 1.25) }) },
  { id: 'rate', icon: '⚡', title: 'Rapid Fire', describe: (s) => `Fire rate +20% (${s.fireRate.toFixed(1)}/s)`, apply: (s) => ({ ...s, fireRate: s.fireRate * 1.2 }) },
  { id: 'multi', icon: '🔱', title: 'Multishot', describe: (s) => `Projectiles ${s.projectiles} → ${s.projectiles + 1}`, apply: (s) => ({ ...s, projectiles: s.projectiles + 1 }), max: (s) => s.projectiles >= 7 },
  { id: 'pierce', icon: '🗡️', title: 'Piercing', describe: (s) => `Shots pass through ${s.pierce + 1} enemies`, apply: (s) => ({ ...s, pierce: s.pierce + 1 }), max: (s) => s.pierce >= 5 },
  { id: 'speed', icon: '👟', title: 'Swift Boots', describe: () => 'Move speed +12%', apply: (s) => ({ ...s, moveSpeed: s.moveSpeed * 1.12 }), max: (s) => s.moveSpeed > 320 },
  { id: 'hp', icon: '❤️', title: 'Vitality', describe: (s) => `Max HP ${s.maxHp} → ${s.maxHp + 25}, full heal`, apply: (s) => ({ ...s, maxHp: s.maxHp + 25 }) },
  { id: 'blades', icon: '🌀', title: 'Orbit Blades', describe: (s) => `${s.blades + 1} blade${s.blades ? 's' : ''} circle you`, apply: (s) => ({ ...s, blades: s.blades + 1 }), max: (s) => s.blades >= 6 },
  { id: 'magnet', icon: '🧲', title: 'Magnet', describe: () => 'Pick-up range +50%', apply: (s) => ({ ...s, magnet: s.magnet * 1.5 }), max: (s) => s.magnet > 300 },
  { id: 'regen', icon: '🩹', title: 'Regeneration', describe: (s) => `Heal ${s.regen + 1} HP per second`, apply: (s) => ({ ...s, regen: s.regen + 1 }), max: (s) => s.regen >= 5 },
];

export const xpForLevel = (level: number) => 5 + level * 5;
