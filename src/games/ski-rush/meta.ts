import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'ski-rush',
  title: 'Ski Rush',
  tagline: 'Carve down an endless mountain. Gates pay, trees hurt.',
  description:
    'An endless downhill slalom. Carve left and right between trees and rocks, thread the flag gates for bonuses and launch off ramps. The straighter you point downhill, the faster you go.',
  howToPlay: [
    'Hold left/right (or ←/→) to carve. Straight down is fastest.',
    'Pass between blue flags for gate bonuses; hit ramps to jump.',
    'Trees and rocks end your run — a helmet saves you once.',
  ],
  categories: ['endless', 'racing', 'arcade'],
  tags: ['ski', 'snow', 'slalom', 'winter', 'downhill'],
  difficulty: 'easy',
  controls: { desktop: '←/→ or A/D to carve', touch: 'Hold left/right side, or drag' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1200, silver: 3000, gold: 6000 },
  theme: { from: '#38bdf8', to: '#1e3a8a', accent: '#7dd3fc' },
  sessionLength: '30s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 84,
  addedAt: '2026-09-26',
  shop: {
    title: 'Ski Shop',
    icon: '🎿',
    skinLabel: 'Outfits',
    upgrades: [
      upgrade('skis', 'Carving skis', '🎿', '+10% turning per level', 5, 70),
      upgrade('wax', 'Race wax', '💨', '+6% speed and points per level', 5, 80),
      upgrade('helmet', 'Helmet', '⛑️', 'Survive one crash per level each run', 2, 220, 2.2),
      upgrade('magnet', 'Coin magnet', '🧲', 'Wider coin pick-up', 4, 60),
    ],
    skins: [
      skin('red', 'Classic Red', 0, ['#ef4444', '#1e3a8a', '#fef08a'], { icon: '⛷️' }),
      skin('neon', 'Neon Pro', 300, ['#a3e635', '#111827', '#f472b6'], { icon: '💚' }),
      skin('arctic', 'Arctic White', 500, ['#f8fafc', '#64748b', '#38bdf8'], { icon: '❄️' }),
      skin('sunset', 'Sunset', 800, ['#f97316', '#7c2d12', '#fde047'], { icon: '🌅' }),
      skin('penguin', 'Penguin Suit', 0, ['#0f172a', '#f8fafc', '#f59e0b'], { icon: '🐧', adUnlock: 3 }),
    ],
  },
});
