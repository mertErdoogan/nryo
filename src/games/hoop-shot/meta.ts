import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'hoop-shot',
  title: 'Hoop Shot',
  tagline: 'Pull back, aim the arc, drain the shot. Swish!',
  description:
    'A flick-to-shoot basketball challenge. Drag back to aim and release to shoot. Swishes earn a bonus, streaks multiply your points — and the hoop starts moving the better you get.',
  howToPlay: [
    'Drag back from the ball, then release to shoot.',
    'The dotted arc previews your shot. Swishes score a bonus.',
    'Three misses and it’s game over. Streaks multiply points.',
  ],
  categories: ['physics', 'hyper-casual', 'arcade'],
  tags: ['basketball', 'sports', 'aim', 'flick', 'trajectory'],
  difficulty: 'easy',
  controls: { desktop: 'Click, drag back and release', touch: 'Drag back and release' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 20, silver: 50, gold: 100 },
  theme: { from: '#ea580c', to: '#1e1b4b', accent: '#fb923c' },
  sessionLength: '30s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 85,
  addedAt: '2026-06-19',
  shop: {
    title: 'Pro Shop',
    icon: '🏀',
    skinLabel: 'Balls',
    upgrades: [
      upgrade('lives', 'Spare balls', '🏀', 'One more miss allowed per level', 2, 150),
      upgrade('sight', 'Eagle eye', '👁️', 'Longer trajectory preview', 3, 80),
    ],
    skins: [
      skin('classic', 'Classic', 0, ['#f97316', '#7c2d12', '#fdba74']),
      skin('street', 'Street', 120, ['#b45309', '#1c1917', '#fbbf24'], { icon: '🟤' }),
      skin('usa', 'All-Star', 250, ['#1d4ed8', '#f8fafc', '#ef4444'], { icon: '⭐' }),
      skin('neon', 'Neon', 350, ['#a3e635', '#14532d', '#ecfccb'], { icon: '💚' }),
      skin('gold', 'Gold Ball', 0, ['#facc15', '#78350f', '#fef08a'], { icon: '🏆', adUnlock: 3 }),
    ],
  },
});
