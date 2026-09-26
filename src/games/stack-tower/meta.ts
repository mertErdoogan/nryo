import { defineMeta } from '../define';

export default defineMeta({
  id: 'stack-tower',
  title: 'Stack Tower',
  tagline: 'Drop the block. Nail the timing. Build to the sky.',
  description:
    'A one-tap timing game: drop each sliding block onto the tower. Overhangs get sliced off, perfect drops keep your tower wide and build combos.',
  howToPlay: [
    'Tap to drop the sliding block onto the tower.',
    'Anything hanging over the edge is sliced off.',
    'Perfect drops score double — three in a row widen the block.',
  ],
  categories: ['hyper-casual', 'reflex', 'endless'],
  tags: ['timing', 'one-tap', 'tower', 'blocks', 'stack'],
  difficulty: 'easy',
  controls: { desktop: 'Click, Space or ↓ to drop', touch: 'Tap anywhere to drop' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 15, silver: 35, gold: 60 },
  theme: { from: '#f97316', to: '#db2777', accent: '#fb923c' },
  sessionLength: '30s–2 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 96,
  addedAt: '2026-06-01',
});
