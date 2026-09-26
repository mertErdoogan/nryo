import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'jet-dash',
  title: 'Jet Dash',
  tagline: 'Strap on a jetpack. Dodge zappers, dodge missiles, grab coins.',
  description:
    'An endless jetpack run through a secret lab. Hold to fly, release to drop, and thread between electric zappers and homing missiles while scooping up coin trails. Buy shields, magnets and a head start.',
  howToPlay: [
    'Hold (or Space/↑) to fire the jetpack; release to fall.',
    'Avoid zappers and missiles — a red warning shows where missiles come from.',
    'Coins buy shields, magnets and new jetpacks.',
  ],
  categories: ['endless', 'arcade', 'hyper-casual'],
  tags: ['jetpack', 'runner', 'coins', 'lab', 'missiles'],
  difficulty: 'easy',
  controls: { desktop: 'Hold Space / ↑ / mouse to fly', touch: 'Hold anywhere to fly' },
  score: { label: 'Meters', format: 'points' },
  medals: { bronze: 800, silver: 2000, gold: 4000 },
  theme: { from: '#0ea5e9', to: '#1e1b4b', accent: '#38bdf8' },
  sessionLength: '30s–3 min',
  orientation: 'any',
  realtime: true,
  popularity: 90,
  addedAt: '2026-09-26',
  shop: {
    title: 'Jet Lab',
    icon: '🚀',
    skinLabel: 'Jetpacks',
    upgrades: [
      upgrade(
        'shield',
        'Bubble shield',
        '🛡️',
        'Start with a shield that absorbs a hit (per level)',
        2,
        200,
        2.2,
      ),
      upgrade('magnet', 'Coin magnet', '🧲', 'Pulls in nearby coins', 4, 80),
      upgrade('boost', 'Head start', '⚡', '+150 m invincible dash at the start per level', 3, 150),
      upgrade('lucky', 'Lucky coins', '🍀', '+15% chance a coin is worth double', 4, 90),
    ],
    skins: [
      skin('classic', 'Lab Classic', 0, ['#f97316', '#334155', '#fde68a'], { icon: '🎒' }),
      skin('rocket', 'Red Rocket', 300, ['#ef4444', '#7f1d1d', '#fecaca'], { icon: '🚀' }),
      skin('bubble', 'Bubblegum', 500, ['#f472b6', '#831843', '#fbcfe8'], { icon: '🍬' }),
      skin('plasma', 'Plasma', 900, ['#22d3ee', '#164e63', '#a5f3fc'], { icon: '⚡' }),
      skin('gold', 'Golden Jet', 0, ['#fbbf24', '#78350f', '#fff7ed'], { icon: '👑', adUnlock: 3 }),
    ],
  },
});
