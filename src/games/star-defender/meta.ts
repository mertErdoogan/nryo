import { defineMeta, skin, upgrade } from '../define';

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
  shop: {
    title: 'Hangar',
    icon: '🛸',
    skinLabel: 'Fighters',
    upgrades: [
      upgrade('lives', 'Extra hull', '❤️', 'Start with one more life per level', 2, 200),
      upgrade('guns', 'Twin cannons', '🔫', 'Start with a stronger gun (never drops below)', 2, 250),
      upgrade('rapid', 'Rapid fire', '⚡', '7% faster fire rate per level', 4, 90),
      upgrade('shield', 'Starting shield', '🛡️', 'Launch with a shield up', 1, 150),
    ],
    skins: [
      skin('falcon', 'Falcon', 0, ['#e2e8f0', '#38bdf8', '#fb923c'], { icon: '✈️' }),
      skin('viper', 'Viper', 200, ['#22c55e', '#fef08a', '#a3e635'], { icon: '🐍' }),
      skin('nova', 'Nova', 350, ['#f472b6', '#fdf4ff', '#c084fc'], { icon: '💫' }),
      skin('phantom', 'Phantom', 600, ['#475569', '#f43f5e', '#ef4444'], { icon: '👻' }),
      skin('sol', 'Sol Guardian', 0, ['#fbbf24', '#7c2d12', '#fde047'], { icon: '☀️', adUnlock: 3 }),
    ],
  },
});
