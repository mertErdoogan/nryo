import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'ball-blast',
  title: 'Ball Blast',
  tagline: 'Blast bouncing boulders to bits. Upgrade your cannon.',
  description:
    'Slide your cannon under giant bouncing boulders and shoot them down. Every boulder splits into smaller ones when it breaks — clear them all to finish the level. Spend coins on fire rate, damage and extra barrels.',
  howToPlay: [
    'Drag (or ←/→) to move the cannon. It fires automatically.',
    'Boulders split when destroyed. Don’t let one land on you!',
    'Collect dropped coins and upgrade between runs.',
  ],
  categories: ['arcade', 'action', 'hyper-casual'],
  tags: ['cannon', 'boulders', 'shooter', 'upgrade', 'split'],
  difficulty: 'easy',
  controls: { desktop: 'Mouse or ←/→ to move', touch: 'Drag left/right to move' },
  score: { label: 'Damage', format: 'points' },
  medals: { bronze: 2500, silver: 8000, gold: 20000 },
  theme: { from: '#0ea5e9', to: '#312e81', accent: '#38bdf8' },
  sessionLength: '1–4 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 91,
  addedAt: '2026-09-26',
  shop: {
    title: 'Armory',
    icon: '💥',
    skinLabel: 'Cannons',
    upgrades: [
      upgrade('rate', 'Fire rate', '⚡', '+12% shots per second per level', 8, 60),
      upgrade('damage', 'Firepower', '💥', '+20% damage per shot per level', 8, 70),
      upgrade('barrels', 'Extra barrel', '🔱', '+1 barrel (wider spread) per level', 2, 400, 2.5),
      upgrade('armor', 'Armor plate', '🛡️', 'Survive one hit per level each run', 2, 200, 2.2),
    ],
    skins: [
      skin('steel', 'Steel', 0, ['#94a3b8', '#334155', '#fde047'], { icon: '🔫' }),
      skin('fire', 'Fire Cannon', 300, ['#ef4444', '#7f1d1d', '#fb923c'], { icon: '🔥' }),
      skin('frost', 'Frost Cannon', 500, ['#38bdf8', '#0c4a6e', '#e0f2fe'], { icon: '❄️' }),
      skin('toxic', 'Toxic', 800, ['#84cc16', '#365314', '#d9f99d'], { icon: '☢️' }),
      skin('gold', 'Golden Gun', 0, ['#fbbf24', '#78350f', '#fef3c7'], { icon: '👑', adUnlock: 4 }),
    ],
  },
});
