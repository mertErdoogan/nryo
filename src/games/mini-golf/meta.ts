import { defineMeta } from '../define';

export default defineMeta({
  id: 'mini-golf',
  title: 'Mini Golf',
  tagline: 'Nine tricky holes of bumpers, sand, water and walls.',
  description:
    'A cozy mini golf course with nine handcrafted holes. Pull back to aim and set your power, then bank shots off walls, dodge water and time the moving blockers. Fewest strokes wins.',
  howToPlay: [
    'Drag back from anywhere to aim — the further, the harder.',
    'Release to putt. Walls bounce, sand slows, water costs a stroke.',
    'Finish all 9 holes in as few strokes as possible (par 26).',
  ],
  categories: ['physics', 'puzzle', 'hyper-casual'],
  tags: ['golf', 'putt', 'sports', 'aim', 'holes'],
  difficulty: 'easy',
  controls: { desktop: 'Click, drag back and release', touch: 'Drag back and release' },
  score: { label: 'Strokes', format: 'strokes', lowerIsBetter: true },
  medals: { bronze: 36, silver: 31, gold: 27 },
  theme: { from: '#16a34a', to: '#14532d', accent: '#86efac' },
  sessionLength: '3–6 min',
  orientation: 'portrait',
  resumable: true,
  realtime: false,
  dailyEligible: true,
  popularity: 82,
  addedAt: '2026-06-20',
});
