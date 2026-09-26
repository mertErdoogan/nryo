import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'helix-fall',
  title: 'Helix Fall',
  tagline: 'Spin the tower, drop the ball, avoid the red.',
  description:
    'Twist a spiral tower so your bouncing ball drops through the gaps. Fall through three platforms in a row to become a fireball that smashes anything. Touch a red zone and it’s over.',
  howToPlay: [
    'Drag left/right (or ←/→) to rotate the tower.',
    'Line up gaps so the ball falls through. Red platforms are deadly.',
    'Fall through 3 rings without bouncing to become a fireball.',
  ],
  categories: ['hyper-casual', 'arcade', 'reflex'],
  tags: ['helix', 'tower', 'ball', 'bounce', 'spiral'],
  difficulty: 'easy',
  controls: { desktop: 'Drag or ←/→ to spin', touch: 'Drag left/right to spin the tower' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 400, silver: 1000, gold: 2200 },
  theme: { from: '#f43f5e', to: '#6d28d9', accent: '#fb7185' },
  sessionLength: '30s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 90,
  addedAt: '2026-09-26',
  shop: {
    title: 'Ball Shop',
    icon: '🔴',
    skinLabel: 'Balls',
    upgrades: [
      upgrade('fire', 'Hot streak', '🔥', 'Fireball after fewer rings (3 → 2)', 1, 400),
      upgrade('shield', 'Bubble', '🫧', 'Survive one red hit per level', 2, 200, 2.2),
      upgrade('lucky', 'Coin gaps', '🍀', 'More coins in the gaps', 4, 70),
    ],
    skins: [
      skin('ruby', 'Ruby', 0, ['#f43f5e', '#881337', '#fecdd3'], { icon: '🔴' }),
      skin('lime', 'Lime', 200, ['#84cc16', '#365314', '#ecfccb'], { icon: '🟢' }),
      skin('ocean', 'Ocean', 350, ['#0ea5e9', '#0c4a6e', '#e0f2fe'], { icon: '🔵' }),
      skin('sun', 'Sunburst', 600, ['#f59e0b', '#7c2d12', '#fef3c7'], { icon: '🟠' }),
      skin('galaxy', 'Galaxy', 1000, ['#7c3aed', '#1e1b4b', '#f0abfc'], { icon: '🌌' }),
      skin('disco', 'Disco', 0, ['#e5e7eb', '#6b7280', '#ffffff'], { icon: '🪩', adUnlock: 3 }),
    ],
  },
});
