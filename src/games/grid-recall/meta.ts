import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'grid-recall',
  title: 'Grid Recall',
  tagline: 'Tiles flash for a moment. Find them all again.',
  description:
    'A visual memory workout. A few tiles light up, then vanish — tap every one you remember. Each level adds more tiles and the grid keeps growing.',
  howToPlay: [
    'Memorise the highlighted tiles.',
    'When they hide, tap all of them.',
    'Three wrong taps in a level costs a life. You have three lives.',
  ],
  categories: ['memory', 'brain', 'puzzle'],
  tags: ['visual memory', 'pattern', 'grid', 'recall', 'focus'],
  difficulty: 'easy',
  controls: { desktop: 'Click tiles', touch: 'Tap tiles' },
  score: { label: 'Level', format: 'points' },
  medals: { bronze: 7, silver: 11, gold: 15 },
  theme: { from: '#6366f1', to: '#0f766e', accent: '#5eead4' },
  sessionLength: '1–4 min',
  orientation: 'any',
  realtime: false,
  popularity: 72,
  addedAt: '2026-06-08',
  shop: {
    title: 'Mind Gym',
    icon: '🧠',
    upgrades: [
      upgrade('lives', 'Extra life', '❤️', 'One more life per level', 2, 120),
      upgrade('focus', 'Focus', '🔍', 'Patterns stay up 15% longer per level', 3, 90),
      upgrade('peek', 'Free peeks', '👀', 'One free peek per level each game', 3, 80),
    ],
    skins: [skin('classic', 'Classic', 0, ['#6366f1', '#22c55e', '#ef4444'])],
  },
});
