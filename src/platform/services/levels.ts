/** XP curve: reaching level L requires 50·L·(L−1) total XP (L2 = 100, L5 = 1 000, L10 = 4 500). */
export const xpForLevel = (level: number): number => 50 * level * (level - 1);

export function levelFromXp(xp: number): number {
  const safe = Math.max(0, xp);
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * safe)) / 2));
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  current: number;
  /** XP needed to go from this level to the next. */
  needed: number;
  ratio: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const needed = xpForLevel(level + 1) - base;
  const current = Math.max(0, xp - base);
  return { level, current, needed, ratio: needed > 0 ? Math.min(1, current / needed) : 0 };
}
