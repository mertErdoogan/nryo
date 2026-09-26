import { defineMeta } from '../define';

export default defineMeta({
  id: 'bounce-barrage',
  title: 'Bounce Barrage',
  tagline: 'Aim a volley of balls to smash numbered blocks.',
  description:
    'Aim once and unleash a stream of bouncing balls. Every hit chips a block’s number down; grab rings for more balls. Blocks creep closer each turn — don’t let them reach the bottom.',
  howToPlay: [
    'Drag to aim, release to fire your whole volley.',
    'Each hit removes 1 from a block. Rings give you an extra ball.',
    'Blocks move down every turn. If one reaches the bottom, it’s over.',
  ],
  categories: ['physics', 'strategy', 'hyper-casual'],
  tags: ['ballz', 'bricks', 'aim', 'bounce', 'turns'],
  difficulty: 'easy',
  controls: {
    desktop: 'Drag to aim, release to fire (or ←/→ + Space)',
    touch: 'Drag to aim, release to fire',
  },
  score: { label: 'Turns', format: 'points' },
  medals: { bronze: 20, silver: 45, gold: 80 },
  theme: { from: '#0d9488', to: '#1e1b4b', accent: '#2dd4bf' },
  sessionLength: '2–8 min',
  orientation: 'portrait',
  resumable: true,
  realtime: false,
  popularity: 79,
  addedAt: '2026-06-22',
});
