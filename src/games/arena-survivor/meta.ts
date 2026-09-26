import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'arena-survivor',
  title: 'Arena Survivor',
  tagline: 'Survive the swarm. Level up. Build an unstoppable hero.',
  description:
    'A top-down survival shooter. Your hero fires automatically — you focus on moving. Collect crystals to level up and pick powerful upgrades as ever-larger waves of monsters close in.',
  howToPlay: [
    'Move with WASD / arrows, or drag anywhere to use the joystick.',
    'You shoot the nearest enemy automatically.',
    'Grab blue crystals to level up and choose an upgrade.',
    'Bosses and kill streaks pay coins — buy permanent power in the Armory.',
  ],
  categories: ['action', 'endless', 'strategy'],
  tags: ['shooter', 'survivor', 'roguelite', 'upgrades', 'waves', 'shoot'],
  difficulty: 'medium',
  controls: { desktop: 'WASD / arrows to move (or drag)', touch: 'Drag anywhere to move' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1500, silver: 4000, gold: 8000 },
  theme: { from: '#b91c1c', to: '#111827', accent: '#f87171' },
  sessionLength: '2–8 min',
  orientation: 'any',
  realtime: true,
  popularity: 91,
  addedAt: '2026-06-17',
  shop: {
    title: 'Armory',
    icon: '⚔️',
    skinLabel: 'Heroes',
    upgrades: [
      upgrade('damage', 'Sharpened rounds', '💥', '+8% starting damage per level', 5, 90),
      upgrade('vitality', 'Vitality', '❤️', '+15 max HP per level', 5, 80),
      upgrade('boots', 'Swift boots', '👟', '+5% move speed per level', 4, 70),
      upgrade('magnet', 'XP magnet', '🧲', 'Pick up XP gems from further away', 3, 60),
      upgrade('regen', 'Regeneration', '🩹', 'Heal 0.4 HP per second per level', 3, 140),
    ],
    skins: [
      skin('ranger', 'Ranger', 0, ['#3b82f6', '#bfdbfe', '#1e3a8a'], { icon: '🔵' }),
      skin('crimson', 'Crimson Guard', 200, ['#dc2626', '#fecaca', '#450a0a'], { icon: '🔴' }),
      skin('jade', 'Jade Monk', 300, ['#059669', '#a7f3d0', '#064e3b'], { icon: '🟢' }),
      skin('shadow', 'Shadow', 500, ['#312e81', '#a5b4fc', '#f472b6'], { icon: '🟣' }),
      skin('paladin', 'Golden Paladin', 0, ['#f59e0b', '#fef3c7', '#78350f'], { icon: '🟡', adUnlock: 3 }),
    ],
  },
});
