import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'merge-drop',
  title: 'Merge Drop',
  tagline: 'Drop numbers, merge twins, chase 2048 and beyond.',
  description:
    'Drop numbered blocks into five columns. Equal blocks that touch merge into their double — and merges chain into more merges. Keep the columns from filling up and build the biggest number you can.',
  howToPlay: [
    'Tap a column (or press 1–5) to drop the next block.',
    'Touching equal blocks merge and double; chains score big.',
    'If every column fills up, the game ends. Hammers smash one block.',
  ],
  categories: ['puzzle', 'brain', 'hyper-casual'],
  tags: ['2048', 'merge', 'numbers', 'drop', 'blocks'],
  difficulty: 'easy',
  controls: { desktop: 'Click a column or press 1–5', touch: 'Tap a column' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 5000, silver: 20000, gold: 60000 },
  theme: { from: '#0ea5e9', to: '#7c3aed', accent: '#fde047' },
  sessionLength: '3–8 min',
  orientation: 'portrait',
  realtime: false,
  popularity: 88,
  addedAt: '2026-09-26',
  shop: {
    title: 'Block Shop',
    icon: '🔢',
    skinLabel: 'Themes',
    upgrades: [
      upgrade('hammer', 'Hammers', '🔨', '+1 hammer per game per level', 3, 90),
      upgrade('preview', 'Look ahead', '👀', 'See two blocks ahead', 1, 250),
      upgrade('lucky', 'Lucky drops', '🍀', 'Fewer tiny blocks, more mid-size ones', 3, 110),
    ],
    skins: [
      skin('candy', 'Candy', 0, ['#f472b6', '#38bdf8', '#fde047'], { icon: '🍬' }),
      skin('ocean', 'Ocean', 300, ['#0ea5e9', '#14b8a6', '#6366f1'], { icon: '🌊' }),
      skin('sunset', 'Sunset', 500, ['#f97316', '#e11d48', '#facc15'], { icon: '🌅' }),
      skin('forest', 'Forest', 700, ['#16a34a', '#65a30d', '#ca8a04'], { icon: '🌲' }),
      skin('mono', 'Midnight', 0, ['#6366f1', '#1e1b4b', '#e0e7ff'], { icon: '🌙', adUnlock: 3 }),
    ],
  },
});
