import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'drift-king',
  title: 'Drift King',
  tagline: 'Slide through endless bends. Longer drifts, bigger combos.',
  description:
    'A top-down drifting game on a never-ending mountain road. Hold to steer and let the rear slide out — the longer you drift without touching the barriers, the bigger your combo. Tune grip and power, and collect cars.',
  howToPlay: [
    'Hold the left or right side of the screen (or ←/→) to steer.',
    'Drift through bends to build a combo multiplier.',
    'Leaving the road ends the run. Coins buy upgrades and cars.',
  ],
  categories: ['racing', 'endless', 'hyper-casual'],
  tags: ['drift', 'cars', 'top-down', 'combo', 'driving'],
  difficulty: 'medium',
  controls: { desktop: '←/→ or A/D to steer', touch: 'Hold left/right side to steer' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1500, silver: 4000, gold: 9000 },
  theme: { from: '#7c3aed', to: '#0f172a', accent: '#c084fc' },
  sessionLength: '30s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 87,
  addedAt: '2026-09-26',
  shop: {
    title: 'Garage',
    icon: '🏎️',
    skinLabel: 'Cars',
    upgrades: [
      upgrade('grip', 'Grip', '🛞', '+8% grip per level — easier to catch slides', 5, 80),
      upgrade('drift', 'Drift tune', '💨', '+12% drift points per level', 5, 90),
      upgrade('magnet', 'Coin magnet', '🧲', 'Wider coin pick-up radius', 4, 70),
      upgrade('armor', 'Bumper', '🛡️', 'Survive one barrier hit per run (per level)', 2, 250, 2.2),
    ],
    skins: [
      skin('ae86', 'Street 86', 0, ['#f8fafc', '#0f172a', '#94a3b8'], { icon: '🚗' }),
      skin('purple', 'Violet R', 300, ['#a855f7', '#3b0764', '#e9d5ff'], { icon: '🏎️' }),
      skin('orange', 'Orange Fury', 550, ['#f97316', '#431407', '#fed7aa'], { icon: '🔥' }),
      skin('teal', 'Teal Ghost', 900, ['#14b8a6', '#042f2e', '#99f6e4'], { icon: '👻' }),
      skin('carbon', 'Carbon Black', 1500, ['#1f2937', '#000000', '#f43f5e'], { icon: '🖤' }),
      skin('gold', 'Golden Drift', 0, ['#fbbf24', '#78350f', '#fff7ed'], { icon: '👑', adUnlock: 3 }),
    ],
  },
});
