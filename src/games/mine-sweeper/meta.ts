import { defineMeta } from '../define';

export default defineMeta({
  id: 'mine-sweeper',
  title: 'Mine Sweeper',
  tagline: 'Read the numbers, flag the mines, clear the field.',
  description:
    'The timeless logic puzzle. Numbers tell you how many mines touch each square — deduce where they hide, flag them, and reveal every safe square. Your first tap is always safe.',
  howToPlay: [
    'Tap a square to reveal it. Numbers count neighbouring mines.',
    'Long-press, right-click or use 🚩 mode to flag a mine.',
    'Tap a satisfied number to clear around it. Faster wins score more.',
  ],
  categories: ['puzzle', 'brain', 'strategy'],
  tags: ['minesweeper', 'logic', 'deduction', 'classic', 'grid'],
  difficulty: 'medium',
  controls: { desktop: 'Left-click reveal, right-click flag', touch: 'Tap reveal, long-press flag' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1000, silver: 2600, gold: 5000 },
  theme: { from: '#64748b', to: '#0f172a', accent: '#f87171' },
  sessionLength: '1–8 min',
  orientation: 'any',
  resumable: true,
  realtime: false,
  popularity: 84,
  addedAt: '2026-06-11',
});
