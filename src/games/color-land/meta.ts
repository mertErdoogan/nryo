import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'color-land',
  title: 'Color Land',
  tagline: 'Draw loops to claim land. Cut the bots’ tails.',
  description:
    'Leave your territory to draw a trail, then come back to claim everything inside the loop. Bots are painting too — cross their trail to knock them out, but if anyone crosses yours while you’re outside, you’re done.',
  howToPlay: [
    'Swipe (or use arrow keys) to steer your square.',
    'Leave your land and return to claim the area you circled.',
    'Touching your own trail — or a bot touching it — ends the run.',
  ],
  categories: ['strategy', 'versus', 'arcade'],
  tags: ['paper', 'territory', 'io', 'loop', 'claim', 'bots'],
  difficulty: 'medium',
  controls: { desktop: 'Arrow keys / WASD to steer', touch: 'Swipe to steer' },
  score: { label: 'Tiles', format: 'points' },
  medals: { bronze: 250, silver: 600, gold: 1200 },
  theme: { from: '#06b6d4', to: '#4f46e5', accent: '#67e8f9' },
  sessionLength: '1–4 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 86,
  addedAt: '2026-09-26',
  shop: {
    title: 'Paint Shop',
    icon: '🎨',
    skinLabel: 'Colours',
    upgrades: [
      upgrade('speed', 'Speed', '💨', '+6% speed per level', 4, 80),
      upgrade('land', 'Bigger base', '🟦', 'Start with more land', 2, 200, 2),
      upgrade('shield', 'Trail guard', '🛡️', 'Survive one cut per level each run', 2, 240, 2.2),
    ],
    skins: [
      skin('cyan', 'Cyan', 0, ['#06b6d4', '#0e7490', '#cffafe'], { icon: '🟦' }),
      skin('lime', 'Lime', 250, ['#84cc16', '#3f6212', '#ecfccb'], { icon: '🟩' }),
      skin('rose', 'Rose', 400, ['#f43f5e', '#9f1239', '#ffe4e6'], { icon: '🟥' }),
      skin('amber', 'Amber', 600, ['#f59e0b', '#92400e', '#fef3c7'], { icon: '🟧' }),
      skin('violet', 'Violet', 0, ['#8b5cf6', '#4c1d95', '#ede9fe'], { icon: '🟪', adUnlock: 3 }),
    ],
  },
});
