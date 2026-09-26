import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'five-letters',
  title: 'Five Letters',
  tagline: 'Guess the hidden word in six tries. Then the next. And the next.',
  description:
    'Crack a secret five-letter word in six guesses using green, yellow and gray clues. Solve it and a new word appears — how long can your streak last?',
  howToPlay: [
    'Type any five-letter word and press Enter.',
    'Green = right letter, right spot. Yellow = in the word, wrong spot.',
    'Solve in fewer guesses for more points. A miss ends your streak.',
  ],
  categories: ['word', 'brain', 'puzzle'],
  tags: ['wordle', 'guess', 'letters', 'vocabulary', 'deduction'],
  difficulty: 'medium',
  controls: { desktop: 'Type letters, Enter to guess', touch: 'Use the on-screen keyboard' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 800, silver: 1800, gold: 3500 },
  theme: { from: '#16a34a', to: '#ca8a04', accent: '#4ade80' },
  sessionLength: '2–10 min',
  orientation: 'portrait',
  resumable: true,
  realtime: false,
  popularity: 91,
  addedAt: '2026-06-10',
  shop: {
    title: 'Word Shop',
    icon: '🔤',
    upgrades: [upgrade('hint', 'Free hints', '💡', 'One free letter hint per level each game', 3, 100)],
    skins: [skin('classic', 'Classic', 0, ['#22c55e', '#eab308', '#475569'])],
  },
});
