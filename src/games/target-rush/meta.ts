import { defineMeta } from '../define';

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
});
