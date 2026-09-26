import type { ProgressSnapshot } from './types';

export interface Unlock {
  /** Human readable requirement, e.g. "Reach level 4". */
  label: string;
  isUnlocked(s: Pick<ProgressSnapshot, 'level'> & { achievements: Record<string, number> }): boolean;
}

const atLevel = (level: number): Unlock => ({
  label: level <= 1 ? 'Available from the start' : `Reach level ${level}`,
  isUnlocked: (s) => s.level >= level,
});

const withAchievement = (id: string, title: string): Unlock => ({
  label: `Unlock “${title}”`,
  isUnlocked: (s) => s.achievements[id] !== undefined,
});

export interface Avatar {
  id: string;
  glyph: string;
  name: string;
  unlock: Unlock;
}

export interface AccentTheme {
  id: string;
  name: string;
  accent: string;
  accent2: string;
  unlock: Unlock;
}

export const AVATARS: readonly Avatar[] = [
  { id: 'controller', glyph: '🎮', name: 'Controller', unlock: atLevel(1) },
  { id: 'alien', glyph: '👾', name: 'Space Invader', unlock: atLevel(2) },
  { id: 'rocket', glyph: '🚀', name: 'Rocket', unlock: atLevel(4) },
  { id: 'fox', glyph: '🦊', name: 'Fox', unlock: atLevel(6) },
  { id: 'octopus', glyph: '🐙', name: 'Octopus', unlock: atLevel(8) },
  { id: 'dragon', glyph: '🐉', name: 'Dragon', unlock: atLevel(12) },
  { id: 'crown', glyph: '👑', name: 'Crown', unlock: atLevel(16) },
  { id: 'brain', glyph: '🧠', name: 'Brain', unlock: withAchievement('brainiac', 'Big Brain') },
  { id: 'fire', glyph: '🔥', name: 'Fire', unlock: withAchievement('daily-streak-3', 'Hot Streak') },
  { id: 'trophy', glyph: '🏆', name: 'Trophy', unlock: withAchievement('gold-5', 'Golden Touch') },
  { id: 'lightning', glyph: '⚡', name: 'Lightning', unlock: withAchievement('action-hero', 'Action Hero') },
  { id: 'robot', glyph: '🤖', name: 'Robot', unlock: withAchievement('tactician', 'Tactician') },
];

export const ACCENTS: readonly AccentTheme[] = [
  { id: 'violet', name: 'Neon Violet', accent: '#8b5cf6', accent2: '#ec4899', unlock: atLevel(1) },
  { id: 'cyan', name: 'Electric Cyan', accent: '#06b6d4', accent2: '#6366f1', unlock: atLevel(3) },
  { id: 'sunset', name: 'Sunset Drive', accent: '#f97316', accent2: '#e11d48', unlock: atLevel(5) },
  { id: 'lime', name: 'Toxic Lime', accent: '#65a30d', accent2: '#0d9488', unlock: atLevel(8) },
  { id: 'gold', name: 'Gold Rush', accent: '#d97706', accent2: '#db2777', unlock: withAchievement('gold-1', 'Gold Rush') },
  { id: 'ocean', name: 'Deep Ocean', accent: '#2563eb', accent2: '#0891b2', unlock: withAchievement('daily-1', 'Daily Player') },
];

export const getAvatar = (id: string) => AVATARS.find((a) => a.id === id) ?? AVATARS[0]!;
export const getAccent = (id: string) => ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]!;
