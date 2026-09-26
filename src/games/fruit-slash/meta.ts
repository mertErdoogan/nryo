import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'fruit-slash',
  title: 'Fruit Slash',
  tagline: 'Swipe to slice flying fruit. Never touch the bombs.',
  description:
    'Fruit flies up from below — swipe through it to slice. Cut several with one swipe for combos, grab golden fruit for coins and slow-mo bananas for a breather. Miss three fruits or slice a bomb and it’s over.',
  howToPlay: [
    'Swipe (drag) across fruit to slice it.',
    'Slice several in one swipe for a combo bonus.',
    'Don’t let fruit fall — and never slice a bomb!',
  ],
  categories: ['reflex', 'arcade', 'hyper-casual'],
  tags: ['fruit', 'slice', 'swipe', 'ninja', 'combo'],
  difficulty: 'easy',
  controls: { desktop: 'Drag the mouse to slice', touch: 'Swipe to slice' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 100, silver: 250, gold: 500 },
  theme: { from: '#16a34a', to: '#7c2d12', accent: '#facc15' },
  sessionLength: '1–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 90,
  addedAt: '2026-09-26',
  shop: {
    title: 'Blade Shop',
    icon: '🗡️',
    skinLabel: 'Blades',
    upgrades: [
      upgrade('blade', 'Wide blade', '🗡️', '+25% cutting width per level', 4, 80),
      upgrade('life', 'Extra life', '❤️', '+1 life per level', 2, 250, 2.2),
      upgrade('frenzy', 'Slow-mo banana', '🍌', 'More slow-motion bananas', 3, 100),
      upgrade('lucky', 'Golden fruit', '🍀', 'More golden (coin) fruit', 4, 70),
    ],
    skins: [
      skin('steel', 'Steel', 0, ['#f8fafc', '#94a3b8', '#e2e8f0'], { icon: '🔪' }),
      skin('flame', 'Flame', 250, ['#fb923c', '#dc2626', '#fde047'], { icon: '🔥' }),
      skin('ice', 'Ice', 400, ['#67e8f9', '#0284c7', '#ecfeff'], { icon: '🧊' }),
      skin('venom', 'Venom', 700, ['#a3e635', '#15803d', '#ecfccb'], { icon: '🐍' }),
      skin('rainbow', 'Rainbow', 0, ['#f472b6', '#8b5cf6', '#facc15'], { icon: '🌈', adUnlock: 3 }),
    ],
  },
});
