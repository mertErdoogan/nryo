import { defineMeta } from '../define';

export default defineMeta({
  id: 'tile-tapper',
  title: 'Tile Tapper',
  tagline: 'Tap the dark tiles in rhythm. Never touch white.',
  description:
    'A fast rhythm-reflex game: dark tiles stream down four lanes and each one plays a note. Tap every dark tile before it slips away — and never tap the empty lanes.',
  howToPlay: [
    'Tap each dark tile as it scrolls down.',
    'Tapping a white space or missing a tile ends the run.',
    'It speeds up the further you go.',
  ],
  categories: ['reflex', 'hyper-casual', 'endless'],
  tags: ['piano', 'rhythm', 'music', 'tiles', 'tap'],
  difficulty: 'medium',
  controls: { desktop: 'Click tiles or keys D F J K', touch: 'Tap the dark tiles' },
  score: { label: 'Tiles', format: 'points' },
  medals: { bronze: 40, silver: 100, gold: 180 },
  theme: { from: '#0f172a', to: '#475569', accent: '#e2e8f0' },
  sessionLength: '20s–2 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 81,
  addedAt: '2026-06-06',
});
