import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'ball-sort',
  title: 'Ball Sort',
  tagline: 'Sort the coloured balls into tubes. Calm, clever, addictive.',
  description:
    'Tap a tube to pick up its top ball, then tap another tube to drop it — only onto the same colour or into an empty tube. Fill every tube with a single colour to solve the level. Solve fast to earn more time.',
  howToPlay: [
    'Tap a tube, then tap where the top ball should go.',
    'Balls only stack on the same colour or in an empty tube.',
    'Each solved level adds time. Stuck? Undo, get a hint or an extra tube.',
  ],
  categories: ['puzzle', 'brain'],
  tags: ['sort', 'colors', 'tubes', 'relaxing', 'logic'],
  difficulty: 'easy',
  controls: { desktop: 'Click tubes (or press 1–9)', touch: 'Tap tubes' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 600, silver: 1600, gold: 3500 },
  theme: { from: '#ec4899', to: '#4338ca', accent: '#f9a8d4' },
  sessionLength: '2–6 min',
  orientation: 'portrait',
  realtime: false,
  popularity: 87,
  addedAt: '2026-09-26',
  shop: {
    title: 'Ball Shop',
    icon: '🧪',
    skinLabel: 'Ball sets',
    upgrades: [
      upgrade('undo', 'Undo pack', '↩️', '+2 undos per level', 3, 80),
      upgrade('time', 'Extra time', '⏱️', '+20 s on the starting clock per level', 4, 70),
      upgrade('hint', 'Free hints', '💡', '+1 free hint per run per level', 3, 110),
    ],
    skins: [
      skin('classic', 'Classic', 0, ['#ef4444', '#3b82f6', '#22c55e'], { icon: '🔴' }),
      skin('pastel', 'Pastel', 250, ['#fda4af', '#a5b4fc', '#86efac'], { icon: '🍬' }),
      skin('neon', 'Neon', 450, ['#f0abfc', '#67e8f9', '#bef264'], { icon: '💡' }),
      skin('gems', 'Gems', 750, ['#be123c', '#1d4ed8', '#047857'], { icon: '💎' }),
      skin('planets', 'Planets', 0, ['#f97316', '#0ea5e9', '#a3e635'], { icon: '🪐', adUnlock: 3 }),
    ],
  },
});
