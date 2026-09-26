import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'boss-rush',
  title: 'Boss Rush',
  tagline: 'Nothing but bosses. Weave through bullet storms.',
  description:
    'A bullet-hell gauntlet of giant bosses, one after another. Slide your ship through spirals, bursts and aimed volleys while your blasters fire nonstop. Bombs clear the screen in a pinch. Upgrade your ship to go further.',
  howToPlay: [
    'Drag (or WASD/arrows) to move — only the glowing core of your ship can be hit.',
    'Your blasters fire automatically. Tap BOMB (or B) to clear bullets.',
    'Beat each boss to face a tougher one.',
  ],
  categories: ['action', 'arcade', 'reflex'],
  tags: ['shmup', 'bullet hell', 'boss', 'space', 'shooter'],
  difficulty: 'hard',
  controls: { desktop: 'WASD / arrows or mouse drag · B for bomb', touch: 'Drag to move · tap BOMB' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 3000, silver: 9000, gold: 20000 },
  theme: { from: '#be123c', to: '#0f172a', accent: '#fb7185' },
  sessionLength: '1–5 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 84,
  addedAt: '2026-09-26',
  shop: {
    title: 'Hangar',
    icon: '🚀',
    skinLabel: 'Ships',
    upgrades: [
      upgrade('damage', 'Blasters', '💥', '+20% damage per level', 8, 80),
      upgrade('rate', 'Cooling', '⚡', '+10% fire rate per level', 6, 80),
      upgrade('hull', 'Hull', '❤️', '+1 hit point per level', 3, 160, 1.9),
      upgrade('bombs', 'Bomb bay', '💣', '+1 bomb per run per level', 3, 130),
    ],
    skins: [
      skin('falcon', 'Falcon', 0, ['#e2e8f0', '#3b82f6', '#93c5fd'], { icon: '🚀' }),
      skin('viper', 'Viper', 350, ['#22c55e', '#14532d', '#bbf7d0'], { icon: '🐍' }),
      skin('phoenix', 'Phoenix', 650, ['#f97316', '#7c2d12', '#fde68a'], { icon: '🔥' }),
      skin('shadow', 'Shadow', 1000, ['#475569', '#0f172a', '#c084fc'], { icon: '🌑' }),
      skin('nova', 'Nova', 0, ['#fbbf24', '#78350f', '#fef3c7'], { icon: '⭐', adUnlock: 4 }),
    ],
  },
});
