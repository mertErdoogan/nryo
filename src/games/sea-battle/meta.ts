import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'sea-battle',
  title: 'Sea Battle',
  tagline: 'Hunt the bot’s fleet before it sinks yours.',
  description:
    'The classic naval guessing game against a bot admiral. Fire at the enemy grid to find and sink five hidden ships — a hit lets you fire again. Radar scans reveal a patch of ocean. Sink them all before the bot finds your fleet.',
  howToPlay: [
    'Tap a square on the enemy grid to fire. A hit gives you another shot.',
    'Sunk ships reveal the water around them (ships never touch).',
    'Radar scans a 3×3 area. Sink all five enemy ships to win.',
  ],
  categories: ['strategy', 'versus', 'brain'],
  tags: ['battleship', 'naval', 'ships', 'board game', 'ai', 'guess'],
  difficulty: 'easy',
  controls: { desktop: 'Click the enemy grid', touch: 'Tap the enemy grid' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 900, silver: 1800, gold: 3000 },
  theme: { from: '#0369a1', to: '#0c1a2b', accent: '#7dd3fc' },
  sessionLength: '3–6 min',
  orientation: 'portrait',
  realtime: false,
  dailyEligible: false,
  popularity: 81,
  addedAt: '2026-09-26',
  maxRevives: 1,
  shop: {
    title: 'Shipyard',
    icon: '⚓',
    skinLabel: 'Navies',
    upgrades: [upgrade('radar', 'Radar', '📡', '+1 radar scan per battle per level', 3, 100)],
    skins: [
      skin('navy', 'Navy Grey', 0, ['#64748b', '#0c4a6e', '#7dd3fc'], { icon: '🚢' }),
      skin('pirate', 'Pirate', 350, ['#78350f', '#1c1917', '#fbbf24'], { icon: '🏴‍☠️' }),
      skin('arctic', 'Arctic', 500, ['#e2e8f0', '#0e7490', '#a5f3fc'], { icon: '🧊' }),
      skin('stealth', 'Stealth', 800, ['#1f2937', '#030712', '#a78bfa'], { icon: '🛥️' }),
      skin('gold', 'Admiral Gold', 0, ['#fbbf24', '#0c4a6e', '#fef3c7'], { icon: '🎖️', adUnlock: 3 }),
    ],
  },
});
