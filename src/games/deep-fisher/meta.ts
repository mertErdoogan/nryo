import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'deep-fisher',
  title: 'Deep Fisher',
  tagline: 'Dodge fish on the way down, hook them all on the way up.',
  description:
    'Drop your line into the deep. On the way down, steer around the fish — touching one starts the reel-in early. On the way up, sweep through the shoals to hook as many as your line holds, and dodge the sharks. Rarer fish live deeper: upgrade your line to reach them.',
  howToPlay: [
    'Drag (or ←/→) to steer the hook.',
    'Going down: avoid fish so you can reach deeper, pricier ones.',
    'Coming up: hook everything you can — but never touch a shark!',
  ],
  categories: ['hyper-casual', 'arcade', 'strategy'],
  tags: ['fishing', 'ocean', 'upgrade', 'hook', 'depth', 'idle'],
  difficulty: 'easy',
  controls: { desktop: 'Mouse or ←/→ to steer', touch: 'Drag to steer' },
  score: { label: 'Catch value', format: 'points' },
  medals: { bronze: 150, silver: 450, gold: 1000 },
  theme: { from: '#0284c7', to: '#082f49', accent: '#67e8f9' },
  sessionLength: '30s–1 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 87,
  addedAt: '2026-09-26',
  shop: {
    title: 'Tackle Shop',
    icon: '🎣',
    skinLabel: 'Lures',
    upgrades: [
      upgrade('line', 'Longer line', '🧵', '+40 m of line per level', 8, 60, 1.5),
      upgrade('capacity', 'Bigger hook', '🪝', '+3 fish per trip per level', 6, 70),
      upgrade('sonar', 'Sonar', '📡', 'Pass through 1 extra fish on the way down per level', 4, 110),
      upgrade('value', 'Fish market', '💰', '+12% fish value per level', 5, 90),
    ],
    skins: [
      skin('red', 'Red Spinner', 0, ['#ef4444', '#f8fafc', '#fde047'], { icon: '🎣' }),
      skin('glow', 'Glow Lure', 300, ['#a3e635', '#ecfccb', '#22d3ee'], { icon: '✨' }),
      skin('squid', 'Squid Jig', 500, ['#f472b6', '#fdf2f8', '#a855f7'], { icon: '🦑' }),
      skin('chrome', 'Chrome Spoon', 800, ['#e2e8f0', '#94a3b8', '#38bdf8'], { icon: '🥄' }),
      skin('gold', 'Golden Lure', 0, ['#fbbf24', '#fff7ed', '#f97316'], { icon: '👑', adUnlock: 3 }),
    ],
  },
});
