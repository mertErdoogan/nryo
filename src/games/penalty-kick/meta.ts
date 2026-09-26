import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'penalty-kick',
  title: 'Penalty Kick',
  tagline: 'Swipe to curl it past the keeper. Top corner!',
  description:
    'Step up to the spot against an ever-sharper bot goalkeeper. Swipe to shoot — the direction aims, the length sets the height and a curved swipe bends the ball. Hit the corner targets for bonuses; every save or miss costs a life.',
  howToPlay: [
    'Swipe from the ball toward the goal. Longer swipes go higher.',
    'Curve your swipe to bend the shot around the keeper.',
    'Saves and misses cost a life. Corner targets pay extra.',
  ],
  categories: ['physics', 'versus', 'reflex'],
  tags: ['football', 'soccer', 'penalty', 'swipe', 'goalkeeper', 'sports'],
  difficulty: 'easy',
  controls: { desktop: 'Drag with the mouse and release to shoot', touch: 'Swipe to shoot' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1500, silver: 4000, gold: 8000 },
  theme: { from: '#16a34a', to: '#0f172a', accent: '#86efac' },
  sessionLength: '1–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 88,
  addedAt: '2026-09-26',
  shop: {
    title: 'Kit Room',
    icon: '⚽',
    skinLabel: 'Balls',
    upgrades: [
      upgrade('power', 'Power shot', '💪', 'Faster shots — less time for the keeper', 4, 90),
      upgrade('accuracy', 'Accuracy', '🎯', 'Less random spread per level', 4, 80),
      upgrade('curve', 'Curl', '🌀', '+20% curve per level', 3, 100),
      upgrade('life', 'Extra life', '❤️', '+1 life per level', 2, 250, 2.2),
    ],
    skins: [
      skin('classic', 'Classic', 0, ['#f8fafc', '#111827', '#e5e7eb'], { icon: '⚽' }),
      skin('fire', 'Fireball', 300, ['#f97316', '#7c2d12', '#fde047'], { icon: '🔥' }),
      skin('ice', 'Ice', 500, ['#bae6fd', '#0369a1', '#f0f9ff'], { icon: '🧊' }),
      skin('night', 'Night', 800, ['#6366f1', '#111827', '#e0e7ff'], { icon: '🌙' }),
      skin('gold', 'Golden Boot', 0, ['#fbbf24', '#78350f', '#fef3c7'], { icon: '🏆', adUnlock: 3 }),
    ],
  },
});
