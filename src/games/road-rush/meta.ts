import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'road-rush',
  title: 'Road Rush',
  tagline: 'Weave through traffic at full throttle. Near misses pay.',
  description:
    'An endless highway sprint. Steer through ever-faster traffic, skim past cars for near-miss bonuses and grab coins. One crash and it’s over — how far can you go?',
  howToPlay: [
    'Hold and drag (or use ←/→) to steer between lanes.',
    'Skim close past cars for near-miss bonuses.',
    'Grab coins and spend them in the Garage on faster, grippier cars.',
  ],
  categories: ['racing', 'endless', 'arcade'],
  tags: ['cars', 'traffic', 'driving', 'race', 'highway'],
  difficulty: 'medium',
  controls: { desktop: '←/→ or A/D to steer (or mouse drag)', touch: 'Drag left/right to steer' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 800, silver: 2000, gold: 4000 },
  theme: { from: '#f59e0b', to: '#1f2937', accent: '#fbbf24' },
  sessionLength: '30s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 90,
  addedAt: '2026-06-14',
  shop: {
    title: 'Garage',
    icon: '🚗',
    skinLabel: 'Cars',
    upgrades: [
      upgrade('handling', 'Steering', '🛞', '+8% steering speed per level', 5, 60),
      upgrade('magnet', 'Coin magnet', '🧲', 'Pulls in coins from further away', 4, 80),
      upgrade('shield', 'Crash shield', '🛡️', 'Absorbs one hit; recharges faster each level', 4, 150),
      upgrade('bonus', 'Near-miss pro', '⚡', '+25% near-miss points per level', 4, 90),
    ],
    skins: [
      skin('hatch', 'City Hatch', 0, ['#fbbf24', '#b45309', '#fef9c3'], { icon: '🚗' }),
      skin('sport', 'Sport Coupe', 300, ['#ef4444', '#f8fafc', '#fecaca'], {
        icon: '🏎️',
        perk: '+10% steering',
      }),
      skin('muscle', 'Muscle Car', 500, ['#1d4ed8', '#f8fafc', '#bfdbfe'], {
        icon: '🚙',
        perk: '+5% steering',
      }),
      skin('police', 'Interceptor', 800, ['#0f172a', '#f8fafc', '#fef9c3'], {
        icon: '🚓',
        perk: '+8% steering',
      }),
      skin('super', 'Supercar', 1500, ['#a3e635', '#111827', '#ecfccb'], {
        icon: '🏁',
        perk: '+18% steering',
      }),
      skin('gold', 'Golden GT', 0, ['#f59e0b', '#78350f', '#fef3c7'], {
        icon: '👑',
        perk: '+12% steering',
        adUnlock: 3,
      }),
    ],
  },
});
