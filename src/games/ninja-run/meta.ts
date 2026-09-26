import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'ninja-run',
  title: 'Ninja Run',
  tagline: 'Leap across rooftops at night. Mind the gaps and the spikes.',
  description:
    'An endless rooftop runner. Your ninja sprints across the city skyline — tap to jump, tap again to double jump, and clear gaps, spikes, crates and patrol drones. Unlock extra jumps, gliding and new outfits.',
  howToPlay: [
    'Tap (or Space/↑) to jump; tap again in the air to double jump.',
    'Hold longer for a higher jump. Land on crates, avoid spikes and drones.',
    'Falling between buildings ends the run.',
  ],
  categories: ['endless', 'action', 'arcade'],
  tags: ['runner', 'ninja', 'platformer', 'jump', 'rooftops'],
  difficulty: 'medium',
  controls: { desktop: 'Space / ↑ / click to jump', touch: 'Tap to jump, tap again to double jump' },
  score: { label: 'Meters', format: 'points' },
  medals: { bronze: 600, silver: 1500, gold: 3200 },
  theme: { from: '#1e293b', to: '#7c3aed', accent: '#a78bfa' },
  sessionLength: '30s–3 min',
  orientation: 'any',
  realtime: true,
  popularity: 86,
  addedAt: '2026-09-26',
  shop: {
    title: 'Dojo',
    icon: '🥷',
    skinLabel: 'Outfits',
    upgrades: [
      upgrade('jumps', 'Extra jump', '🦘', '+1 jump in the air per level', 2, 250, 2.4),
      upgrade('glide', 'Glider cape', '🪂', 'Hold in the air to glide (longer per level)', 3, 120),
      upgrade('shield', 'Iron vest', '🛡️', 'Survive one hit per run (per level)', 2, 200, 2.2),
      upgrade('magnet', 'Coin magnet', '🧲', 'Pulls in nearby coins', 4, 70),
    ],
    skins: [
      skin('shadow', 'Shadow', 0, ['#475569', '#dc2626', '#f8fafc'], { icon: '🥷' }),
      skin('crimson', 'Crimson', 300, ['#991b1b', '#fbbf24', '#fef2f2'], { icon: '🔴' }),
      skin('jade', 'Jade', 500, ['#047857', '#fde047', '#ecfdf5'], { icon: '🟢' }),
      skin('storm', 'Storm', 800, ['#1d4ed8', '#e0f2fe', '#f8fafc'], { icon: '⚡' }),
      skin('sakura', 'Sakura', 0, ['#f9a8d4', '#831843', '#fff1f2'], { icon: '🌸', adUnlock: 3 }),
    ],
  },
});
