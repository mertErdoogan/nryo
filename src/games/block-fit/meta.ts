import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'block-fit',
  title: 'Block Fit',
  tagline: 'Drop blocks, fill lines, keep the board breathing.',
  description:
    'A relaxing-but-deadly block puzzle. Drag pieces onto the 8×8 board; complete any row or column to clear it. Clear several lines at once and chain clears for big combos. No piece fits? Game over.',
  howToPlay: [
    'Drag a piece from the tray onto the board.',
    'Fill a full row or column to clear it.',
    'Multi-line clears and streaks score big. Plan for awkward pieces!',
  ],
  categories: ['puzzle', 'hyper-casual', 'strategy'],
  tags: ['blocks', '1010', 'grid', 'lines', 'relaxing'],
  difficulty: 'easy',
  controls: { desktop: 'Drag pieces · or keys 1–3, arrows, Enter', touch: 'Drag pieces onto the board' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 800, silver: 2000, gold: 4000 },
  theme: { from: '#0ea5e9', to: '#9333ea', accent: '#38bdf8' },
  sessionLength: '2–8 min',
  orientation: 'portrait',
  resumable: true,
  realtime: false,
  popularity: 92,
  addedAt: '2026-06-13',
  shop: {
    title: 'Toolbox',
    icon: '🧩',
    upgrades: [upgrade('reroll', 'Free swaps', '🔄', 'One free piece swap per level each game', 4, 80)],
    skins: [skin('classic', 'Classic', 0, ['#f472b6', '#22d3ee', '#facc15'])],
  },
});
