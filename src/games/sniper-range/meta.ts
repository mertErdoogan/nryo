import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'sniper-range',
  title: 'Sniper Range',
  tagline: 'Steady your scope. Hit the bullseye. Beat the clock.',
  description:
    'A precision shooting range. Press and hold to raise your scope, line up the crosshair against the sway, and release to fire. Targets pop up near and far — hit red ones, gold ones pay coins, never hit the blue friendlies.',
  howToPlay: [
    'Press and hold to aim through the scope; release to fire.',
    'Closer to the bullseye = more points. Gold targets drop coins.',
    'Don’t shoot blue targets. Reload when the magazine runs dry.',
  ],
  categories: ['action', 'reflex', 'arcade'],
  tags: ['sniper', 'shooting', 'aim', 'scope', 'targets', 'rifle'],
  difficulty: 'medium',
  controls: { desktop: 'Hold mouse to aim, release to fire', touch: 'Hold to aim, release to fire' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 2500, silver: 6000, gold: 11000 },
  theme: { from: '#a16207', to: '#1c1917', accent: '#fcd34d' },
  sessionLength: '1–2 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 85,
  addedAt: '2026-09-26',
  shop: {
    title: 'Gun Shop',
    icon: '🎯',
    skinLabel: 'Rifles',
    upgrades: [
      upgrade('steady', 'Stabiliser', '🫳', '−15% scope sway per level', 5, 80),
      upgrade('zoom', 'Scope zoom', '🔭', '+0.5× magnification per level', 3, 110),
      upgrade('mag', 'Extended mag', '📦', '+2 rounds per magazine per level', 3, 90),
      upgrade('reload', 'Speed loader', '⚡', '−15% reload time per level', 4, 70),
    ],
    skins: [
      skin('hunter', 'Hunter', 0, ['#78350f', '#1c1917', '#a8a29e'], { icon: '🎯' }),
      skin('marksman', 'Marksman', 500, ['#374151', '#111827', '#22d3ee'], { icon: '🔭', perk: '−20% sway' }),
      skin('tactical', 'Tactical', 900, ['#3f6212', '#1a2e05', '#d9f99d'], { icon: '🪖', perk: '+2 rounds' }),
      skin('arctic', 'Arctic', 1300, ['#e2e8f0', '#475569', '#7dd3fc'], {
        icon: '❄️',
        perk: '−20% sway, faster reload',
      }),
      skin('gold', 'Golden Rifle', 0, ['#fbbf24', '#78350f', '#fef3c7'], {
        icon: '👑',
        perk: '+10% points',
        adUnlock: 4,
      }),
    ],
  },
});
