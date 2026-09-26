import { defineMeta } from '../define';

export default defineMeta({
  id: 'gem-miner',
  title: 'Gem Miner Tycoon',
  tagline: 'Tap the rock, hire miners, dig deeper — even while away.',
  description:
    'An incremental mining tycoon. Tap to dig gold, invest it in miners, carts, drills and magma bores, and hit milestones for rewards. Your crew keeps digging while you’re away — then descend deeper for permanent gem bonuses.',
  howToPlay: [
    'Tap the rock to dig gold.',
    'Buy workers and machines that dig for you every second.',
    'Earn 1M gold to Descend: reset for permanent gem bonuses.',
  ],
  categories: ['strategy', 'hyper-casual'],
  tags: ['idle', 'incremental', 'clicker', 'tycoon', 'mining', 'offline progress'],
  difficulty: 'easy',
  controls: { desktop: 'Click the rock and the shop', touch: 'Tap the rock and the shop' },
  score: { label: 'Gold dug', format: 'points' },
  medals: { bronze: 50_000, silver: 1_000_000, gold: 20_000_000 },
  theme: { from: '#ca8a04', to: '#292524', accent: '#fde047' },
  sessionLength: 'Any length',
  orientation: 'portrait',
  resumable: true,
  realtime: false,
  dailyEligible: false,
  popularity: 83,
  addedAt: '2026-06-27',
});
