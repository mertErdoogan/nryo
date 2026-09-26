import { defineMeta } from '../define';

export default defineMeta({
  id: 'sky-hopper',
  title: 'Sky Hopper',
  tagline: 'Tap to flap through the neon pillars.',
  description:
    'Keep your little bird airborne and thread it through gaps between pillars. The gaps tighten and the pace quickens the further you fly.',
  howToPlay: [
    'Tap to flap upward — gravity does the rest.',
    'Fly through the gaps between pillars.',
    'Touching a pillar or the ground ends the run.',
  ],
  categories: ['hyper-casual', 'endless', 'arcade'],
  tags: ['flappy', 'one-tap', 'bird', 'flying', 'timing'],
  difficulty: 'medium',
  controls: { desktop: 'Click, Space or ↑ to flap', touch: 'Tap to flap' },
  score: { label: 'Pillars', format: 'points' },
  medals: { bronze: 8, silver: 20, gold: 40 },
  theme: { from: '#38bdf8', to: '#6366f1', accent: '#fde047' },
  sessionLength: '10s–2 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 93,
  addedAt: '2026-06-01',
});
