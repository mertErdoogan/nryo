import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'rise-up',
  title: 'Rise Up',
  tagline: 'Guard your balloon. Push everything out of the way.',
  description:
    'Your balloon floats up on its own — you control the shield. Drag it to shove falling blocks, balls and bars aside before they pop the balloon. Bigger shields, tougher balloons and new colors await in the shop.',
  howToPlay: [
    'Drag anywhere (or use arrow keys) to move the shield.',
    'Push obstacles away from the balloon — one touch pops it.',
    'Coins drift by — clear a path so the balloon catches them.',
  ],
  categories: ['hyper-casual', 'physics', 'endless'],
  tags: ['balloon', 'shield', 'protect', 'push', 'drag'],
  difficulty: 'medium',
  controls: {
    desktop: 'Mouse drag or arrow keys move the shield',
    touch: 'Drag anywhere to move the shield',
  },
  score: { label: 'Meters', format: 'points' },
  medals: { bronze: 300, silver: 800, gold: 1600 },
  theme: { from: '#38bdf8', to: '#7c3aed', accent: '#f472b6' },
  sessionLength: '30s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 85,
  addedAt: '2026-09-26',
  shop: {
    title: 'Balloon Shop',
    icon: '🎈',
    skinLabel: 'Balloons',
    upgrades: [
      upgrade('shield', 'Bigger shield', '🛡️', '+12% shield size per level', 4, 90),
      upgrade('armor', 'Tough balloon', '🎈', 'Survive one pop per level each run', 2, 220, 2.2),
      upgrade('magnet', 'Coin magnet', '🧲', 'Coins drift towards the balloon', 3, 70),
    ],
    skins: [
      skin('red', 'Classic Red', 0, ['#ef4444', '#991b1b', '#f8fafc'], { icon: '🎈' }),
      skin('mint', 'Mint', 250, ['#34d399', '#065f46', '#ecfdf5'], { icon: '🟢' }),
      skin('sky', 'Sky', 400, ['#38bdf8', '#075985', '#f0f9ff'], { icon: '🔵' }),
      skin('heart', 'Heart', 700, ['#f472b6', '#9d174d', '#fdf2f8'], { icon: '💗' }),
      skin('gold', 'Golden', 0, ['#fbbf24', '#92400e', '#fffbeb'], { icon: '👑', adUnlock: 3 }),
    ],
  },
});
