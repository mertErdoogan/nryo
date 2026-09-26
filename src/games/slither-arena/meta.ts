import { defineMeta } from '../define';

export default defineMeta({
  id: 'slither-arena',
  title: 'Slither Arena',
  tagline: 'Grow the longest snake in an arena full of AI rivals.',
  description:
    'An arena brawl of glowing snakes. Eat orbs to grow, boost to cut off AI rivals and make them crash into you — then feast on what they leave behind. Touch another snake’s body and it’s over.',
  howToPlay: [
    'Point (mouse or finger) where you want to slither.',
    'Hold to boost — it costs length but can trap rivals.',
    'Your head must never touch another snake’s body or the wall.',
  ],
  categories: ['action', 'versus', 'endless'],
  tags: ['snake', 'io', 'arena', 'multiplayer-style', 'bots', 'grow'],
  difficulty: 'medium',
  controls: { desktop: 'Mouse to steer, hold click or Space to boost', touch: 'Drag to steer, hold ⚡ to boost' },
  score: { label: 'Length', format: 'points' },
  medals: { bronze: 150, silver: 400, gold: 900 },
  theme: { from: '#7c3aed', to: '#0f172a', accent: '#c084fc' },
  sessionLength: '1–5 min',
  orientation: 'any',
  realtime: true,
  popularity: 88,
  addedAt: '2026-06-16',
});
