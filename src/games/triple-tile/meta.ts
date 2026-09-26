import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'triple-tile',
  title: 'Triple Tile',
  tagline: 'Tap tiles into the tray. Three of a kind vanish.',
  description:
    'A layered tile-matching puzzle. Tap any uncovered tile to move it into your tray; three matching tiles in the tray disappear. Clear the whole board to advance — but if the tray fills up, you’re stuck. Undo and shuffle boosters help.',
  howToPlay: [
    'Tap an uncovered (bright) tile to send it to the tray.',
    'Three identical tiles in the tray clear away.',
    'Clear the board before the tray fills up.',
  ],
  categories: ['puzzle', 'memory', 'brain'],
  tags: ['match 3', 'tiles', 'mahjong', 'tray', 'layers'],
  difficulty: 'easy',
  controls: { desktop: 'Click tiles', touch: 'Tap tiles' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 800, silver: 2200, gold: 5000 },
  theme: { from: '#f59e0b', to: '#be185d', accent: '#fde68a' },
  sessionLength: '2–6 min',
  orientation: 'portrait',
  realtime: false,
  popularity: 89,
  addedAt: '2026-09-26',
  shop: {
    title: 'Tile Shop',
    icon: '🀄',
    skinLabel: 'Tile sets',
    upgrades: [
      upgrade('slot', 'Bigger tray', '🧺', '+1 tray slot', 1, 500),
      upgrade('undo', 'Undo', '↩️', '+1 undo per level per upgrade', 3, 80),
      upgrade('shuffle', 'Shuffle', '🔀', '+1 shuffle per level per upgrade', 3, 90),
    ],
    skins: [
      skin('fruit', 'Fruit Market', 0, ['#fef3c7', '#f59e0b', '#be185d'], { icon: '🍓' }),
      skin('animals', 'Zoo', 300, ['#dcfce7', '#16a34a', '#14532d'], { icon: '🐼' }),
      skin('sweets', 'Sweet Shop', 500, ['#fce7f3', '#ec4899', '#831843'], { icon: '🧁' }),
      skin('space', 'Space', 800, ['#e0e7ff', '#6366f1', '#1e1b4b'], { icon: '🚀' }),
      skin('sports', 'Sports', 0, ['#e0f2fe', '#0ea5e9', '#0c4a6e'], { icon: '⚽', adUnlock: 3 }),
    ],
  },
});
