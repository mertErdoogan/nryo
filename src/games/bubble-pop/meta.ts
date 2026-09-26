import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'bubble-pop',
  title: 'Bubble Pop',
  tagline: 'Aim, bank off walls, pop three of a colour.',
  description:
    'The classic bubble shooter. Aim with your finger, bank shots off the walls and connect three or more bubbles of one colour to pop them. Cut bubbles loose and they all fall for bonus points. Miss too often and a new row pushes down.',
  howToPlay: [
    'Drag to aim, release to shoot (or ←/→ and Space). Tap the shooter to swap.',
    'Three or more of a colour pop. Anything left hanging drops.',
    'Don’t let the bubbles reach the bottom line.',
  ],
  categories: ['puzzle', 'arcade'],
  tags: ['bubble', 'shooter', 'match 3', 'colors', 'aim'],
  difficulty: 'easy',
  controls: { desktop: 'Mouse to aim and click, or ←/→ + Space', touch: 'Drag to aim, release to shoot' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1500, silver: 4500, gold: 10000 },
  theme: { from: '#06b6d4', to: '#7c3aed', accent: '#a5f3fc' },
  sessionLength: '2–6 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 88,
  addedAt: '2026-09-26',
  shop: {
    title: 'Bubble Shop',
    icon: '🫧',
    skinLabel: 'Bubble sets',
    upgrades: [
      upgrade('guide', 'Laser sight', '🎯', 'Longer aim guide with wall bounces', 3, 90),
      upgrade('bomb', 'Bomb bubbles', '💣', 'A bomb bubble every few shots', 3, 120),
      upgrade('rainbow', 'Rainbow bubbles', '🌈', 'A rainbow bubble that matches any colour', 3, 120),
    ],
    skins: [
      skin('classic', 'Classic', 0, ['#ef4444', '#3b82f6', '#22c55e'], { icon: '🔴' }),
      skin('candy', 'Candy', 250, ['#f472b6', '#a78bfa', '#34d399'], { icon: '🍬' }),
      skin('ocean', 'Ocean', 450, ['#06b6d4', '#0ea5e9', '#2dd4bf'], { icon: '🌊' }),
      skin('jewel', 'Jewels', 700, ['#be123c', '#1d4ed8', '#047857'], { icon: '💎' }),
      skin('glow', 'Glow', 0, ['#f0abfc', '#67e8f9', '#bef264'], { icon: '✨', adUnlock: 3 }),
    ],
  },
});
