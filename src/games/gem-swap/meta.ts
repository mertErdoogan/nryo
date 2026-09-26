import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'gem-swap',
  title: 'Gem Swap',
  tagline: 'Swap, match three, trigger glittering chain reactions.',
  description:
    'A match-3 puzzle with thirty moves to make your fortune. Line up three or more gems; four makes a striped gem, an L or T makes a bomb, five makes a rainbow star. Cascades multiply your points.',
  howToPlay: [
    'Swap two neighbouring gems to line up 3 or more.',
    '4 in a row = striped gem · L/T shape = bomb · 5 in a row = star.',
    'You have 30 moves. Chain reactions multiply points.',
  ],
  categories: ['puzzle', 'hyper-casual'],
  tags: ['match 3', 'gems', 'jewels', 'swap', 'cascade'],
  difficulty: 'easy',
  controls: { desktop: 'Drag a gem, or click two neighbours', touch: 'Swipe a gem toward a neighbour' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 3500, silver: 7000, gold: 11000 },
  theme: { from: '#db2777', to: '#4c1d95', accent: '#f9a8d4' },
  sessionLength: '2–5 min',
  orientation: 'portrait',
  resumable: true,
  realtime: false,
  popularity: 89,
  addedAt: '2026-06-13',
  shop: {
    title: 'Jeweller',
    icon: '💎',
    upgrades: [upgrade('moves', 'Extra moves', '➕', '+2 starting moves per level', 5, 90)],
    skins: [skin('classic', 'Classic', 0, ['#f472b6', '#22d3ee', '#facc15'])],
  },
});
