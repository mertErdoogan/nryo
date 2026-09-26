import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'archer-master',
  title: 'Archer Master',
  tagline: 'Pull back, read the wind, hit the bullseye.',
  description:
    'A physics archery challenge. Drag back to draw your bow, watch the wind, and release to send the arrow arcing toward targets near and far. Bullseyes refill your quiver — run out of arrows and the round is over.',
  howToPlay: [
    'Drag anywhere to draw the bow (pull away from the target), release to shoot.',
    'Arrows arc with gravity and drift with the wind arrow.',
    'Bullseyes give an arrow back. Balloons pay coins.',
  ],
  categories: ['physics', 'reflex', 'arcade'],
  tags: ['archery', 'bow', 'arrows', 'wind', 'aim', 'targets'],
  difficulty: 'medium',
  controls: {
    desktop: 'Drag with the mouse to aim and power, release to shoot',
    touch: 'Drag back to aim, release to shoot',
  },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 600, silver: 1500, gold: 3000 },
  theme: { from: '#65a30d', to: '#0c4a6e', accent: '#bef264' },
  sessionLength: '1–4 min',
  orientation: 'any',
  realtime: true,
  popularity: 83,
  addedAt: '2026-09-26',
  shop: {
    title: 'Fletcher',
    icon: '🏹',
    skinLabel: 'Bows',
    upgrades: [
      upgrade('guide', 'Aim guide', '🎯', 'Longer trajectory preview per level', 4, 90),
      upgrade('quiver', 'Big quiver', '🏹', '+2 arrows per level', 4, 80),
      upgrade('fletch', 'Fletching', '🪶', '−20% wind drift per level', 3, 100),
      upgrade('power', 'Strong bow', '💪', '+8% draw power per level', 3, 90),
    ],
    skins: [
      skin('oak', 'Oak Bow', 0, ['#92400e', '#e5e7eb', '#dc2626'], { icon: '🏹' }),
      skin('elven', 'Elven Bow', 300, ['#15803d', '#fef3c7', '#22d3ee'], { icon: '🧝' }),
      skin('bone', 'Bone Bow', 500, ['#e7e5e4', '#44403c', '#7c3aed'], { icon: '💀' }),
      skin('royal', 'Royal Bow', 900, ['#1d4ed8', '#fde68a', '#fbbf24'], { icon: '👑' }),
      skin('fire', 'Phoenix Bow', 0, ['#ea580c', '#fde047', '#ef4444'], { icon: '🔥', adUnlock: 3 }),
    ],
  },
});
