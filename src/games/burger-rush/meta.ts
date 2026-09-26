import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'burger-rush',
  title: 'Burger Rush',
  tagline: 'Grill, stack, serve. Keep the hungry line happy.',
  description:
    'Run a busy burger stand. Grill patties (don’t burn them!), stack each order exactly as the customer asked and serve before their patience runs out. Faster service earns bigger tips — spend them on a faster grill and a bigger kitchen.',
  howToPlay: [
    'Tap 🥩 to grill a patty, then tap it when it’s cooked to add it to the burger.',
    'Stack ingredients bottom to top exactly like the order, then tap the customer to serve.',
    'Lose three customers and the shift is over.',
  ],
  categories: ['strategy', 'reflex', 'arcade'],
  tags: ['cooking', 'burger', 'time management', 'restaurant', 'orders'],
  difficulty: 'medium',
  controls: { desktop: 'Click ingredients and customers', touch: 'Tap ingredients and customers' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 800, silver: 2200, gold: 5000 },
  theme: { from: '#f97316', to: '#7c2d12', accent: '#fde68a' },
  sessionLength: '2–6 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 86,
  addedAt: '2026-09-26',
  shop: {
    title: 'Kitchen',
    icon: '🍔',
    skinLabel: 'Restaurant themes',
    upgrades: [
      upgrade('grill', 'Hot grill', '🔥', 'Patties cook 15% faster per level', 4, 80),
      upgrade('slot', 'Bigger grill', '♨️', '+1 grill slot', 2, 250, 2),
      upgrade('patience', 'Comfy seats', '🪑', '+15% customer patience per level', 4, 80),
      upgrade('tips', 'Tip jar', '💰', '+20% tips per level', 4, 90),
    ],
    skins: [
      skin('diner', 'Retro Diner', 0, ['#ef4444', '#fef3c7', '#1e293b'], { icon: '🍔' }),
      skin('beach', 'Beach Shack', 300, ['#06b6d4', '#fef9c3', '#0c4a6e'], { icon: '🏖️' }),
      skin('neon', 'Neon Grill', 500, ['#a855f7', '#1e1b4b', '#f0abfc'], { icon: '🌃' }),
      skin('garden', 'Garden Café', 750, ['#16a34a', '#ecfccb', '#14532d'], { icon: '🌿' }),
      skin('gold', 'Five Star', 0, ['#d97706', '#fffbeb', '#451a03'], { icon: '⭐', adUnlock: 3 }),
    ],
  },
});
