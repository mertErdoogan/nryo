import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'sky-climber',
  title: 'Sky Climber',
  tagline: 'Bounce from cloud to cloud and climb forever.',
  description:
    'Your jelly hero bounces automatically — just steer left and right to land on the next platform. Springs launch you high, cracked platforms crumble and spiky drones patrol the upper sky.',
  howToPlay: [
    'Hold the left or right side (or ←/→) to steer.',
    'You bounce automatically. Springs send you flying.',
    'Brown platforms crumble. Falling off the screen ends the climb.',
  ],
  categories: ['endless', 'hyper-casual', 'physics'],
  tags: ['jump', 'platformer', 'climb', 'doodle', 'bounce'],
  difficulty: 'easy',
  controls: { desktop: '←/→ or A/D to steer', touch: 'Hold left or right side to steer' },
  score: { label: 'Height', format: 'points' },
  medals: { bronze: 1000, silver: 2500, gold: 5000 },
  theme: { from: '#38bdf8', to: '#a78bfa', accent: '#bae6fd' },
  sessionLength: '30s–4 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 84,
  addedAt: '2026-06-23',
  shop: {
    title: 'Base Camp',
    icon: '⛰️',
    skinLabel: 'Climbers',
    upgrades: [
      upgrade('jump', 'Power legs', '🦵', '+4% jump height per level', 4, 80),
      upgrade('springs', 'Spring fever', '🌀', 'More spring platforms', 3, 100),
      upgrade('magnet', 'Coin magnet', '🧲', 'Grab coins from further away', 3, 70),
    ],
    skins: [
      skin('blob', 'Purple Blob', 0, ['#a855f7', '#c084fc', '#7e22ce'], { icon: '🟣' }),
      skin('cap', 'Capped Climber', 150, ['#f97316', '#fdba74', '#1d4ed8'], { icon: '🧢' }),
      skin('astro', 'Astronaut', 400, ['#e2e8f0', '#f8fafc', '#64748b'], { icon: '👩‍🚀' }),
      skin('slime', 'Slime', 250, ['#22c55e', '#86efac', '#15803d'], { icon: '🟢' }),
      skin('king', 'Sky King', 0, ['#facc15', '#fef08a', '#dc2626'], { icon: '👑', adUnlock: 3 }),
    ],
  },
});
