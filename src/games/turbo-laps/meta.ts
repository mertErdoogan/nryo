import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'turbo-laps',
  title: 'Turbo Laps',
  tagline: 'Three laps. Three AI rivals. Your own ghost to beat.',
  description:
    'A top-down circuit race: out-drive three AI rivals over three laps and chase the ghost of your best run. Stay on the asphalt — the grass will slow you right down.',
  howToPlay: [
    'Your car accelerates by itself — just steer.',
    'Hold ◀ ▶ (or ←/→) to turn, ↓ to brake for tight corners.',
    'Finish first and beat your ghost’s time. Lower time is better.',
    'Podium finishes pay coins (10 / 5 / 2) for engine upgrades and new cars.',
  ],
  categories: ['racing', 'versus', 'arcade'],
  tags: ['race', 'cars', 'circuit', 'ghost', 'time trial', 'ai rivals'],
  difficulty: 'medium',
  controls: { desktop: '←/→ steer, ↓ brake', touch: 'Hold ◀ / ▶ buttons to steer' },
  score: { label: 'Race time', format: 'time', lowerIsBetter: true },
  medals: { bronze: 40000, silver: 35500, gold: 33000 },
  theme: { from: '#dc2626', to: '#1e3a8a', accent: '#f87171' },
  sessionLength: '35–60s',
  orientation: 'any',
  realtime: true,
  popularity: 83,
  addedAt: '2026-06-15',
  shop: {
    title: 'Pit Garage',
    icon: '🏎️',
    skinLabel: 'Cars',
    upgrades: [upgrade('engine', 'Engine tune', '⚙️', '+2.5% top speed per level', 5, 100)],
    skins: [
      skin('kart', 'Red Kart', 0, ['#ef4444', '#fecaca', '#111827'], { icon: '🏎️' }),
      skin('racer', 'Blue Racer', 200, ['#2563eb', '#f8fafc', '#111827'], { icon: '🚙' }),
      skin('lime', 'Lime Rocket', 300, ['#84cc16', '#111827', '#111827'], { icon: '🚀' }),
      skin('gt', 'Black GT', 600, ['#18181b', '#facc15', '#111827'], { icon: '🏁', perk: '+2% top speed' }),
      skin('gold', 'Gold Cup', 0, ['#f59e0b', '#fff7ed', '#111827'], { icon: '🏆', adUnlock: 3 }),
    ],
  },
});
