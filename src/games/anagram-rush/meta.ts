import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'anagram-rush',
  title: 'Anagram Rush',
  tagline: 'Unscramble the word before the clock runs out.',
  description:
    'A jumbled word appears — tap the letters in the right order to unscramble it. Every solve adds time to the clock, words get longer as you go, and fast solves pay a speed bonus. Skipping costs seconds, hints reveal the next letter.',
  howToPlay: [
    'Tap letters (or type) to spell the hidden word. Tap a placed letter to take it back.',
    'Each solved word adds time. Longer words are worth more.',
    'Skip costs 5 seconds. Hints place the next correct letter.',
  ],
  categories: ['word', 'brain', 'reflex'],
  tags: ['anagram', 'unscramble', 'letters', 'vocabulary', 'timer'],
  difficulty: 'medium',
  controls: { desktop: 'Type letters · Backspace to undo · Enter to skip', touch: 'Tap letters' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 800, silver: 2000, gold: 4000 },
  theme: { from: '#16a34a', to: '#0f766e', accent: '#bbf7d0' },
  sessionLength: '1–4 min',
  orientation: 'portrait',
  realtime: false,
  popularity: 80,
  addedAt: '2026-09-26',
  shop: {
    title: 'Word Shop',
    icon: '🔤',
    skinLabel: 'Tile styles',
    upgrades: [
      upgrade('time', 'Extra time', '⏱️', '+10 s on the starting clock per level', 4, 70),
      upgrade('hint', 'Free hints', '💡', '+2 free hints per run per level', 3, 90),
      upgrade('skip', 'Cheap skips', '⏭️', 'Skipping costs 1 s less per level', 3, 80),
    ],
    skins: [
      skin('wood', 'Wooden', 0, ['#fef3c7', '#b45309', '#422006'], { icon: '🪵' }),
      skin('mint', 'Mint', 250, ['#dcfce7', '#16a34a', '#052e16'], { icon: '🌿' }),
      skin('ink', 'Ink', 450, ['#1e293b', '#94a3b8', '#f8fafc'], { icon: '🖋️' }),
      skin('candy', 'Candy', 650, ['#fce7f3', '#ec4899', '#831843'], { icon: '🍬' }),
      skin('gold', 'Gilded', 0, ['#fef3c7', '#d97706', '#78350f'], { icon: '👑', adUnlock: 3 }),
    ],
  },
});
