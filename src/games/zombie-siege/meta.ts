import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'zombie-siege',
  title: 'Zombie Siege',
  tagline: 'Hold the barricade. Buy bigger guns. Survive the night.',
  description:
    'Cartoon zombies shamble toward your barricade in growing waves. Your gun auto-targets the closest threat; tap anywhere to lob grenades into the crowd. Earn coins to unlock the SMG, shotgun and rifle, and upgrade damage, fire rate and the barricade.',
  howToPlay: [
    'Your gun fires at the nearest zombie automatically.',
    'Tap (or click) to throw a grenade — it recharges.',
    'If the barricade falls, the night is over. Buy new weapons in the armory.',
  ],
  categories: ['action', 'strategy', 'arcade'],
  tags: ['zombies', 'defense', 'shooter', 'weapons', 'waves', 'upgrade'],
  difficulty: 'medium',
  controls: { desktop: 'Click to throw grenades (Space = at the crowd)', touch: 'Tap to throw grenades' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1200, silver: 3500, gold: 8000 },
  theme: { from: '#15803d', to: '#1c1917', accent: '#86efac' },
  sessionLength: '2–6 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 89,
  addedAt: '2026-09-26',
  shop: {
    title: 'Armory',
    icon: '🔫',
    skinLabel: 'Weapons',
    upgrades: [
      upgrade('damage', 'Hollow points', '💥', '+15% bullet damage per level', 8, 70),
      upgrade('rate', 'Trigger job', '⚡', '+10% fire rate per level', 8, 70),
      upgrade('wall', 'Barricade', '🧱', '+25% barricade HP per level', 6, 60),
      upgrade('grenade', 'Grenades', '💣', 'Faster recharge and bigger blast', 5, 90),
    ],
    skins: [
      skin('pistol', 'Pistol', 0, ['#9ca3af', '#374151', '#fde047'], { icon: '🔫', perk: 'Reliable' }),
      skin('smg', 'SMG', 450, ['#475569', '#0f172a', '#fb923c'], { icon: '💨', perk: 'Very fast fire' }),
      skin('shotgun', 'Shotgun', 900, ['#92400e', '#451a03', '#fcd34d'], {
        icon: '💥',
        perk: '6-pellet spread',
      }),
      skin('rifle', 'Battle Rifle', 1600, ['#3f6212', '#1a2e05', '#d9f99d'], {
        icon: '🎯',
        perk: 'Heavy, pierces 2',
      }),
      skin('laser', 'Laser Blaster', 0, ['#22d3ee', '#164e63', '#f0abfc'], {
        icon: '⚡',
        perk: 'Fast & piercing',
        adUnlock: 5,
      }),
    ],
  },
});
