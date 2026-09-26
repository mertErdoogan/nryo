import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'bowling-strike',
  title: 'Bowling Strike',
  tagline: 'Ten frames. Curve it into the pocket for strikes.',
  description:
    'Real ten-pin bowling with physics pins. Slide the ball into position, then swipe up to roll — curve your swipe to hook the ball into the pocket. Strikes and spares score just like the real thing.',
  howToPlay: [
    'Drag the ball left/right to line up, then swipe up to roll.',
    'Curve your swipe to hook the ball. Aim for the pocket beside the head pin.',
    'Ten frames with real strike and spare scoring.',
  ],
  categories: ['physics', 'arcade', 'reflex'],
  tags: ['bowling', 'pins', 'strike', 'sports', 'swipe'],
  difficulty: 'easy',
  controls: { desktop: 'Drag the ball, then flick upward', touch: 'Drag to position, swipe up to roll' },
  score: { label: 'Score', format: 'points' },
  medals: { bronze: 100, silver: 160, gold: 220 },
  theme: { from: '#b45309', to: '#1e1b4b', accent: '#fcd34d' },
  sessionLength: '3–5 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 83,
  addedAt: '2026-09-26',
  shop: {
    title: 'Pro Shop',
    icon: '🎳',
    skinLabel: 'Balls',
    upgrades: [
      upgrade('weight', 'Heavy ball', '🏋️', '+12% pin action per level', 4, 90),
      upgrade('hook', 'Reactive cover', '🌀', '+15% hook per level', 4, 90),
      upgrade('guide', 'Lane arrows', '🎯', 'Shows your aim line (longer per level)', 3, 80),
    ],
    skins: [
      skin('blue', 'House Blue', 0, ['#2563eb', '#1e3a8a', '#93c5fd'], { icon: '🔵' }),
      skin('marble', 'Marble', 300, ['#a855f7', '#f0abfc', '#581c87'], { icon: '🔮' }),
      skin('lava', 'Lava', 500, ['#ef4444', '#f97316', '#450a0a'], { icon: '🌋' }),
      skin('galaxy', 'Galaxy', 800, ['#1e1b4b', '#6366f1', '#e0e7ff'], { icon: '🌌' }),
      skin('gold', 'Gold Pro', 0, ['#fbbf24', '#fde68a', '#78350f'], { icon: '🏆', adUnlock: 3 }),
    ],
  },
});
