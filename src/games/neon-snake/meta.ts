import { defineMeta, skin, upgrade } from '../define';

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
  shop: {
    title: 'Snake Den',
    icon: '🐍',
    skinLabel: 'Skins',
    upgrades: [
      upgrade('pace', 'Chill pace', '🐢', '6% slower steps per level', 3, 90),
      upgrade('golden', 'Golden appetite', '⭐', 'Golden orbs (2 coins) appear sooner', 3, 110),
      upgrade('slim', 'Slim build', '🪶', 'Grow one segment less per orb', 1, 250),
    ],
    skins: [
      skin('neon', 'Neon Green', 0, ['#34d399', '#22d3ee', '#34d399'], { icon: '🟢' }),
      skin('fire', 'Fire Serpent', 200, ['#ef4444', '#f59e0b', '#f97316'], { icon: '🔥' }),
      skin('ice', 'Ice Viper', 200, ['#22d3ee', '#6366f1', '#67e8f9'], { icon: '❄️' }),
      skin('candy', 'Candy', 350, ['#ec4899', '#f43f5e', '#f472b6'], { icon: '🍬' }),
      skin('gold', 'Gilded', 800, ['#f59e0b', '#fde047', '#facc15'], { icon: '👑' }),
      skin('rainbow', 'Rainbow', 0, ['#ef4444', '#22c55e', '#a855f7'], { icon: '🌈', adUnlock: 3 }),
    ],
  },
});
