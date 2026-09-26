import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'memory-match',
  title: 'Memory Match',
  tagline: 'Flip, remember, match — before the clock runs out.',
  description:
    'Classic pair matching against the clock. Memorise the preview, then find every pair. Each cleared board adds time and deals a bigger one.',
  howToPlay: [
    'Memorise the cards during the quick preview.',
    'Flip two cards at a time to find matching pairs.',
    'Clear boards to earn bonus time. Streaks multiply points.',
  ],
  categories: ['memory', 'brain', 'puzzle'],
  tags: ['cards', 'pairs', 'concentration', 'matching', 'timed'],
  difficulty: 'easy',
  controls: { desktop: 'Click cards (or Tab + Enter)', touch: 'Tap cards to flip' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1500, silver: 3500, gold: 6000 },
  theme: { from: '#8b5cf6', to: '#0ea5e9', accent: '#c4b5fd' },
  sessionLength: '1–3 min',
  orientation: 'any',
  realtime: true,
  popularity: 83,
  addedAt: '2026-06-02',
  shop: {
    title: 'Mind Gym',
    icon: '🃏',
    upgrades: [
      upgrade('time', 'Extra time', '⏱️', '+5 starting seconds per level', 4, 80),
      upgrade('peek', 'Free peeks', '👀', 'One free peek per level each game', 3, 90),
    ],
    skins: [skin('classic', 'Classic', 0, ['#8b5cf6', '#f472b6', '#22d3ee'])],
  },
});
