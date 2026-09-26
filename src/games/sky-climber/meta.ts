import { defineMeta } from '../define';

export default defineMeta({
  id: 'sky-climber',
  title: 'Sky Climber',
  tagline: 'Bounce from cloud to cloud and climb forever.',
  description:
    'Your jelly hero bounces automatically — just steer left and right to land on the next platform. Springs launch you high, cracked platforms crumble and spiky drones patrol the upper sky.',
  howToPlay: [
    'Hold the left or right side (or ←/→) to steer.',
    'You bounce automatically. Springs send you flying.',
    'Brown platforms crumble. Falling off the screen ends the climb.',
  ],
  categories: ['endless', 'hyper-casual', 'physics'],
  tags: ['jump', 'platformer', 'climb', 'doodle', 'bounce'],
  difficulty: 'easy',
  controls: { desktop: '←/→ or A/D to steer', touch: 'Hold left or right side to steer' },
  score: { label: 'Height', format: 'points' },
  medals: { bronze: 1000, silver: 2500, gold: 5000 },
  theme: { from: '#38bdf8', to: '#a78bfa', accent: '#bae6fd' },
  sessionLength: '30s–4 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 84,
  addedAt: '2026-06-23',
});
