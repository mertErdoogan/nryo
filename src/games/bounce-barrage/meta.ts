import { defineMeta, skin, upgrade } from '../define';

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
    'Every 10 turns pays coins; if blocks reach the floor you can continue once or twice.',
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
  shop: {
    title: 'Ball Shop',
    icon: '⚪',
    skinLabel: 'Balls',
    upgrades: [
      upgrade('start', 'Head start', '➕', 'Start new games with one more ball per level', 5, 80),
      upgrade('speed', 'Fast balls', '💨', '+10% ball speed per level', 3, 60),
      upgrade('guide', 'Long sight', '🔭', 'Longer aiming guide', 2, 100),
    ],
    skins: [
      skin('white', 'Classic', 0, ['#f8fafc', '#ffffff', '#5eead4'], { icon: '⚪' }),
      skin('mint', 'Mint', 100, ['#5eead4', '#99f6e4', '#14b8a6'], { icon: '🟢' }),
      skin('flame', 'Flame', 200, ['#fb923c', '#fed7aa', '#ea580c'], { icon: '🟠' }),
      skin('plasma', 'Plasma', 300, ['#e879f9', '#f5d0fe', '#a21caf'], { icon: '🟣' }),
      skin('gold', 'Gold', 0, ['#facc15', '#fef08a', '#ca8a04'], { icon: '🟡', adUnlock: 3 }),
    ],
  },
});
