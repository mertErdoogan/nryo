import { defineMeta } from '../define';

export default defineMeta({
  id: 'arena-survivor',
  title: 'Arena Survivor',
  tagline: 'Survive the swarm. Level up. Build an unstoppable hero.',
  description:
    'A top-down survival shooter. Your hero fires automatically — you focus on moving. Collect crystals to level up and pick powerful upgrades as ever-larger waves of monsters close in.',
  howToPlay: [
    'Move with WASD / arrows, or drag anywhere to use the joystick.',
    'You shoot the nearest enemy automatically.',
    'Grab blue crystals to level up and choose an upgrade.',
  ],
  categories: ['action', 'endless', 'strategy'],
  tags: ['shooter', 'survivor', 'roguelite', 'upgrades', 'waves', 'shoot'],
  difficulty: 'medium',
  controls: { desktop: 'WASD / arrows to move (or drag)', touch: 'Drag anywhere to move' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1500, silver: 4000, gold: 8000 },
  theme: { from: '#b91c1c', to: '#111827', accent: '#f87171' },
  sessionLength: '2–8 min',
  orientation: 'any',
  realtime: true,
  popularity: 91,
  addedAt: '2026-06-17',
});
