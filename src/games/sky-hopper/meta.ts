import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'sky-hopper',
  title: 'Sky Hopper',
  tagline: 'Tap to flap through the neon pillars.',
  description:
    'Keep your little bird airborne and thread it through gaps between pillars. The gaps tighten and the pace quickens the further you fly.',
  howToPlay: [
    'Tap to flap upward — gravity does the rest.',
    'Fly through the gaps between pillars.',
    'Touching a pillar or the ground ends the run — unless you continue.',
    'Grab coins in the gaps to buy shields and new birds.',
  ],
  categories: ['hyper-casual', 'endless', 'arcade'],
  tags: ['flappy', 'one-tap', 'bird', 'flying', 'timing'],
  difficulty: 'medium',
  controls: { desktop: 'Click, Space or ↑ to flap', touch: 'Tap to flap' },
  score: { label: 'Pillars', format: 'points' },
  medals: { bronze: 8, silver: 20, gold: 40 },
  theme: { from: '#38bdf8', to: '#6366f1', accent: '#fde047' },
  sessionLength: '10s–2 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 93,
  addedAt: '2026-06-01',
  shop: {
    title: 'Nest',
    icon: '🐤',
    skinLabel: 'Birds',
    upgrades: [
      upgrade('shield', 'Bubble shield', '🫧', 'One free pillar bump per level', 3, 120),
      upgrade('glide', 'Light feathers', '🪶', '4% softer gravity per level', 3, 90),
      upgrade('magnet', 'Coin magnet', '🧲', 'Grab coins from further away', 3, 70),
      upgrade('luck', 'Lucky skies', '🍀', 'More coins in the gaps', 3, 80),
    ],
    skins: [
      skin('sunny', 'Sunny', 0, ['#f59e0b', '#fde047', '#fbbf24'], { icon: '🐤' }),
      skin('blue', 'Bluebird', 150, ['#2563eb', '#93c5fd', '#60a5fa'], { icon: '🐦' }),
      skin('parrot', 'Parrot', 300, ['#16a34a', '#ef4444', '#facc15'], { icon: '🦜' }),
      skin('flamingo', 'Flamingo', 450, ['#db2777', '#fbcfe8', '#f472b6'], { icon: '🦩' }),
      skin('royal', 'Royal Hopper', 900, ['#7c3aed', '#ddd6fe', '#a78bfa'], { icon: '👑' }),
      skin('phoenix', 'Phoenix', 0, ['#dc2626', '#fb923c', '#fde047'], { icon: '🔥', adUnlock: 3 }),
    ],
  },
});
