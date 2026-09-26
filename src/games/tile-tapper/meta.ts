import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'tile-tapper',
  title: 'Tile Tapper',
  tagline: 'Tap the dark tiles in rhythm. Never touch white.',
  description:
    'A fast rhythm-reflex game: dark tiles stream down four lanes and each one plays a note. Tap every dark tile before it slips away — and never tap the empty lanes.',
  howToPlay: [
    'Tap each dark tile as it scrolls down.',
    'Tapping a white space or missing a tile ends the run.',
    'It speeds up the further you go.',
  ],
  categories: ['reflex', 'hyper-casual', 'endless'],
  tags: ['piano', 'rhythm', 'music', 'tiles', 'tap'],
  difficulty: 'medium',
  controls: { desktop: 'Click tiles or keys D F J K', touch: 'Tap the dark tiles' },
  score: { label: 'Tiles', format: 'points' },
  medals: { bronze: 40, silver: 100, gold: 180 },
  theme: { from: '#0f172a', to: '#475569', accent: '#e2e8f0' },
  sessionLength: '20s–2 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 81,
  addedAt: '2026-06-06',
  shop: {
    title: 'Music Shop',
    icon: '🎹',
    skinLabel: 'Tiles',
    upgrades: [
      upgrade('tempo', 'Easy tempo', '🎼', 'Tiles scroll 4% slower per level', 3, 100),
      upgrade('forgive', 'Safety net', '🛟', 'Forgive one wrong tap per level each run', 3, 120),
    ],
    skins: [
      skin('ebony', 'Ebony', 0, ['#1e293b', '#020617', '#94a3b8'], { icon: '🎹' }),
      skin('ocean', 'Deep Sea', 150, ['#0e7490', '#082f49', '#67e8f9'], { icon: '🌊' }),
      skin('berry', 'Berry', 200, ['#86198f', '#3b0764', '#f0abfc'], { icon: '🫐' }),
      skin('forest', 'Forest', 200, ['#166534', '#052e16', '#86efac'], { icon: '🌲' }),
      skin('gold', 'Golden Keys', 0, ['#b45309', '#451a03', '#fde047'], { icon: '🏆', adUnlock: 3 }),
    ],
  },
});
