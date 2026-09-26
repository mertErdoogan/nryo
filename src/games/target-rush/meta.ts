import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'target-rush',
  title: 'Target Rush',
  tagline: 'Pop targets before they vanish. Bullseyes pay double.',
  description:
    'An aim-and-reflex shooter: targets bloom and shrink all over the screen. Hit them before they disappear, aim for the center for bonus points, and never shoot the red decoys.',
  howToPlay: [
    'Tap targets before they shrink away.',
    'Center hits score more. Gold targets are worth +50.',
    'Letting a target escape or hitting a red decoy costs a life.',
  ],
  categories: ['reflex', 'action'],
  tags: ['aim', 'shooting', 'targets', 'accuracy', 'clicker'],
  difficulty: 'medium',
  controls: { desktop: 'Click targets', touch: 'Tap targets' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 800, silver: 2000, gold: 3500 },
  theme: { from: '#dc2626', to: '#1f2937', accent: '#fca5a5' },
  sessionLength: '30s–2 min',
  orientation: 'any',
  realtime: true,
  popularity: 76,
  addedAt: '2026-06-09',
  shop: {
    title: 'Range Shop',
    icon: '🎯',
    skinLabel: 'Targets',
    upgrades: [
      upgrade('lives', 'Extra heart', '❤️', 'One more heart per level', 2, 150),
      upgrade('slow', 'Patient targets', '⏳', 'Targets stay up 8% longer per level', 3, 90),
      upgrade('size', 'Big targets', '🔍', 'Targets are 6% bigger per level', 3, 80),
    ],
    skins: [
      skin('classic', 'Classic', 0, ['#f8fafc', '#ef4444', '#fde047']),
      skin('ocean', 'Ocean', 120, ['#e0f2fe', '#0284c7', '#fde047'], { icon: '🔵' }),
      skin('toxic', 'Toxic', 200, ['#ecfccb', '#65a30d', '#fde047'], { icon: '🟢' }),
      skin('royal', 'Royal', 300, ['#f3e8ff', '#7e22ce', '#fde047'], { icon: '🟣' }),
    ],
  },
});
