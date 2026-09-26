import { defineMeta } from '../define';

export default defineMeta({
  id: 'hoop-shot',
  title: 'Hoop Shot',
  tagline: 'Pull back, aim the arc, drain the shot. Swish!',
  description:
    'A flick-to-shoot basketball challenge. Drag back to aim and release to shoot. Swishes earn a bonus, streaks multiply your points — and the hoop starts moving the better you get.',
  howToPlay: [
    'Drag back from the ball, then release to shoot.',
    'The dotted arc previews your shot. Swishes score a bonus.',
    'Three misses and it’s game over. Streaks multiply points.',
  ],
  categories: ['physics', 'hyper-casual', 'arcade'],
  tags: ['basketball', 'sports', 'aim', 'flick', 'trajectory'],
  difficulty: 'easy',
  controls: { desktop: 'Click, drag back and release', touch: 'Drag back and release' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 20, silver: 50, gold: 100 },
  theme: { from: '#ea580c', to: '#1e1b4b', accent: '#fb923c' },
  sessionLength: '30s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 85,
  addedAt: '2026-06-19',
});
