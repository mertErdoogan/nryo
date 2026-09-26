import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'block-drop',
  title: 'Block Drop',
  tagline: 'Rotate, slide, drop — clear lines as the stack speeds up.',
  description:
    'The falling-blocks classic, rebuilt for the browser. Rotate and slide the pieces to complete lines, use Hold to save a piece for later, and go for four-line clears as the speed climbs.',
  howToPlay: [
    'Move with ←/→ (or drag), rotate with ↑ (or tap).',
    'Hard drop with Space (or swipe down). Hold with C.',
    'Clear several lines at once for big points. Speed rises every 10 lines.',
    'Level-ups and Block Busters pay coins; topped out? Continue and the bottom rows vanish.',
  ],
  categories: ['arcade', 'puzzle'],
  tags: ['tetris', 'blocks', 'falling', 'lines', 'classic'],
  difficulty: 'medium',
  controls: {
    desktop: '←/→ move, ↑ rotate, ↓ soft drop, Space hard drop, C hold',
    touch: 'Drag to move, tap to rotate, swipe down to drop',
  },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 3000, silver: 10000, gold: 25000 },
  theme: { from: '#7c3aed', to: '#0e7490', accent: '#a78bfa' },
  sessionLength: '2–10 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 89,
  addedAt: '2026-06-28',
  shop: {
    title: 'Workshop',
    icon: '🟦',
    skinLabel: 'Palettes',
    upgrades: [
      upgrade('lock', 'Sticky hands', '✋', '+0.1 s lock delay per level', 3, 90),
      upgrade('calm', 'Calm gravity', '🐢', 'Pieces fall 10% slower per level', 3, 120),
    ],
    skins: [
      skin('classic', 'Classic', 0, ['#22d3ee', '#a855f7', '#facc15'], { icon: '🟦' }),
      skin('pastel', 'Pastel', 150, ['#a5f3fc', '#e9d5ff', '#fef08a'], { icon: '🧁' }),
      skin('neon', 'Neon', 250, ['#00fff0', '#ff00e6', '#fffb00'], { icon: '⚡' }),
      skin('ocean', 'Ocean', 250, ['#67e8f9', '#818cf8', '#2dd4bf'], { icon: '🌊' }),
      skin('gold', 'Gold Rush', 0, ['#fde68a', '#eab308', '#d97706'], { icon: '🪙', adUnlock: 3 }),
    ],
  },
});
