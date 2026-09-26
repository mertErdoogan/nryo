import { defineMeta } from '../define';

export default defineMeta({
  id: 'math-sprint',
  title: 'Math Sprint',
  tagline: 'Quick sums against the clock. Right answers buy time.',
  description:
    'Solve arithmetic as fast as you can. Every correct answer adds time and pushes you to harder equations — from simple sums to multiplication and two-step problems.',
  howToPlay: [
    'Pick the right answer out of four.',
    'Correct: +1.5 seconds. Wrong: −3 seconds.',
    'Problems get harder as your streak grows.',
  ],
  categories: ['brain', 'puzzle'],
  tags: ['math', 'numbers', 'arithmetic', 'mental', 'quick'],
  difficulty: 'easy',
  controls: { desktop: 'Click or keys 1–4', touch: 'Tap an answer' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 300, silver: 700, gold: 1300 },
  theme: { from: '#0ea5e9', to: '#4338ca', accent: '#7dd3fc' },
  sessionLength: '40s–2 min',
  orientation: 'any',
  realtime: true,
  popularity: 77,
  addedAt: '2026-06-07',
});
