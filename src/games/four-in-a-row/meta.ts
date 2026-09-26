import { defineMeta } from '../define';

export default defineMeta({
  id: 'four-in-a-row',
  title: 'Four in a Row',
  tagline: 'Drop discs, connect four, outthink the machine.',
  description:
    'The classic connect-four duel against a thinking AI. Drop discs into the grid and line up four in any direction before the computer does. Beat each difficulty to unlock the next.',
  howToPlay: [
    'Tap a column to drop your yellow disc.',
    'Connect four horizontally, vertically or diagonally to win.',
    'Win to unlock harder AI opponents — they score more.',
  ],
  categories: ['strategy', 'versus', 'brain'],
  tags: ['connect four', 'board game', 'ai', 'classic', 'versus'],
  difficulty: 'medium',
  controls: { desktop: 'Click a column, or ←/→ then Enter', touch: 'Tap a column' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 300, silver: 700, gold: 1200 },
  theme: { from: '#1d4ed8', to: '#0f172a', accent: '#facc15' },
  sessionLength: '1–3 min',
  orientation: 'any',
  realtime: false,
  dailyEligible: false,
  popularity: 78,
  addedAt: '2026-06-26',
});
