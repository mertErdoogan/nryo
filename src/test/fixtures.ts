import type { GameMeta } from '../platform/types';

export function makeMeta(overrides: Partial<GameMeta> = {}): GameMeta {
  return {
    id: 'test-game',
    title: 'Test Game',
    tagline: 'A game for tests',
    description: 'Used by unit tests.',
    howToPlay: ['Play'],
    categories: ['arcade'],
    tags: ['test'],
    difficulty: 'easy',
    controls: { desktop: 'Keys', touch: 'Tap' },
    score: { label: 'Points', format: 'points' },
    medals: { bronze: 10, silver: 20, gold: 30 },
    theme: { from: '#000', to: '#111', accent: '#fff' },
    sessionLength: '1 min',
    orientation: 'any',
    realtime: true,
    popularity: 50,
    addedAt: '2026-01-01',
    ...overrides,
  };
}

export const FIXTURE_GAMES: GameMeta[] = [
  makeMeta({
    id: 'racer',
    title: 'Racer',
    categories: ['racing', 'arcade'],
    tags: ['race', 'cars'],
    popularity: 90,
  }),
  makeMeta({
    id: 'drifter',
    title: 'Drifter',
    categories: ['racing'],
    tags: ['race', 'drift'],
    popularity: 60,
  }),
  makeMeta({ id: 'wordy', title: 'Wordy', categories: ['word', 'brain'], tags: ['letters'], popularity: 70 }),
  makeMeta({
    id: 'blaster',
    title: 'Blaster',
    categories: ['action'],
    tags: ['shoot', 'space'],
    popularity: 80,
  }),
  makeMeta({
    id: 'reflex',
    title: 'Reflex',
    categories: ['reflex'],
    tags: ['reaction'],
    score: { label: 'Avg', format: 'ms', lowerIsBetter: true },
    medals: { bronze: 350, silver: 280, gold: 230 },
    popularity: 40,
  }),
  makeMeta({
    id: 'thinker',
    title: 'Thinker',
    categories: ['strategy', 'versus'],
    tags: ['ai'],
    dailyEligible: false,
    popularity: 30,
  }),
];
