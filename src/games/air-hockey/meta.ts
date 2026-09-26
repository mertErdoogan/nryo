import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'air-hockey',
  title: 'Air Hockey',
  tagline: 'Smash the puck past an AI that keeps getting sharper.',
  description:
    'Fast, physical air hockey against an AI opponent. First to five wins the match — then the next rival is quicker and smarter. How far up the ladder can you climb?',
  howToPlay: [
    'Drag your mallet (bottom half) to hit the puck.',
    'Score in the top goal. First to 5 wins the match.',
    'Each match you win brings a tougher AI. One loss ends the run.',
  ],
  categories: ['versus', 'physics', 'arcade'],
  tags: ['hockey', 'sports', 'ai', 'puck', 'versus'],
  difficulty: 'medium',
  controls: { desktop: 'Mouse or arrow keys', touch: 'Drag your mallet' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 700, silver: 1800, gold: 3200 },
  theme: { from: '#0891b2', to: '#be123c', accent: '#22d3ee' },
  sessionLength: '1–5 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 80,
  addedAt: '2026-06-21',
  shop: {
    title: 'Pro Shop',
    icon: '🏒',
    skinLabel: 'Mallets',
    upgrades: [
      upgrade('mallet', 'Big mallet', '⭕', 'Larger mallet each level', 3, 120),
      upgrade('speed', 'Quick hands', '⚡', 'Mallet follows 10% faster per level', 3, 90),
    ],
    skins: [
      skin('ice', 'Ice Blue', 0, ['#0891b2', '#a5f3fc', '#67e8f9']),
      skin('lime', 'Lime', 120, ['#65a30d', '#d9f99d', '#a3e635'], { icon: '🟢' }),
      skin('violet', 'Violet', 200, ['#7c3aed', '#ddd6fe', '#a78bfa'], { icon: '🟣' }),
      skin('carbon', 'Carbon', 350, ['#111827', '#9ca3af', '#f59e0b'], { icon: '⚫' }),
      skin('gold', 'Champion', 0, ['#d97706', '#fde68a', '#fbbf24'], { icon: '🏆', adUnlock: 3 }),
    ],
  },
});
