import { defineMeta } from '../define';

export default defineMeta({
  id: 'sudoku',
  title: 'Sudoku',
  tagline: 'Fresh, fair puzzles with notes, hints and a gentle clock.',
  description:
    'Fill the grid so every row, column and 3×3 box contains 1–9. Every puzzle is freshly generated with exactly one solution. Pencil in notes, and finish fast for a higher score.',
  howToPlay: [
    'Select a square, then tap a number to fill it.',
    'Every row, column and box must contain 1–9 once.',
    'Three mistakes and the puzzle is lost. Notes help you think.',
  ],
  categories: ['puzzle', 'brain'],
  tags: ['sudoku', 'numbers', 'logic', 'classic', 'grid'],
  difficulty: 'hard',
  controls: { desktop: 'Click or arrows, type 1–9, N for notes', touch: 'Tap a square, then a number' },
  score: { label: 'Points', format: 'points' },
  medals: { bronze: 1000, silver: 2200, gold: 3800 },
  theme: { from: '#0369a1', to: '#1e1b4b', accent: '#7dd3fc' },
  sessionLength: '5–20 min',
  orientation: 'portrait',
  resumable: true,
  realtime: false,
  popularity: 80,
  addedAt: '2026-06-12',
});
