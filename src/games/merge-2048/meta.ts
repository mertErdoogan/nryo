import { defineMeta, skin, upgrade } from '../define';

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
  shop: {
    title: 'Theme Shop',
    icon: '🎨',
    skinLabel: 'Board themes',
    upgrades: [upgrade('undo', 'Extra undos', '↩️', 'One more free undo per level each game', 4, 90)],
    skins: [
      skin('classic', 'Classic', 0, ['#fb923c', '#fef3c7', '#a78bfa']),
      skin('ocean', 'Ocean', 150, ['#22d3ee', '#cffafe', '#6366f1'], { icon: '🌊' }),
      skin('berry', 'Berry', 150, ['#c084fc', '#fae8ff', '#f472b6'], { icon: '🫐' }),
      skin('lime', 'Lime', 200, ['#a3e635', '#f7fee7', '#22c55e'], { icon: '🍋' }),
      skin('mono', 'Mono', 0, ['#94a3b8', '#f1f5f9', '#0f172a'], { icon: '⚫', adUnlock: 2 }),
    ],
  },
});
