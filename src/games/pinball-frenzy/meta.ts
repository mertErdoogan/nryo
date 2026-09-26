import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'pinball-frenzy',
  title: 'Pinball Frenzy',
  tagline: 'Flippers, bumpers, multipliers. Keep the ball alive.',
  description:
    'A neon pinball table with pop bumpers, slingshots, stand-up targets and rollover lanes that raise your multiplier. Launch, flip and chain hits for a big score. Upgrade flipper power, ball savers and extra balls.',
  howToPlay: [
    'Hold then release to launch (Space / tap). Tap left/right half (or ←/→, Z/M) to flip.',
    'Light all three top lanes to raise the multiplier.',
    'Losing every ball ends the game — continues give you another ball.',
  ],
  categories: ['physics', 'arcade', 'reflex'],
  tags: ['pinball', 'flippers', 'bumpers', 'table', 'retro'],
  difficulty: 'medium',
  controls: {
    desktop: '←/→ or Z/M flip · Space launch',
    touch: 'Tap left/right half to flip · hold to launch',
  },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 15000, silver: 40000, gold: 90000 },
  theme: { from: '#7c3aed', to: '#0f172a', accent: '#f0abfc' },
  sessionLength: '2–5 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 84,
  addedAt: '2026-09-26',
  maxRevives: 3,
  shop: {
    title: 'Table Shop',
    icon: '🎰',
    skinLabel: 'Tables',
    upgrades: [
      upgrade('flipper', 'Power flippers', '💪', '+8% flipper kick per level', 4, 90),
      upgrade('saver', 'Ball saver', '🛟', '+3 s ball saver at the start of each ball', 3, 120),
      upgrade('mult', 'Hot start', '✖️', 'Start with a higher multiplier', 2, 220, 2),
      upgrade('balls', 'Extra ball', '⚪', '+1 ball per game per level', 2, 300, 2.2),
    ],
    skins: [
      skin('neon', 'Neon Nights', 0, ['#a855f7', '#0f0a1f', '#f0abfc'], { icon: '🌃' }),
      skin('ocean', 'Deep Ocean', 350, ['#06b6d4', '#082f49', '#a5f3fc'], { icon: '🌊' }),
      skin('lava', 'Volcano', 600, ['#f97316', '#1c0a00', '#fde68a'], { icon: '🌋' }),
      skin('forest', 'Enchanted', 900, ['#22c55e', '#052e16', '#fef08a'], { icon: '🌲' }),
      skin('gold', 'High Roller', 0, ['#fbbf24', '#1c1917', '#fff7ed'], { icon: '👑', adUnlock: 3 }),
    ],
  },
});
