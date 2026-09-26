import { defineMeta } from '../define';

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
});
