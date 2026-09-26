import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'tower-guard',
  title: 'Tower Guard',
  tagline: 'Build, upgrade and hold the line for 15 waves.',
  description:
    'A compact tower defense. Place blasters, frost towers and cannons along the winding road, upgrade them with the gold you earn and stop every creep before it slips through. Survive 15 waves to win.',
  howToPlay: [
    'Pick a tower below, then tap an empty grass tile to build.',
    'Tap a tower to upgrade or sell it. Frost slows, cannons splash.',
    'Call the next wave early for bonus gold. Don’t lose 20 lives!',
  ],
  categories: ['strategy', 'puzzle'],
  tags: ['tower defense', 'td', 'build', 'waves', 'upgrade'],
  difficulty: 'medium',
  controls: { desktop: 'Click to build and upgrade', touch: 'Tap to build and upgrade' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1200, silver: 2600, gold: 4200 },
  theme: { from: '#4d7c0f', to: '#1c1917', accent: '#a3e635' },
  sessionLength: '5–10 min',
  orientation: 'portrait',
  resumable: true,
  realtime: true,
  popularity: 86,
  addedAt: '2026-06-24',
  shop: {
    title: 'War Room',
    icon: '🏰',
    upgrades: [
      upgrade('gold', 'War chest', '💰', '+25 starting gold per level', 4, 80),
      upgrade('lives', 'Thick walls', '🧱', '+3 starting lives per level', 3, 90),
      upgrade('damage', 'Sharper shells', '💥', '+6% tower damage per level', 5, 110),
    ],
    skins: [skin('classic', 'Classic', 0, ['#38bdf8', '#fb923c', '#a5f3fc'])],
  },
});
