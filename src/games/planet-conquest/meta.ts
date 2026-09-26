import { defineMeta } from '../define';

export default defineMeta({
  id: 'planet-conquest',
  title: 'Planet Conquest',
  tagline: 'Send your fleets, seize the galaxy, outwit rival AIs.',
  description:
    'A real-time space strategy duel. Planets build ships — drag from your planets to launch half their fleet at a target. Grab neutral worlds, defend your core and wipe out rival empires.',
  howToPlay: [
    'Drag from one of your blue planets to any other planet.',
    'Half the ships launch. More ships than defenders captures it.',
    'Bigger planets build faster. Eliminate every rival to win.',
  ],
  categories: ['strategy', 'versus'],
  tags: ['galcon', 'rts', 'space', 'planets', 'ai', 'conquest'],
  difficulty: 'medium',
  controls: { desktop: 'Drag from your planet to a target', touch: 'Drag from your planet to a target' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 900, silver: 1700, gold: 2600 },
  theme: { from: '#2563eb', to: '#0c0a2a', accent: '#60a5fa' },
  sessionLength: '1–4 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 81,
  addedAt: '2026-06-25',
});
