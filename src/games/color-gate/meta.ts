import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'color-gate',
  title: 'Color Gate',
  tagline: 'Tap to hop. Only pass through your own color.',
  description:
    'Tap to bounce your ball upward through spinning rings, sliding bars and rotating crosses — but you may only pass through the part that matches your color. Switch colors at the rainbow orbs and grab the stars.',
  howToPlay: [
    'Tap (or Space) to hop up. Gravity pulls you down between taps.',
    'Pass only through segments of your own color.',
    'Rainbow orbs change your color. Stars are points.',
  ],
  categories: ['hyper-casual', 'reflex', 'arcade'],
  tags: ['color', 'switch', 'tap', 'rings', 'timing'],
  difficulty: 'medium',
  controls: { desktop: 'Space / click to hop', touch: 'Tap to hop' },
  score: { label: 'Stars', format: 'points' },
  medals: { bronze: 15, silver: 40, gold: 80 },
  theme: { from: '#8b5cf6', to: '#111827', accent: '#f472b6' },
  sessionLength: '30s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 88,
  addedAt: '2026-09-26',
  shop: {
    title: 'Trail Shop',
    icon: '🌈',
    skinLabel: 'Trails',
    upgrades: [
      upgrade('slow', 'Time warp', '⏳', 'Obstacles spin 6% slower per level', 5, 90),
      upgrade('shield', 'Prism shield', '🛡️', 'Pass one wrong color per level', 2, 220, 2.2),
      upgrade('lucky', 'Star shower', '⭐', '+15% coin chance per level', 4, 70),
    ],
    skins: [
      skin('spark', 'Spark', 0, ['#f8fafc', '#94a3b8', '#ffffff'], { icon: '✨' }),
      skin('comet', 'Comet', 250, ['#fb923c', '#f97316', '#fde68a'], { icon: '☄️' }),
      skin('aqua', 'Aqua', 400, ['#22d3ee', '#0e7490', '#cffafe'], { icon: '💧' }),
      skin('neon', 'Neon', 700, ['#a3e635', '#65a30d', '#ecfccb'], { icon: '💚' }),
      skin('rainbow', 'Rainbow', 0, ['#f472b6', '#8b5cf6', '#facc15'], { icon: '🌈', adUnlock: 3 }),
    ],
  },
});
