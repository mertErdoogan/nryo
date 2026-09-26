import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'tank-duel',
  title: 'Tank Duel',
  tagline: 'Arena tank battles. Ricochet shots, wave after wave.',
  description:
    'Command a tank against waves of bot tanks in a walled arena. Drive with the stick, your turret aims and fires on its own — use cover, bank shots off walls and grab repair kits. Upgrade armour, cannon and reload between battles.',
  howToPlay: [
    'Drag anywhere (or WASD/arrows) to drive. Your turret auto-aims and fires.',
    'Shells bounce off walls — use cover and ricochets.',
    'Clear every wave of bot tanks. Wrenches repair you.',
  ],
  categories: ['action', 'versus', 'strategy'],
  tags: ['tanks', 'arena', 'shooter', 'ricochet', 'bots', 'waves'],
  difficulty: 'medium',
  controls: { desktop: 'WASD / arrows to drive', touch: 'Drag anywhere to drive' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 2000, silver: 6000, gold: 14000 },
  theme: { from: '#4d7c0f', to: '#1c1917', accent: '#a3e635' },
  sessionLength: '2–6 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 86,
  addedAt: '2026-09-26',
  shop: {
    title: 'Workshop',
    icon: '🛡️',
    skinLabel: 'Camo',
    upgrades: [
      upgrade('armor', 'Armour', '🛡️', '+25 max HP per level', 6, 70),
      upgrade('cannon', 'Cannon', '💥', '+15% shell damage per level', 6, 80),
      upgrade('reload', 'Autoloader', '⚡', '+12% fire rate per level', 6, 80),
      upgrade('ricochet', 'Ricochet', '↩️', '+1 wall bounce per level', 2, 200, 2),
      upgrade('engine', 'Tracks', '⚙️', '+8% drive speed per level', 4, 60),
    ],
    skins: [
      skin('olive', 'Olive Drab', 0, ['#65a30d', '#365314', '#d9f99d'], { icon: '🟢' }),
      skin('desert', 'Desert', 300, ['#d6a35c', '#78350f', '#fef3c7'], { icon: '🏜️' }),
      skin('arctic', 'Arctic', 500, ['#e2e8f0', '#475569', '#bae6fd'], { icon: '❄️' }),
      skin('urban', 'Urban', 800, ['#6b7280', '#1f2937', '#f87171'], { icon: '🏙️' }),
      skin('tiger', 'Tiger', 1200, ['#f97316', '#1c1917', '#fde68a'], { icon: '🐯' }),
      skin('gold', 'Gold Plated', 0, ['#fbbf24', '#78350f', '#fff7ed'], { icon: '👑', adUnlock: 4 }),
    ],
  },
});
