import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'tower-crane',
  title: 'Tower Crane',
  tagline: 'Drop floors from a swinging crane. Build to the clouds.',
  description:
    'Time your drop as the crane swings to stack floor after floor into a skyscraper. Land a floor dead-centre for a perfect combo; land it too far off and it tumbles away. The taller the tower, the more it sways.',
  howToPlay: [
    'Tap (or Space) to release the swinging floor.',
    'Land it on the tower — perfectly centred drops build a combo.',
    'Floors that miss cost a life. Three misses and the build is over.',
  ],
  categories: ['physics', 'hyper-casual', 'arcade'],
  tags: ['tower', 'crane', 'stack', 'building', 'timing', 'city'],
  difficulty: 'easy',
  controls: { desktop: 'Space / click to drop', touch: 'Tap to drop' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 400, silver: 1000, gold: 2200 },
  theme: { from: '#0ea5e9', to: '#1e3a8a', accent: '#fde047' },
  sessionLength: '1–4 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 85,
  addedAt: '2026-09-26',
  shop: {
    title: 'Builder’s Yard',
    icon: '🏗️',
    skinLabel: 'Building styles',
    upgrades: [
      upgrade('steady', 'Steady crane', '🪝', '−10% swing speed per level', 4, 80),
      upgrade('wide', 'Wide floors', '↔️', '+8% floor width per level', 3, 110),
      upgrade('life', 'Safety net', '🛟', '+1 life per level', 2, 220, 2.2),
      upgrade('perfect', 'Laser level', '📏', 'Bigger perfect-drop window', 3, 90),
    ],
    skins: [
      skin('brick', 'Brick', 0, ['#b45309', '#fde68a', '#78350f'], { icon: '🧱' }),
      skin('glass', 'Glass Tower', 350, ['#0ea5e9', '#e0f2fe', '#075985'], { icon: '🏙️' }),
      skin('pastel', 'Pastel', 500, ['#f9a8d4', '#fdf2f8', '#9d174d'], { icon: '🌸' }),
      skin('neon', 'Neon City', 800, ['#312e81', '#f0abfc', '#a855f7'], { icon: '🌃' }),
      skin('gold', 'Golden Palace', 0, ['#fbbf24', '#fff7ed', '#92400e'], { icon: '🏰', adUnlock: 3 }),
    ],
  },
});
