import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'drag-race',
  title: 'Drag Race Tycoon',
  tagline: 'Nail the launch, hit perfect shifts, buy faster cars.',
  description:
    'Quarter-mile duels against a ladder of bot racers. Launch on green, shift in the green zone and fire nitro at the right moment. Win coins, tune your engine and buy faster cars to climb the ladder.',
  howToPlay: [
    'Tap GO (or Space) the moment the light turns green — not before!',
    'Shift when the needle is in the green zone for a perfect shift.',
    'Beat each bot to face a faster one. Faster cars live in the garage.',
  ],
  categories: ['racing', 'reflex', 'versus'],
  tags: ['cars', 'drag', 'shift', 'nitro', 'garage', 'tuning'],
  difficulty: 'medium',
  controls: { desktop: 'Space / ↑ to launch and shift · N for nitro', touch: 'Tap SHIFT · tap NITRO' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 500, silver: 1500, gold: 3000 },
  theme: { from: '#dc2626', to: '#111827', accent: '#f87171' },
  sessionLength: '1–5 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 88,
  addedAt: '2026-09-26',
  shop: {
    title: 'Garage',
    icon: '🏁',
    skinLabel: 'Cars (faster cars = more power)',
    upgrades: [
      upgrade('engine', 'Engine tune', '⚙️', '+6% power per level', 6, 80),
      upgrade('gearbox', 'Gearbox', '🕹️', 'Wider perfect-shift zone', 4, 90),
      upgrade('tires', 'Drag slicks', '🛞', 'Less wheelspin off the line', 4, 70),
      upgrade('nitro', 'Nitro kit', '🔥', 'Unlocks nitro; longer burn each level', 4, 120),
    ],
    skins: [
      skin('street', 'Street Hatch', 0, ['#e5e7eb', '#475569', '#93c5fd'], { icon: '🚗' }),
      skin('muscle', 'Muscle V8', 400, ['#dc2626', '#1f2937', '#fca5a5'], { icon: '🏎️', perk: '+5% power' }),
      skin('tuner', 'Street Tuner', 900, ['#22d3ee', '#1e3a8a', '#a5f3fc'], {
        icon: '🚙',
        perk: '+10% power',
      }),
      skin('super', 'Supercar', 1800, ['#f59e0b', '#111827', '#fde68a'], { icon: '🏎️', perk: '+16% power' }),
      skin('hyper', 'Hypercar', 3500, ['#a855f7', '#0f172a', '#e9d5ff'], { icon: '🚀', perk: '+24% power' }),
      skin('gold', 'Gold Edition', 0, ['#fbbf24', '#78350f', '#fef3c7'], {
        icon: '👑',
        perk: '+10% power',
        adUnlock: 4,
      }),
    ],
  },
});
