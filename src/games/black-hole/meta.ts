import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'black-hole',
  title: 'Black Hole',
  tagline: 'Swallow the city. Grow bigger than the bots.',
  description:
    'You are a hole in the ground. Glide around a busy city swallowing anything smaller than you — cones, cars, trees, whole buildings — and grow bigger with every bite. Bot holes are hungry too: eat the small ones, avoid the big ones.',
  howToPlay: [
    'Drag anywhere (or WASD/arrows) to move your hole.',
    'Anything smaller than your hole falls in. Bigger things need a bigger hole.',
    'Out-grow the bot holes before the timer runs out.',
  ],
  categories: ['action', 'versus', 'hyper-casual'],
  tags: ['hole', 'io', 'city', 'grow', 'swallow', 'bots'],
  difficulty: 'easy',
  controls: { desktop: 'WASD / arrows or mouse drag', touch: 'Drag anywhere to move' },
  score: { label: 'Mass', format: 'points' },
  medals: { bronze: 1500, silver: 4000, gold: 9000 },
  theme: { from: '#0f172a', to: '#6366f1', accent: '#a5b4fc' },
  sessionLength: '2 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 89,
  addedAt: '2026-09-26',
  shop: {
    title: 'Hole Shop',
    icon: '🕳️',
    skinLabel: 'Holes',
    upgrades: [
      upgrade('size', 'Head start', '⭕', '+12% starting size per level', 5, 90),
      upgrade('speed', 'Speed', '💨', '+8% move speed per level', 5, 70),
      upgrade('time', 'More time', '⏱️', '+10 seconds per round per level', 4, 90),
      upgrade('magnet', 'Gravity pull', '🧲', 'Pulls nearby objects in', 3, 120),
    ],
    skins: [
      skin('void', 'Void', 0, ['#0f172a', '#6366f1', '#c7d2fe'], { icon: '⚫' }),
      skin('lava', 'Lava', 300, ['#1c0a00', '#f97316', '#fde68a'], { icon: '🌋' }),
      skin('toxic', 'Toxic', 500, ['#052e16', '#22c55e', '#bbf7d0'], { icon: '☢️' }),
      skin('candy', 'Candy', 800, ['#500724', '#ec4899', '#fbcfe8'], { icon: '🍭' }),
      skin('galaxy', 'Galaxy', 0, ['#1e1b4b', '#a855f7', '#f0abfc'], { icon: '🌌', adUnlock: 3 }),
    ],
  },
});
