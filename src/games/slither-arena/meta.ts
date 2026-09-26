import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'slither-arena',
  title: 'Slither Arena',
  tagline: 'Grow the longest snake in an arena full of AI rivals.',
  description:
    'An arena brawl of glowing snakes. Eat orbs to grow, boost to cut off AI rivals and make them crash into you — then feast on what they leave behind. Touch another snake’s body and it’s over.',
  howToPlay: [
    'Point (mouse or finger) where you want to slither.',
    'Hold to boost — it costs length but can trap rivals.',
    'Your head must never touch another snake’s body or the wall.',
  ],
  categories: ['action', 'versus', 'endless'],
  tags: ['snake', 'io', 'arena', 'multiplayer-style', 'bots', 'grow'],
  difficulty: 'medium',
  controls: {
    desktop: 'Mouse to steer, hold click or Space to boost',
    touch: 'Drag to steer, hold ⚡ to boost',
  },
  score: { label: 'Length', format: 'points' },
  medals: { bronze: 150, silver: 400, gold: 900 },
  theme: { from: '#7c3aed', to: '#0f172a', accent: '#c084fc' },
  sessionLength: '1–5 min',
  orientation: 'any',
  realtime: true,
  popularity: 88,
  addedAt: '2026-06-16',
  shop: {
    title: 'Snake Pit',
    icon: '🐍',
    skinLabel: 'Skins',
    upgrades: [
      upgrade('start', 'Head start', '📏', '+10 starting length per level', 4, 80),
      upgrade('speed', 'Slither speed', '💨', '+5% cruise and boost speed per level', 3, 110),
      upgrade('boost', 'Efficient boost', '⚡', 'Boosting burns 15% less length per level', 3, 90),
      upgrade('magnet', 'Big mouth', '🧲', 'Eat orbs from further away', 3, 70),
    ],
    skins: [
      skin('violet', 'Violet', 0, ['#8b5cf6', '#c4b5fd', '#6d28d9'], { icon: '🟣' }),
      skin('lime', 'Lime', 120, ['#84cc16', '#d9f99d', '#4d7c0f'], { icon: '🟢' }),
      skin('ocean', 'Ocean', 120, ['#0ea5e9', '#bae6fd', '#0369a1'], { icon: '🔵' }),
      skin('ember', 'Ember', 250, ['#f97316', '#fed7aa', '#c2410c'], { icon: '🟠' }),
      skin('rose', 'Rose', 250, ['#f43f5e', '#fecdd3', '#be123c'], { icon: '🌹' }),
      skin('rainbow', 'Rainbow', 0, ['#ef4444', '#22c55e', '#3b82f6'], { icon: '🌈', adUnlock: 3 }),
    ],
  },
});
