import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'wall-flip',
  title: 'Wall Flip',
  tagline: 'Flip between walls and dodge the spikes as you climb.',
  description:
    'Race up a neon shaft by flipping from wall to wall. Spikes line the walls and saw blades spin in the middle — time every jump as the climb gets faster.',
  howToPlay: [
    'Tap to jump to the opposite wall.',
    'Avoid spikes on your wall and saws in the middle.',
    'Grab coins for bonus points. Speed keeps increasing.',
    'Coins buy shields, faster flips and new cubes.',
  ],
  categories: ['hyper-casual', 'endless', 'reflex'],
  tags: ['one-tap', 'runner', 'wall jump', 'climb', 'dodge'],
  difficulty: 'medium',
  controls: { desktop: 'Click, Space or ←/→ to flip', touch: 'Tap to flip walls' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 150, silver: 400, gold: 800 },
  theme: { from: '#06b6d4', to: '#1e1b4b', accent: '#22d3ee' },
  sessionLength: '20s–2 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 84,
  addedAt: '2026-06-03',
  shop: {
    title: 'Lab',
    icon: '🧊',
    skinLabel: 'Cubes',
    upgrades: [
      upgrade('shield', 'Spike shield', '🛡️', 'Survive one extra hit per level', 3, 120),
      upgrade('jump', 'Quick flip', '⚡', '8% faster wall flips per level', 3, 90),
      upgrade('magnet', 'Coin magnet', '🧲', 'Grab coins from across the shaft', 3, 70),
    ],
    skins: [
      skin('ice', 'Ice Cube', 0, ['#a5f3fc', '#0891b2', '#22d3ee'], { icon: '🧊' }),
      skin('lava', 'Lava', 150, ['#fdba74', '#dc2626', '#f97316'], { icon: '🌋' }),
      skin('toxic', 'Toxic', 250, ['#bef264', '#4d7c0f', '#84cc16'], { icon: '☢️' }),
      skin('void', 'Void', 450, ['#c4b5fd', '#1e1b4b', '#8b5cf6'], { icon: '🌀' }),
      skin('gold', 'Gold Cube', 0, ['#fde68a', '#b45309', '#f59e0b'], { icon: '🪙', adUnlock: 3 }),
    ],
  },
});
