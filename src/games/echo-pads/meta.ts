import { defineMeta } from '../define';

export default defineMeta({
  id: 'echo-pads',
  title: 'Echo Pads',
  tagline: 'Watch the pattern, then play it back. It keeps growing.',
  description:
    'A musical memory game: the pads light up in a sequence, you repeat it. Every round adds one more step and plays a little faster. One wrong pad ends the run.',
  howToPlay: [
    'Watch and listen as the pads light up.',
    'Repeat the sequence in the same order.',
    'Each round adds a step — one mistake ends the game.',
  ],
  categories: ['memory', 'brain'],
  tags: ['simon', 'sequence', 'music', 'pattern', 'recall'],
  difficulty: 'medium',
  controls: { desktop: 'Click pads or keys 1–4', touch: 'Tap the pads' },
  score: { label: 'Sequence', format: 'points' },
  medals: { bronze: 7, silver: 11, gold: 16 },
  theme: { from: '#22c55e', to: '#3b82f6', accent: '#facc15' },
  sessionLength: '1–3 min',
  orientation: 'any',
  realtime: false,
  popularity: 74,
  addedAt: '2026-06-08',
});
