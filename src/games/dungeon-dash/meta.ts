import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'dungeon-dash',
  title: 'Dungeon Dash',
  tagline: 'Clear room after room of monsters. Gear up, go deeper.',
  description:
    'A bite-sized dungeon crawler. Move your hero and the sword swings on its own at anything close. Clear each room of slimes, bats and skeleton archers, step through the door and go deeper. Forge a sharper sword, stronger armour and new costumes.',
  howToPlay: [
    'Drag anywhere (or WASD/arrows) to move. Your sword swings automatically.',
    'Clear every monster to open the door, then walk through it.',
    'Dodge arrows. Potions heal, coins buy gear and costumes.',
  ],
  categories: ['action', 'strategy', 'arcade'],
  tags: ['dungeon', 'rpg', 'sword', 'monsters', 'roguelite', 'hero'],
  difficulty: 'medium',
  controls: { desktop: 'WASD / arrows to move', touch: 'Drag anywhere to move' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1000, silver: 3000, gold: 7000 },
  theme: { from: '#7c3aed', to: '#1c1917', accent: '#c4b5fd' },
  sessionLength: '2–6 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 88,
  addedAt: '2026-09-26',
  shop: {
    title: 'Blacksmith',
    icon: '⚔️',
    skinLabel: 'Costumes',
    upgrades: [
      upgrade('sword', 'Sharper sword', '🗡️', '+20% sword damage per level', 8, 70),
      upgrade('armor', 'Armour', '🛡️', '+1 heart per level', 4, 150, 1.9),
      upgrade('boots', 'Swift boots', '👢', '+8% move speed per level', 4, 70),
      upgrade('crit', 'Critical edge', '✨', '+8% chance of double damage per level', 5, 90),
    ],
    skins: [
      skin('knight', 'Knight', 0, ['#94a3b8', '#1e3a8a', '#e2e8f0'], { icon: '🛡️' }),
      skin('ranger', 'Ranger', 350, ['#15803d', '#78350f', '#bbf7d0'], { icon: '🏹', perk: '+10% speed' }),
      skin('mage', 'Battle Mage', 650, ['#7c3aed', '#312e81', '#f0abfc'], { icon: '🔮', perk: '+20% reach' }),
      skin('samurai', 'Samurai', 1000, ['#b91c1c', '#111827', '#fde68a'], {
        icon: '⛩️',
        perk: '+15% damage',
      }),
      skin('golden', 'Golden Knight', 0, ['#fbbf24', '#92400e', '#fff7ed'], {
        icon: '👑',
        perk: '+10% damage',
        adUnlock: 4,
      }),
    ],
  },
});
