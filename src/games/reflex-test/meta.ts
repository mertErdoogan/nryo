import { defineMeta } from '../define';

export default defineMeta({
  id: 'reflex-test',
  title: 'Reflex Test',
  tagline: 'Wait for green… then tap as fast as humanly possible.',
  description:
    'A pure reaction-time test. Wait for the screen to turn green, then tap. Five rounds, your average in milliseconds is your score — lower is better.',
  howToPlay: [
    'Wait for the panel to turn green, then tap immediately.',
    'Tapping on red is a false start — that round restarts.',
    'Your average over 5 rounds is your score. Lower is better.',
  ],
  categories: ['reflex', 'brain'],
  tags: ['reaction', 'speed', 'test', 'ms', 'quick'],
  difficulty: 'easy',
  controls: { desktop: 'Click, Space or Enter', touch: 'Tap the panel' },
  score: { label: 'Avg. reaction', format: 'ms', lowerIsBetter: true },
  medals: { bronze: 350, silver: 280, gold: 230 },
  theme: { from: '#16a34a', to: '#dc2626', accent: '#4ade80' },
  sessionLength: '20s',
  orientation: 'any',
  realtime: true,
  popularity: 80,
  addedAt: '2026-06-02',
});
