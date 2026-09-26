import { defineMeta } from '../define';

export default defineMeta({
  id: 'wall-flip',
  title: 'Wall Flip',
  tagline: 'Flip between walls and dodge the spikes as you climb.',
  description:
    'Race up a neon shaft by flipping from wall to wall. Spikes line the walls and saw blades spin in the middle — time every jump as the climb gets faster.',
  howToPlay: [
    'Tap to jump to the opposite wall.',
    'Avoid spikes on your wall and saws in the middle.',
    'Grab coins for bonus points. Speed keeps increasing.',
  ],
  categories: ['hyper-casual', 'endless', 'reflex'],
  tags: ['one-tap', 'runner', 'wall jump', 'climb', 'dodge'],
  difficulty: 'medium',
  controls: { desktop: 'Click, Space or ←/→ to flip', touch: 'Tap to flip walls' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 150, silver: 400, gold: 800 },
  theme: { from: '#06b6d4', to: '#1e1b4b', accent: '#22d3ee' },
  sessionLength: '20s–2 min',
  orientation: 'portrait',
  realtime: true,
  popularity: 84,
  addedAt: '2026-06-03',
});
