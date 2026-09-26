import { defineMeta } from '../define';

export default defineMeta({
  id: 'star-defender',
  title: 'Star Defender',
  tagline: 'Blast alien waves, grab power-ups, topple the bosses.',
  description:
    'A classic vertical space shooter. Your ship fires automatically — dodge bullets, weave through formations and power up your guns. Every fifth wave a mothership arrives.',
  howToPlay: [
    'Drag (or use arrows / WASD) to fly. Your ship fires on its own.',
    'Catch P for more guns, S for a shield, + for an extra life.',
    'Every 5th wave brings a boss. You have 3 lives.',
  ],
  categories: ['action', 'arcade'],
  tags: ['shooter', 'space', 'shmup', 'aliens', 'boss', 'shoot'],
  difficulty: 'medium',
  controls: { desktop: 'Mouse drag, arrows or WASD', touch: 'Drag anywhere to fly' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 5000, silver: 15000, gold: 30000 },
  theme: { from: '#1d4ed8', to: '#020617', accent: '#60a5fa' },
  sessionLength: '1–6 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 87,
  addedAt: '2026-06-18',
});
