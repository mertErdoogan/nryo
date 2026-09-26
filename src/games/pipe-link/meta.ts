import { defineMeta } from '../define';

export default defineMeta({
  id: 'pipe-link',
  title: 'Pipe Link',
  tagline: 'Rotate the tiles until every light glows.',
  description:
    'A calm but clever connection puzzle. Tap tiles to rotate them and route power from the core to every lamp on the board. Boards grow as you progress.',
  howToPlay: [
    'Tap a tile to rotate it clockwise.',
    'Connect every lamp to the glowing core — no loose ends.',
    'Solve faster for a bigger score. Boards grow each level.',
  ],
  categories: ['puzzle', 'brain'],
  tags: ['pipes', 'connect', 'rotate', 'logic', 'relaxing'],
  difficulty: 'easy',
  controls: { desktop: 'Click tiles to rotate', touch: 'Tap tiles to rotate' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 300, silver: 600, gold: 1000 },
  theme: { from: '#0891b2', to: '#312e81', accent: '#67e8f9' },
  sessionLength: '30s–4 min',
  orientation: 'any',
  resumable: true,
  realtime: false,
  popularity: 71,
  addedAt: '2026-06-12',
});
