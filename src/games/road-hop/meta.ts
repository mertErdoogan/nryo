import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'road-hop',
  title: 'Road Hop',
  tagline: 'Why did the chicken cross the road? For the high score.',
  description:
    'Hop forward across busy roads, rushing rivers and railway tracks. Ride logs, dodge trucks and trains, and don’t dawdle — the screen keeps moving. Unlock a whole zoo of hoppers.',
  howToPlay: [
    'Tap (or ↑) to hop forward; swipe or use ←/→/↓ to sidestep.',
    'Ride logs across rivers — water is deadly. Watch for the train light!',
    'Don’t fall behind: the screen keeps scrolling forward.',
  ],
  categories: ['hyper-casual', 'arcade', 'endless'],
  tags: ['crossy', 'hop', 'chicken', 'traffic', 'river', 'voxel'],
  difficulty: 'easy',
  controls: { desktop: 'Arrow keys / WASD to hop', touch: 'Tap to hop forward, swipe to sidestep' },
  score: { label: 'Hops', format: 'points' },
  medals: { bronze: 60, silver: 150, gold: 300 },
  theme: { from: '#22c55e', to: '#0369a1', accent: '#86efac' },
  sessionLength: '30s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 92,
  addedAt: '2026-09-26',
  shop: {
    title: 'Hopper Shop',
    icon: '🐔',
    skinLabel: 'Characters',
    upgrades: [
      upgrade('shield', 'Lucky feather', '🪶', 'Survive one hit per run (per level)', 2, 220, 2.2),
      upgrade('magnet', 'Coin magnet', '🧲', 'Grab coins from neighbouring tiles', 3, 90),
      upgrade('lucky', 'Coin rain', '🍀', '+25% more coins on the map per level', 4, 70),
    ],
    skins: [
      skin('chicken', 'Chicken', 0, ['#f8fafc', '#ef4444', '#f59e0b'], { icon: '🐔' }),
      skin('frog', 'Frog', 250, ['#22c55e', '#166534', '#fde047'], { icon: '🐸' }),
      skin('cat', 'Ginger Cat', 400, ['#fb923c', '#7c2d12', '#fef3c7'], { icon: '🐱' }),
      skin('robot', 'Robot', 700, ['#94a3b8', '#334155', '#22d3ee'], { icon: '🤖' }),
      skin('panda', 'Panda', 1000, ['#f8fafc', '#111827', '#f472b6'], { icon: '🐼' }),
      skin('unicorn', 'Unicorn', 0, ['#fbcfe8', '#a855f7', '#fde047'], { icon: '🦄', adUnlock: 3 }),
    ],
  },
});
