import { defineMeta } from '../define';

export default defineMeta({
  id: 'brick-breaker',
  title: 'Brick Breaker',
  tagline: 'Smash every brick with power-ups, multiball and style.',
  description:
    'Bounce the ball off your paddle to shatter walls of bricks. Catch power-ups for a wider paddle, multiball or slow motion. Each cleared wall is faster and trickier.',
  howToPlay: [
    'Move the paddle with your finger or mouse.',
    'Tap to launch. Keep the ball from falling past you.',
    'Catch falling capsules: W = wide, M = multiball, S = slow, ♥ = life.',
  ],
  categories: ['arcade', 'physics'],
  tags: ['breakout', 'bricks', 'ball', 'paddle', 'classic'],
  difficulty: 'medium',
  controls: { desktop: 'Mouse or ←/→, Space to launch', touch: 'Drag to move, tap to launch' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1500, silver: 4000, gold: 8000 },
  theme: { from: '#ec4899', to: '#1e1b4b', accent: '#f472b6' },
  sessionLength: '2–6 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 86,
  addedAt: '2026-06-05',
});
