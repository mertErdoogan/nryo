import { defineMeta } from '../define';

export default defineMeta({
  id: 'meteor-dodge',
  title: 'Meteor Dodge',
  tagline: 'Weave your ship through an endless meteor storm.',
  description:
    'Pilot a tiny ship through a thickening meteor shower. Grab crystals for points and shields to survive a hit. How long can you last?',
  howToPlay: [
    'Drag (or move the mouse) to steer your ship.',
    'Dodge meteors — one hit ends the run unless shielded.',
    'Collect crystals for +25 and blue shields for protection.',
  ],
  categories: ['endless', 'action', 'reflex'],
  tags: ['dodge', 'space', 'survival', 'asteroids', 'avoid'],
  difficulty: 'medium',
  controls: { desktop: 'Mouse, WASD or arrow keys', touch: 'Drag anywhere to steer' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 400, silver: 1000, gold: 2000 },
  theme: { from: '#1e293b', to: '#7c2d12', accent: '#fb923c' },
  sessionLength: '20s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 82,
  addedAt: '2026-06-04',
});
