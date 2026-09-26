import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'hex-spin',
  title: 'Hex Spin',
  tagline: 'Walls close in. Spin through the gaps. Survive.',
  description:
    'A hypnotic survival game. Hexagonal walls collapse toward the centre while the whole world twists and pulses. Orbit the core and slip through the gaps — every second counts.',
  howToPlay: [
    'Hold ←/→ (or the left/right half of the screen) to orbit the centre.',
    'Slip through the gaps in the closing walls.',
    'Survive as long as you can. Coins hide in the gaps.',
  ],
  categories: ['reflex', 'endless', 'arcade'],
  tags: ['hexagon', 'survival', 'spin', 'twitch', 'rhythm'],
  difficulty: 'hard',
  controls: { desktop: '←/→ or A/D to rotate', touch: 'Hold left/right half to rotate' },
  score: { label: 'Survived', format: 'time' },
  medals: { bronze: 20000, silver: 45000, gold: 90000 },
  theme: { from: '#db2777', to: '#1e1b4b', accent: '#f472b6' },
  sessionLength: '10s–2 min',
  orientation: 'any',
  realtime: true,
  popularity: 80,
  addedAt: '2026-09-26',
  shop: {
    title: 'Theme Lab',
    icon: '⬡',
    skinLabel: 'Themes',
    upgrades: [
      upgrade('focus', 'Focus', '🎯', '+8% turning speed per level', 4, 80),
      upgrade('slow', 'Slow time', '⏳', 'Walls close 5% slower per level', 4, 110),
      upgrade('shield', 'Hex shield', '🛡️', 'Survive one wall per level each run', 2, 240, 2.2),
    ],
    skins: [
      skin('magenta', 'Magenta', 0, ['#f472b6', '#831843', '#fdf2f8'], { icon: '💗' }),
      skin('cyber', 'Cyber', 300, ['#22d3ee', '#083344', '#ecfeff'], { icon: '💠' }),
      skin('toxic', 'Toxic', 500, ['#a3e635', '#1a2e05', '#f7fee7'], { icon: '☢️' }),
      skin('lava', 'Lava', 800, ['#f97316', '#431407', '#fff7ed'], { icon: '🌋' }),
      skin('mono', 'Mono', 0, ['#e5e7eb', '#111827', '#ffffff'], { icon: '⚪', adUnlock: 3 }),
    ],
  },
});
