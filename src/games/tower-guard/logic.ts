export const COLS = 9;
export const ROWS = 13;
export const CELL = 40;
export const MAP_Y = 44;
export const WAVES = 15;

/** Path through grid cells (col, row), from entry (top) to exit (bottom). */
const WAYPOINTS: [number, number][] = [
  [1, -1],
  [1, 2],
  [7, 2],
  [7, 5],
  [2, 5],
  [2, 8],
  [6, 8],
  [6, 10],
  [1, 10],
  [1, 11],
  [4, 11],
  [4, 13],
];

export function pathCells(): Set<string> {
  const cells = new Set<string>();
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const [c0, r0] = WAYPOINTS[i]!;
    const [c1, r1] = WAYPOINTS[i + 1]!;
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    let c = c0;
    let r = r0;
    cells.add(`${c},${r}`);
    while (c !== c1 || r !== r1) {
      c += dc;
      r += dr;
      cells.add(`${c},${r}`);
    }
  }
  return cells;
}

/** Waypoints in pixel space (cell centres). */
export const PATH_POINTS = WAYPOINTS.map(([c, r]) => ({
  x: c * CELL + CELL / 2,
  y: MAP_Y + r * CELL + CELL / 2,
}));

export type TowerType = 'blaster' | 'frost' | 'cannon';

export const TOWERS: Record<
  TowerType,
  { name: string; cost: number; range: number; rate: number; damage: number; color: string; icon: string }
> = {
  blaster: { name: 'Blaster', cost: 50, range: 92, rate: 0.45, damage: 11, color: '#38bdf8', icon: '🔹' },
  frost: { name: 'Frost', cost: 70, range: 82, rate: 0.9, damage: 5, color: '#a5f3fc', icon: '❄️' },
  cannon: { name: 'Cannon', cost: 110, range: 112, rate: 1.35, damage: 30, color: '#fb923c', icon: '💣' },
};

export const upgradeCost = (type: TowerType, level: number) => Math.round(TOWERS[type].cost * 0.8 * level);
export const sellValue = (type: TowerType, level: number) => {
  let spent = TOWERS[type].cost;
  for (let l = 1; l < level; l++) spent += upgradeCost(type, l);
  return Math.round(spent * 0.6);
};
export const towerDamage = (type: TowerType, level: number) => TOWERS[type].damage * (1 + (level - 1) * 0.55);
export const towerRange = (type: TowerType, level: number) => TOWERS[type].range * (1 + (level - 1) * 0.1);

export type CreepKind = 'normal' | 'fast' | 'armored' | 'boss';
export const CREEPS: Record<
  CreepKind,
  { hp: number; speed: number; reward: number; r: number; color: string; leak: number }
> = {
  normal: { hp: 30, speed: 48, reward: 5, r: 10, color: '#f87171', leak: 1 },
  fast: { hp: 18, speed: 88, reward: 5, r: 8, color: '#facc15', leak: 1 },
  armored: { hp: 90, speed: 34, reward: 11, r: 13, color: '#a78bfa', leak: 2 },
  boss: { hp: 700, speed: 28, reward: 80, r: 18, color: '#e11d48', leak: 6 },
};

/** The creeps for wave `n` (1-based) in spawn order. */
export function waveCreeps(n: number): CreepKind[] {
  const out: CreepKind[] = [];
  const count = 7 + n * 2;
  for (let i = 0; i < count; i++) {
    if (n >= 3 && i % 5 === 4) out.push('fast');
    else if (n >= 5 && i % 6 === 5) out.push('armored');
    else out.push('normal');
  }
  if (n % 5 === 0) out.push('boss');
  if (n >= 8) for (let i = 0; i < Math.floor(n / 3); i++) out.push('fast');
  return out;
}

export const hpScale = (wave: number) => 1 + (wave - 1) * 0.2 + Math.max(0, wave - 8) * 0.12;
