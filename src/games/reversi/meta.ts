import { defineMeta } from '../define';

export default defineMeta({
  id: 'reversi',
  title: 'Reversi',
  tagline: 'Flip the board in your favour. Corners are king.',
  description:
    'The elegant strategy classic, also known as Othello. Outflank the AI’s discs to flip them to your colour. Whoever owns the most discs when the board fills up wins.',
  howToPlay: [
    'Place a disc to trap AI discs in a straight line between yours.',
    'Every trapped disc flips to your colour. Glowing dots show legal moves.',
    'Most discs at the end wins. Corners can never be flipped back!',
  ],
  categories: ['strategy', 'versus', 'brain'],
  tags: ['othello', 'board game', 'ai', 'flip', 'classic'],
  difficulty: 'medium',
  controls: { desktop: 'Click a highlighted square', touch: 'Tap a highlighted square' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 400, silver: 900, gold: 1500 },
  theme: { from: '#15803d', to: '#052e16', accent: '#4ade80' },
  sessionLength: '3–6 min',
  orientation: 'any',
  realtime: false,
  dailyEligible: false,
  popularity: 70,
  addedAt: '2026-06-26',
});
