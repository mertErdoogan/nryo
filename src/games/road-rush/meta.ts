import { defineMeta } from '../define';

export default defineMeta({
  id: 'road-rush',
  title: 'Road Rush',
  tagline: 'Weave through traffic at full throttle. Near misses pay.',
  description:
    'An endless highway sprint. Steer through ever-faster traffic, skim past cars for near-miss bonuses and grab coins. One crash and it’s over — how far can you go?',
  howToPlay: [
    'Hold and drag (or use ←/→) to steer between lanes.',
    'Skim close past cars for near-miss bonuses.',
    'Grab coins. Any collision ends the run.',
  ],
  categories: ['racing', 'endless', 'arcade'],
  tags: ['cars', 'traffic', 'driving', 'race', 'highway'],
  difficulty: 'medium',
  controls: { desktop: '←/→ or A/D to steer (or mouse drag)', touch: 'Drag left/right to steer' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 800, silver: 2000, gold: 4000 },
  theme: { from: '#f59e0b', to: '#1f2937', accent: '#fbbf24' },
  sessionLength: '30s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 90,
  addedAt: '2026-06-14',
});
