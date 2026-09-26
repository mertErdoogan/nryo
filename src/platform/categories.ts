import type { GameCategory } from './types';

export interface CategoryInfo {
  id: GameCategory;
  label: string;
  emoji: string;
  blurb: string;
  color: string;
}

export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'hyper-casual', label: 'Hyper Casual', emoji: '⚡', blurb: 'One touch. Instant fun.', color: '#facc15' },
  { id: 'arcade', label: 'Arcade', emoji: '🕹️', blurb: 'Classic coin-op energy.', color: '#f472b6' },
  { id: 'action', label: 'Action', emoji: '🔫', blurb: 'Shoot, dodge, survive.', color: '#f87171' },
  { id: 'racing', label: 'Racing', emoji: '🏎️', blurb: 'Speed, traffic and tight corners.', color: '#fb923c' },
  { id: 'puzzle', label: 'Puzzle', emoji: '🧩', blurb: 'Think, then conquer.', color: '#34d399' },
  { id: 'brain', label: 'Brain', emoji: '🧠', blurb: 'Quick thinking under pressure.', color: '#a78bfa' },
  { id: 'word', label: 'Word', emoji: '🔤', blurb: 'Letters, anagrams and guesses.', color: '#60a5fa' },
  { id: 'memory', label: 'Memory', emoji: '🃏', blurb: 'Remember more, every round.', color: '#c084fc' },
  { id: 'strategy', label: 'Strategy', emoji: '⚔️', blurb: 'Plan, build and outsmart.', color: '#2dd4bf' },
  { id: 'reflex', label: 'Reflex', emoji: '🎯', blurb: 'Fast hands win.', color: '#fb7185' },
  { id: 'physics', label: 'Physics', emoji: '🏀', blurb: 'Bounces, arcs and momentum.', color: '#fbbf24' },
  { id: 'endless', label: 'Endless', emoji: '♾️', blurb: 'How long can you last?', color: '#22d3ee' },
  { id: 'versus', label: 'Versus', emoji: '🤖', blurb: 'Take on AI rivals.', color: '#818cf8' },
];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): CategoryInfo | undefined {
  return byId.get(id as GameCategory);
}

export function isCategory(id: string): id is GameCategory {
  return byId.has(id as GameCategory);
}
