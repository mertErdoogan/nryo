import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'parking-jam',
  title: 'Parking Jam',
  tagline: 'Slide the cars. Get the red one out of the lot.',
  description:
    'A sliding-block traffic puzzle. Cars and trucks only move along their length — shuffle them around until the red car has a clear run to the exit. Every level is generated and verified solvable, and gets a little trickier each time.',
  howToPlay: [
    'Drag a car forward or backward along its lane.',
    'Clear a path so the red car can drive out the exit on the right.',
    'Fewer moves earn more points. Hints show the next best move.',
  ],
  categories: ['puzzle', 'brain', 'strategy'],
  tags: ['rush hour', 'cars', 'sliding', 'logic', 'traffic', 'parking'],
  difficulty: 'medium',
  controls: { desktop: 'Drag cars with the mouse', touch: 'Drag cars' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 800, silver: 2200, gold: 4500 },
  theme: { from: '#475569', to: '#1e293b', accent: '#f87171' },
  sessionLength: '2–6 min',
  orientation: 'portrait',
  realtime: false,
  popularity: 84,
  addedAt: '2026-09-26',
  shop: {
    title: 'Valet Desk',
    icon: '🅿️',
    skinLabel: 'Car sets',
    upgrades: [
      upgrade('time', 'Extra time', '⏱️', '+20 s on the starting clock per level', 4, 70),
      upgrade('hint', 'Free hints', '💡', '+1 free hint per run per level', 3, 110),
      upgrade('undo', 'Undo', '↩️', '+3 undos per level per upgrade', 2, 90),
    ],
    skins: [
      skin('city', 'City Traffic', 0, ['#3b82f6', '#f59e0b', '#10b981'], { icon: '🚕' }),
      skin('taxi', 'Taxi Rank', 300, ['#facc15', '#fde047', '#eab308'], { icon: '🚖' }),
      skin('police', 'Police Lot', 500, ['#1e3a8a', '#f8fafc', '#0f172a'], { icon: '🚓' }),
      skin('retro', 'Retro', 750, ['#14b8a6', '#fb7185', '#fde68a'], { icon: '🚙' }),
      skin('luxury', 'Luxury', 0, ['#111827', '#d4d4d8', '#a16207'], { icon: '🏎️', adUnlock: 3 }),
    ],
  },
});
