import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'orbit-jump',
  title: 'Orbit Jump',
  tagline: 'Slingshot from planet to planet. Time your launch.',
  description:
    'Your little rocket circles a planet. Tap to launch straight out of orbit and get caught by the next world’s gravity. Miss, or clip an asteroid, and you drift into deep space. How far can you hop across the galaxy?',
  howToPlay: [
    'Tap (or Space) to launch outward from your orbit.',
    'Aim for the next planet — its gravity catches you when you get close.',
    'Avoid asteroids and don’t drift off-screen.',
  ],
  categories: ['hyper-casual', 'arcade', 'reflex'],
  tags: ['space', 'planets', 'orbit', 'timing', 'one tap'],
  difficulty: 'easy',
  controls: { desktop: 'Space / click to launch', touch: 'Tap to launch' },
  score: { label: 'Planets', format: 'points' },
  medals: { bronze: 20, silver: 50, gold: 100 },
  theme: { from: '#1d4ed8', to: '#020617', accent: '#60a5fa' },
  sessionLength: '30s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 83,
  addedAt: '2026-09-26',
  shop: {
    title: 'Hangar',
    icon: '🛸',
    skinLabel: 'Rockets',
    upgrades: [
      upgrade('gravity', 'Gravity well', '🌀', 'Planets catch you from further away', 4, 90),
      upgrade('guide', 'Aim guide', '🎯', 'Shows your launch path (longer each level)', 3, 110),
      upgrade('shield', 'Deflector', '🛡️', 'Survive one asteroid per level', 2, 220, 2.2),
      upgrade('magnet', 'Coin magnet', '🧲', 'Pulls in nearby coins', 3, 70),
    ],
    skins: [
      skin('scout', 'Scout', 0, ['#f8fafc', '#ef4444', '#60a5fa'], { icon: '🚀' }),
      skin('ufo', 'Saucer', 300, ['#a3e635', '#3f6212', '#f0abfc'], { icon: '🛸' }),
      skin('comet', 'Comet', 500, ['#fb923c', '#7c2d12', '#fde68a'], { icon: '☄️' }),
      skin('stealth', 'Stealth', 800, ['#334155', '#0f172a', '#22d3ee'], { icon: '🛰️' }),
      skin('star', 'Star Cruiser', 0, ['#fde047', '#a16207', '#fef9c3'], { icon: '⭐', adUnlock: 3 }),
    ],
  },
});
