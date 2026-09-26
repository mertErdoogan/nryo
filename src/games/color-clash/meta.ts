import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'color-clash',
  title: 'Color Clash',
  tagline: 'Does the word match its color? Your brain says no.',
  description:
    'A fast Stroop-effect challenge: decide whether a color word’s meaning matches the ink it’s printed in. Streaks multiply your score — but mistakes cost precious seconds.',
  howToPlay: [
    'Look at the INK color of the word, and read what it SAYS.',
    'Tap ✓ if they match, ✗ if they don’t.',
    'Streaks multiply points. Mistakes cost 2 seconds.',
  ],
  categories: ['brain', 'reflex'],
  tags: ['stroop', 'colors', 'focus', 'speed', 'trick'],
  difficulty: 'medium',
  controls: { desktop: '← = No, → = Yes (or click)', touch: 'Tap ✗ or ✓' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 300, silver: 700, gold: 1200 },
  theme: { from: '#ef4444', to: '#2563eb', accent: '#facc15' },
  sessionLength: '45s',
  orientation: 'any',
  realtime: true,
  popularity: 78,
  addedAt: '2026-06-07',
  shop: {
    title: 'Brain Gym',
    icon: '🧠',
    upgrades: [
      upgrade('time', 'Extra time', '⏱️', '+3 seconds per round per level', 5, 70),
      upgrade('shield', 'Mistake shield', '🛡️', 'First mistakes cost no time (one per level)', 3, 100),
    ],
    skins: [skin('classic', 'Classic', 0, ['#f8fafc', '#0f172a', '#22c55e'])],
  },
});
