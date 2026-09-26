import { defineMeta, skin, upgrade } from '../define';

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
  shop: {
    title: 'Workshop',
    icon: '🧱',
    skinLabel: 'Paddles',
    upgrades: [
      upgrade('paddle', 'Long paddle', '📏', '+6 px paddle width per level', 4, 80),
      upgrade('lives', 'Spare balls', '❤️', 'Start with one more life per level', 2, 180),
      upgrade('luck', 'Lucky bricks', '🍀', 'Power-ups drop more often', 3, 90),
      upgrade('duration', 'Long power', '⏳', 'Wide and slow-mo last 25% longer per level', 3, 70),
    ],
    skins: [
      skin('neon', 'Neon Pink', 0, ['#f9a8d4', '#f472b6', '#ffffff'], { icon: '💗' }),
      skin('aqua', 'Aqua', 150, ['#67e8f9', '#06b6d4', '#ecfeff'], { icon: '💧' }),
      skin('lime', 'Lime Laser', 250, ['#bef264', '#65a30d', '#f7fee7'], { icon: '💚' }),
      skin('fire', 'Fireball', 400, ['#fdba74', '#ea580c', '#fde047'], { icon: '🔥' }),
      skin('gold', 'Golden', 0, ['#fde68a', '#f59e0b', '#fef3c7'], { icon: '🏆', adUnlock: 3 }),
    ],
  },
});
