import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'whack-attack',
  title: 'Whack Attack',
  tagline: 'Bonk the moles, dodge the bombs, chain the combo.',
  description:
    'Moles pop up faster and faster — whack them before they duck back down. Golden moles are worth a fortune, bombs cost you points and time. Keep a streak going for multipliers.',
  howToPlay: [
    'Tap moles as they pop up. Golden moles give +50.',
    'Never hit a bomb — it costs points and 2 seconds.',
    'Consecutive hits raise your combo multiplier.',
  ],
  categories: ['reflex', 'arcade', 'hyper-casual'],
  tags: ['whack a mole', 'tap', 'speed', 'combo', 'timed'],
  difficulty: 'easy',
  controls: { desktop: 'Click moles or use keys 1–9', touch: 'Tap the moles' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 400, silver: 900, gold: 1500 },
  theme: { from: '#65a30d', to: '#78350f', accent: '#a3e635' },
  sessionLength: '40s',
  orientation: 'any',
  realtime: true,
  popularity: 79,
  addedAt: '2026-06-05',
  shop: {
    title: 'Tool Shed',
    icon: '🔨',
    upgrades: [
      upgrade('time', 'Longer round', '⏱️', '+3 seconds per level', 5, 70),
      upgrade('golden', 'Gold rush', '⭐', 'Golden moles (1 coin) appear more often', 3, 100),
      upgrade('armor', 'Bomb gloves', '🧤', 'Bombs cost only 1 second', 1, 150),
    ],
    skins: [skin('classic', 'Classic', 0, ['#a16207', '#fde047', '#ef4444'])],
  },
});
