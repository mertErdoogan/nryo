import { defineMeta } from '../define';

export default defineMeta({
  id: 'memory-match',
  title: 'Memory Match',
  tagline: 'Flip, remember, match — before the clock runs out.',
  description:
    'Classic pair matching against the clock. Memorise the preview, then find every pair. Each cleared board adds time and deals a bigger one.',
  howToPlay: [
    'Memorise the cards during the quick preview.',
    'Flip two cards at a time to find matching pairs.',
    'Clear boards to earn bonus time. Streaks multiply points.',
  ],
  categories: ['memory', 'brain', 'puzzle'],
  tags: ['cards', 'pairs', 'concentration', 'matching', 'timed'],
  difficulty: 'easy',
  controls: { desktop: 'Click cards (or Tab + Enter)', touch: 'Tap cards to flip' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1500, silver: 3500, gold: 6000 },
  theme: { from: '#8b5cf6', to: '#0ea5e9', accent: '#c4b5fd' },
  sessionLength: '1–3 min',
  orientation: 'any',
  realtime: true,
  popularity: 83,
  addedAt: '2026-06-02',
});
