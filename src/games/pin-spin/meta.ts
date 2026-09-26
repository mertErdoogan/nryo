import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'pin-spin',
  title: 'Pin Spin',
  tagline: 'Throw pins into the spinning target — never hit another pin.',
  description:
    'Launch every pin into the rotating target without striking the pins already stuck in it. Each level spins faster and weirder; grab gems on the rim for bonus points.',
  howToPlay: [
    'Tap to throw a pin into the spinning target.',
    'Hitting a pin that is already stuck ends the game.',
    'Throw all pins to clear the level. Gems on the rim are worth +3.',
    'Gems are coins; hit a pin and you can continue by retrying the throw.',
  ],
  categories: ['hyper-casual', 'reflex'],
  tags: ['timing', 'one-tap', 'knife', 'target', 'levels'],
  difficulty: 'medium',
  controls: { desktop: 'Click or Space to throw', touch: 'Tap to throw' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 30, silver: 80, gold: 150 },
  theme: { from: '#7c3aed', to: '#0f172a', accent: '#a78bfa' },
  sessionLength: '30s–3 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 88,
  addedAt: '2026-06-02',
  shop: {
    title: 'Pin Shop',
    icon: '📌',
    skinLabel: 'Pins',
    upgrades: [
      upgrade('slow', 'Slow spin', '🐢', 'Targets spin 5% slower per level', 3, 100),
      upgrade('thin', 'Thin needles', '🪡', 'Pins can land 10% closer together per level', 3, 120),
      upgrade('gems', 'Gem hunter', '💎', 'Easier to hit gems', 3, 70),
    ],
    skins: [
      skin('classic', 'Lavender', 0, ['#f5f3ff', '#c084fc', '#a78bfa'], { icon: '📌' }),
      skin('ruby', 'Ruby', 120, ['#fecdd3', '#e11d48', '#fb7185'], { icon: '❤️' }),
      skin('emerald', 'Emerald', 200, ['#d1fae5', '#059669', '#34d399'], { icon: '💚' }),
      skin('sapphire', 'Sapphire', 300, ['#dbeafe', '#2563eb', '#60a5fa'], { icon: '💙' }),
      skin('gold', 'Golden', 0, ['#fef3c7', '#f59e0b', '#fbbf24'], { icon: '🏆', adUnlock: 3 }),
    ],
  },
});
