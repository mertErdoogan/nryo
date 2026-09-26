import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'stack-tower',
  title: 'Stack Tower',
  tagline: 'Drop the block. Nail the timing. Build to the sky.',
  description:
    'A one-tap timing game: drop each sliding block onto the tower. Overhangs get sliced off, perfect drops keep your tower wide and build combos.',
  howToPlay: [
    'Tap to drop the sliding block onto the tower.',
    'Anything hanging over the edge is sliced off.',
    'Perfect drops score double — three in a row widen the block.',
  ],
  categories: ['hyper-casual', 'reflex', 'endless'],
  tags: ['timing', 'one-tap', 'tower', 'blocks', 'stack'],
  difficulty: 'easy',
  controls: { desktop: 'Click, Space or ↓ to drop', touch: 'Tap anywhere to drop' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 15, silver: 35, gold: 60 },
  theme: { from: '#f97316', to: '#db2777', accent: '#fb923c' },
  sessionLength: '30s–2 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 96,
  addedAt: '2026-06-01',
  shop: {
    title: 'Workshop',
    icon: '🧱',
    skinLabel: 'Palettes',
    upgrades: [
      upgrade('perfect', 'Steady hands', '🎯', 'Wider “perfect” window per level', 4, 90),
      upgrade('slowmo', 'Slow motion', '🐢', 'Blocks slide 5% slower per level', 3, 110),
      upgrade('regrow', 'Regrowth', '🌱', 'Perfect combos regrow the tower more', 3, 100),
    ],
    skins: [
      skin('prism', 'Prism', 0, ['#a855f7', '#22d3ee', '#f472b6'], { icon: '🌈' }),
      skin('ocean', 'Ocean', 150, ['#0891b2', '#0e7490', '#67e8f9'], { icon: '🌊' }),
      skin('sunset', 'Sunset', 150, ['#f43f5e', '#f97316', '#fde68a'], { icon: '🌇' }),
      skin('forest', 'Forest', 250, ['#65a30d', '#15803d', '#bef264'], { icon: '🌲' }),
      skin('candy', 'Candy', 350, ['#d946ef', '#f472b6', '#fbcfe8'], { icon: '🍭' }),
      skin('gold', 'Gold Bars', 0, ['#f59e0b', '#b45309', '#fde68a'], { icon: '🪙', adUnlock: 3 }),
    ],
  },
});
