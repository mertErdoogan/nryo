import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'sky-ace',
  title: 'Sky Ace',
  tagline: 'Biplane dogfights above the clouds. Guns blazing.',
  description:
    'Pilot a plucky biplane through squadrons of bot fighters, heavy bombers and diving kamikazes. Your guns fire nonstop — you steer. Grab power-up crates for double guns, and upgrade your plane with wingmen and a tougher hull.',
  howToPlay: [
    'Drag (or WASD/arrows) to fly. Your guns fire automatically.',
    'Dodge enemy fire and diving planes. Crates give double guns.',
    'Shoot balloons and bombers for coins.',
  ],
  categories: ['arcade', 'action', 'endless'],
  tags: ['planes', 'biplane', 'dogfight', 'shooter', 'side-scroller'],
  difficulty: 'medium',
  controls: { desktop: 'WASD / arrows or mouse drag', touch: 'Drag to fly' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 2000, silver: 6000, gold: 13000 },
  theme: { from: '#0284c7', to: '#f59e0b', accent: '#fcd34d' },
  sessionLength: '1–4 min',
  orientation: 'any',
  realtime: true,
  popularity: 82,
  addedAt: '2026-09-26',
  shop: {
    title: 'Airfield',
    icon: '✈️',
    skinLabel: 'Planes',
    upgrades: [
      upgrade('damage', 'Heavy guns', '💥', '+20% damage per level', 6, 80),
      upgrade('rate', 'Faster guns', '⚡', '+10% fire rate per level', 6, 80),
      upgrade('hull', 'Armoured hull', '❤️', '+1 hit point per level', 3, 150, 1.9),
      upgrade('wingman', 'Wingman', '🛩️', 'A wingman flies with you (stronger per level)', 2, 350, 2.2),
    ],
    skins: [
      skin('baron', 'Red Baron', 0, ['#dc2626', '#7f1d1d', '#fef3c7'], { icon: '✈️' }),
      skin('navy', 'Navy Blue', 300, ['#1d4ed8', '#1e3a8a', '#fde68a'], { icon: '🛩️' }),
      skin('jungle', 'Jungle', 500, ['#65a30d', '#365314', '#fef08a'], { icon: '🌴' }),
      skin('stunt', 'Stunt Show', 800, ['#f472b6', '#831843', '#e0f2fe'], { icon: '🎪' }),
      skin('gold', 'Gold Wing', 0, ['#fbbf24', '#78350f', '#fff7ed'], { icon: '👑', adUnlock: 3 }),
    ],
  },
});
