import { defineMeta } from '../define';

export default defineMeta({
  id: 'merge-2048',
  title: '2048 Merge',
  tagline: 'Slide, merge, and chase the legendary 2048 tile.',
  description:
    'The classic sliding number puzzle. Swipe to move every tile; equal numbers merge into their sum. Plan ahead to keep the board open and reach 2048 — then keep going.',
  howToPlay: [
    'Swipe or use arrow keys to slide all tiles.',
    'Two equal tiles merge into one with their sum.',
    'Reach 2048 to win. The game ends when no moves remain.',
  ],
  categories: ['puzzle', 'brain'],
  tags: ['numbers', 'merge', 'sliding', 'math', 'classic'],
  difficulty: 'medium',
  controls: { desktop: 'Arrow keys or WASD', touch: 'Swipe on the board' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 2500, silver: 8000, gold: 20000 },
  theme: { from: '#f59e0b', to: '#7c2d12', accent: '#fbbf24' },
  sessionLength: '3–10 min',
  orientation: 'any',
  resumable: true,
  realtime: false,
  popularity: 90,
  addedAt: '2026-06-01',
});
