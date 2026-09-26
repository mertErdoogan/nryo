import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'word-blitz',
  title: 'Word Blitz',
  tagline: 'Seven letters, ninety seconds. How many words can you find?',
  description:
    'A fast anagram hunt. Build as many words as you can from seven letters before the clock runs out. Longer words score more — use all seven for a huge bonus.',
  howToPlay: [
    'Tap letters (or type) to build a word, then press Enter.',
    'Words need 3+ letters. Longer words score much more.',
    'Use all seven letters for a +200 bonus.',
  ],
  categories: ['word', 'brain', 'puzzle'],
  tags: ['anagram', 'letters', 'vocabulary', 'spelling', 'timed'],
  difficulty: 'medium',
  controls: { desktop: 'Type letters, Enter to submit, Backspace to delete', touch: 'Tap letters, then ✓' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 500, silver: 1100, gold: 2000 },
  theme: { from: '#2563eb', to: '#7c3aed', accent: '#93c5fd' },
  sessionLength: '90s',
  orientation: 'any',
  realtime: true,
  popularity: 85,
  addedAt: '2026-06-10',
  shop: {
    title: 'Word Shop',
    icon: '🔤',
    upgrades: [upgrade('time', 'Extra time', '⏱️', '+10 seconds per level', 4, 80)],
    skins: [skin('classic', 'Classic', 0, ['#f59e0b', '#1e293b', '#22c55e'])],
  },
});
