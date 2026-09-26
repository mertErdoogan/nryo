import { defineMeta } from '../define';

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
});
