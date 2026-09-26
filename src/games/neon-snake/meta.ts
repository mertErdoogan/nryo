import { defineMeta } from '../define';

export default defineMeta({
  id: 'neon-snake',
  title: 'Neon Snake',
  tagline: 'The classic, glowing. Eat, grow, don’t bite yourself.',
  description:
    'Steer a neon snake around the grid, eat orbs to grow and chase golden bonus fruit before it fades. The longer you get, the faster you go.',
  howToPlay: [
    'Swipe or use arrow keys to turn.',
    'Eat orbs to grow. Golden fruit is worth +50 but fades fast.',
    'Hitting a wall or your own tail ends the game.',
  ],
  categories: ['arcade', 'endless'],
  tags: ['snake', 'classic', 'retro', 'grid', 'swipe'],
  difficulty: 'easy',
  controls: { desktop: 'Arrow keys or WASD', touch: 'Swipe to turn' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 150, silver: 400, gold: 800 },
  theme: { from: '#10b981', to: '#0f172a', accent: '#34d399' },
  sessionLength: '1–4 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 87,
  addedAt: '2026-06-06',
});
