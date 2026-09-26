import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'checkers',
  title: 'Checkers',
  tagline: 'Jump, capture, crown kings. Outplay the bot.',
  description:
    'Classic American checkers against a bot with three difficulty levels. Captures are forced, multi-jumps chain, and reaching the far row crowns a king. Clear the board or leave the bot without a move to win.',
  howToPlay: [
    'Tap one of your pieces, then a highlighted square to move.',
    'Captures are mandatory — jump over the bot’s pieces, chaining jumps.',
    'Reach the far row to crown a king that moves both ways.',
  ],
  categories: ['strategy', 'versus', 'brain'],
  tags: ['checkers', 'draughts', 'board game', 'ai', 'classic'],
  difficulty: 'medium',
  controls: { desktop: 'Click a piece, then a square', touch: 'Tap a piece, then a square' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 500, silver: 1200, gold: 1800 },
  theme: { from: '#b91c1c', to: '#1c1917', accent: '#fca5a5' },
  sessionLength: '4–10 min',
  orientation: 'portrait',
  realtime: false,
  dailyEligible: false,
  popularity: 80,
  addedAt: '2026-09-26',
  maxRevives: 1,
  shop: {
    title: 'Game Room',
    icon: '♟️',
    skinLabel: 'Boards',
    upgrades: [upgrade('hint', 'Coach', '💡', '+1 free hint per game per level', 3, 100)],
    skins: [
      skin('classic', 'Classic', 0, ['#f5deb3', '#8b5a2b', '#dc2626'], { icon: '🟫' }),
      skin('marble', 'Marble', 350, ['#f1f5f9', '#64748b', '#0f172a'], { icon: '⬜' }),
      skin('garden', 'Garden', 500, ['#d9f99d', '#3f6212', '#f97316'], { icon: '🌿' }),
      skin('neon', 'Neon', 800, ['#312e81', '#0f0a1f', '#22d3ee'], { icon: '💠' }),
      skin('royal', 'Royal', 0, ['#fef3c7', '#7c2d12', '#fbbf24'], { icon: '👑', adUnlock: 3 }),
    ],
  },
});
