import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'meteor-dodge',
  title: 'Meteor Dodge',
  tagline: 'Weave your ship through an endless meteor storm.',
  description:
    'Pilot a tiny ship through a thickening meteor shower. Grab crystals for points and shields to survive a hit. How long can you last?',
  howToPlay: [
    'Drag (or move the mouse) to steer your ship.',
    'Dodge meteors — one hit ends the run unless shielded.',
    'Collect crystals for +25 and blue shields for protection.',
    'Crystals are coins: upgrade your ship in the Hangar.',
  ],
  categories: ['endless', 'action', 'reflex'],
  tags: ['dodge', 'space', 'survival', 'asteroids', 'avoid'],
  difficulty: 'medium',
  controls: { desktop: 'Mouse, WASD or arrow keys', touch: 'Drag anywhere to steer' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 400, silver: 1000, gold: 2000 },
  theme: { from: '#1e293b', to: '#7c2d12', accent: '#fb923c' },
  sessionLength: '20s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 82,
  addedAt: '2026-06-04',
  shop: {
    title: 'Hangar',
    icon: '🚀',
    skinLabel: 'Ships',
    upgrades: [
      upgrade('thrusters', 'Thrusters', '🔥', '+10% ship speed per level', 4, 70),
      upgrade('hull', 'Slim hull', '🛸', 'Smaller hitbox each level', 3, 120),
      upgrade('shield', 'Shield bay', '🛡️', 'Start shielded; shields drop more often', 3, 150),
      upgrade('magnet', 'Tractor beam', '🧲', 'Collect pickups from further away', 3, 80),
    ],
    skins: [
      skin('scout', 'Scout', 0, ['#e2e8f0', '#38bdf8', '#fb923c'], { icon: '🚀' }),
      skin('ruby', 'Ruby Wing', 200, ['#f43f5e', '#fde68a', '#f97316'], { icon: '♦️' }),
      skin('emerald', 'Emerald', 350, ['#34d399', '#ecfeff', '#22d3ee'], { icon: '💚' }),
      skin('stealth', 'Stealth', 700, ['#334155', '#f43f5e', '#a855f7'], { icon: '🦇' }),
      skin('solar', 'Solar Flare', 0, ['#fbbf24', '#7c2d12', '#fde047'], { icon: '☀️', adUnlock: 3 }),
    ],
  },
});
