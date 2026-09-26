import { defineMeta } from '../define';

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
});
