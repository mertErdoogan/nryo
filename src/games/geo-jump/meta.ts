import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'geo-jump',
  title: 'Geo Jump',
  tagline: 'One tap. Spikes, blocks, jump pads — pure rhythm.',
  description:
    'A neon rhythm platformer. Your cube runs on its own; tap to jump over spikes, land on blocks and bounce off jump pads. Every section has a checkpoint, so a continue drops you right back into the action.',
  howToPlay: [
    'Tap or hold (Space/↑) to jump. Holding jumps again as soon as you land.',
    'Land on top of blocks; touching spikes or block sides ends the run.',
    'Yellow pads launch you high. Coins buy new icons.',
  ],
  categories: ['arcade', 'reflex', 'endless'],
  tags: ['geometry', 'cube', 'rhythm', 'spikes', 'platformer', 'neon'],
  difficulty: 'hard',
  controls: { desktop: 'Space / ↑ / click to jump', touch: 'Tap or hold to jump' },
  score: { label: 'Blocks', format: 'points' },
  medals: { bronze: 250, silver: 700, gold: 1500 },
  theme: { from: '#2563eb', to: '#db2777', accent: '#60a5fa' },
  sessionLength: '30s–3 min',
  orientation: 'any',
  realtime: true,
  popularity: 87,
  addedAt: '2026-09-26',
  shop: {
    title: 'Icon Kit',
    icon: '🟦',
    skinLabel: 'Icons',
    upgrades: [
      upgrade('shield', 'Force field', '🛡️', 'Survive one crash per level each run', 2, 220, 2.2),
      upgrade('magnet', 'Coin magnet', '🧲', 'Pulls in nearby coins', 3, 70),
      upgrade('lucky', 'Coin trail', '🍀', 'More coins in each section', 4, 60),
    ],
    skins: [
      skin('classic', 'Classic', 0, ['#facc15', '#16a34a', '#0f172a'], { icon: '🟨' }),
      skin('cool', 'Cool Blue', 200, ['#38bdf8', '#1e40af', '#0f172a'], { icon: '🟦' }),
      skin('angry', 'Angry Red', 400, ['#ef4444', '#450a0a', '#fef2f2'], { icon: '🟥' }),
      skin('robo', 'Robo', 700, ['#a3a3a3', '#404040', '#22d3ee'], { icon: '🤖' }),
      skin('void', 'Void', 1100, ['#111827', '#a855f7', '#f0abfc'], { icon: '⬛' }),
      skin('rainbow', 'Prism', 0, ['#f472b6', '#8b5cf6', '#fde047'], { icon: '🌈', adUnlock: 3 }),
    ],
  },
});
