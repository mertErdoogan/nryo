import type { Rng } from '../../lib/rng';

export const SYMBOLS = [
  '🍎',
  '🍋',
  '🍇',
  '🍉',
  '🍒',
  '🥝',
  '🍍',
  '🥥',
  '🐶',
  '🐱',
  '🦊',
  '🐼',
  '🐸',
  '🐙',
  '🦋',
  '🐢',
  '🦄',
  '🐝',
  '⭐',
  '🌙',
  '⚡',
  '🔥',
  '💎',
  '🎈',
  '🎲',
  '🎸',
  '🚀',
  '⚽',
  '🌵',
  '🍩',
];

export interface Card {
  id: number;
  symbol: string;
  matched: boolean;
}

export function layoutForLevel(level: number): { cols: number; rows: number } {
  const layouts = [
    { cols: 3, rows: 4 },
    { cols: 4, rows: 4 },
    { cols: 4, rows: 5 },
    { cols: 4, rows: 6 },
    { cols: 5, rows: 6 },
  ];
  return layouts[Math.min(level - 1, layouts.length - 1)]!;
}

export function deal(level: number, rng: Rng): Card[] {
  const { cols, rows } = layoutForLevel(level);
  const pairs = (cols * rows) / 2;
  const symbols = rng.shuffle(SYMBOLS).slice(0, pairs);
  return rng.shuffle([...symbols, ...symbols]).map((symbol, id) => ({ id, symbol, matched: false }));
}

export const matchPoints = (combo: number) => 50 * Math.min(5, combo);
export const levelBonusSeconds = (level: number) => 8 + level * 2;
