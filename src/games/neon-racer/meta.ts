import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'neon-racer',
  title: 'Neon Racer',
  tagline: 'Outrun the clock on an endless synthwave highway.',
  description:
    'A retro 3D road racer. Weave through traffic over hills and sweeping curves, hit every checkpoint before the timer runs out, and tune your ride in the garage.',
  howToPlay: [
    'Steer with ←/→ (or drag). Stay on the tarmac — the grass slows you down.',
    'Reach each checkpoint before time runs out. Overtakes and coins pay.',
    'Press Space or tap NITRO for a burst of speed.',
  ],
  categories: ['racing', 'arcade', 'endless'],
  tags: ['cars', 'retro', 'synthwave', 'driving', 'outrun', 'checkpoint'],
  difficulty: 'medium',
  controls: { desktop: '←/→ steer · ↓ brake · Space nitro', touch: 'Drag to steer · tap NITRO' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 2500, silver: 6000, gold: 11000 },
  theme: { from: '#ec4899', to: '#312e81', accent: '#f472b6' },
  sessionLength: '1–4 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 91,
  addedAt: '2026-09-26',
  shop: {
    title: 'Garage',
    icon: '🏎️',
    skinLabel: 'Cars',
    upgrades: [
      upgrade('engine', 'Engine', '⚙️', '+5% top speed per level', 5, 90),
      upgrade('grip', 'Tyres', '🛞', 'Hold the line in curves (+12% grip per level)', 5, 70),
      upgrade('nitro', 'Nitro tank', '🔥', '+1 nitro charge per run', 3, 120),
      upgrade('clock', 'Pit crew', '⏱️', '+3 s on the starting clock per level', 4, 80),
    ],
    skins: [
      skin('coupe', 'Sunset Coupe', 0, ['#f43f5e', '#9f1239', '#fda4af'], { icon: '🚗' }),
      skin('midnight', 'Midnight GT', 350, ['#6366f1', '#1e1b4b', '#a5b4fc'], { icon: '🚙' }),
      skin('viper', 'Lime Viper', 600, ['#84cc16', '#365314', '#d9f99d'], { icon: '🏎️' }),
      skin('chrome', 'Chrome Ghost', 1200, ['#e2e8f0', '#475569', '#ffffff'], { icon: '✨' }),
      skin('gold', 'Gold Rush', 0, ['#fbbf24', '#92400e', '#fef3c7'], { icon: '👑', adUnlock: 3 }),
    ],
  },
});
