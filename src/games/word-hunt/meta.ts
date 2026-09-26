import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'word-hunt',
  title: 'Word Hunt',
  tagline: 'Find the hidden themed words — in every direction.',
  description:
    'A themed word search against the clock. Drag across letters to circle hidden words — horizontal, vertical, diagonal and even backwards. Find them all fast for a time bonus.',
  howToPlay: [
    'Drag across letters in a straight line to select a word.',
    'Words can run in any of 8 directions, even backwards.',
    'Find all words before time runs out for a bonus.',
  ],
  categories: ['word', 'puzzle'],
  tags: ['word search', 'letters', 'themes', 'find', 'vocabulary'],
  difficulty: 'easy',
  controls: { desktop: 'Click and drag across letters', touch: 'Drag across letters' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 500, silver: 900, gold: 1250 },
  theme: { from: '#0d9488', to: '#1e40af', accent: '#5eead4' },
  sessionLength: '1–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 73,
  addedAt: '2026-06-11',
  shop: {
    title: 'Word Shop',
    icon: '🔎',
    upgrades: [
      upgrade('time', 'Extra time', '⏱️', '+15 seconds per level', 4, 80),
      upgrade('hint', 'Free hints', '💡', 'One free hint per level each puzzle', 3, 90),
    ],
    skins: [skin('classic', 'Classic', 0, ['#0ea5e9', '#f472b6', '#fde047'])],
  },
});
