import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'word-rescue',
  title: 'Word Rescue',
  tagline: 'Guess the word before the last balloon pops.',
  description:
    'A friendly twist on hangman. A little explorer floats on a bunch of balloons — every wrong letter pops one. Guess each hidden word to keep them aloft, and chain words together for a streak bonus. Hints reveal a letter when you’re stuck.',
  howToPlay: [
    'Tap letters (or type) to guess the hidden word.',
    'Each wrong guess pops a balloon. Lose them all and the explorer splashes down.',
    'Solve words in a row for streak bonuses. Hints reveal a letter.',
  ],
  categories: ['word', 'brain', 'puzzle'],
  tags: ['hangman', 'words', 'letters', 'guess', 'vocabulary', 'balloons'],
  difficulty: 'easy',
  controls: { desktop: 'Type letters or click the keyboard', touch: 'Tap letters' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 800, silver: 2000, gold: 4000 },
  theme: { from: '#0ea5e9', to: '#f472b6', accent: '#fde68a' },
  sessionLength: '2–6 min',
  orientation: 'portrait',
  realtime: false,
  popularity: 83,
  addedAt: '2026-09-26',
  shop: {
    title: 'Balloon Stall',
    icon: '🎈',
    skinLabel: 'Balloons',
    upgrades: [
      upgrade('balloon', 'Extra balloon', '🎈', '+1 balloon per word per level', 2, 200, 2),
      upgrade('hint', 'Free hints', '💡', '+1 free hint per run per level', 3, 100),
      upgrade('vowel', 'Vowel sense', '🔤', 'Words start with one vowel revealed', 1, 300),
    ],
    skins: [
      skin('party', 'Party', 0, ['#ef4444', '#3b82f6', '#facc15'], { icon: '🎈' }),
      skin('pastel', 'Pastel', 250, ['#fda4af', '#a5b4fc', '#fde68a'], { icon: '🍭' }),
      skin('ocean', 'Ocean', 400, ['#06b6d4', '#0ea5e9', '#14b8a6'], { icon: '🐬' }),
      skin('sunset', 'Sunset', 600, ['#f97316', '#e11d48', '#f59e0b'], { icon: '🌅' }),
      skin('rainbow', 'Rainbow', 0, ['#f472b6', '#8b5cf6', '#22c55e'], { icon: '🌈', adUnlock: 3 }),
    ],
  },
});
