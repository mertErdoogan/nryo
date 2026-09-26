import { describe, expect, it } from 'vitest';
import { FIXTURE_GAMES, makeMeta } from '../../test/fixtures';
import { ACHIEVEMENTS, findNewlyUnlocked } from '../achievements';
import { featuredForDay, newestGames, popularityScore, rankPopular, recommend, recommendForPlayer, searchGames } from '../discovery';
import { defaultPlayer } from '../services/player';
import { emptyDaily } from '../services/daily';
import { emptyStats } from '../services/stats';
import { getLeaderboard, nextRival } from '../rivals';

describe('search', () => {
  it('finds games by title, category and tag (including stems)', () => {
    expect(searchGames('race', FIXTURE_GAMES).map((g) => g.id).slice(0, 2).sort()).toEqual(['drifter', 'racer']);
    expect(searchGames('racing', FIXTURE_GAMES).map((g) => g.id)).toContain('drifter');
    expect(searchGames('shoot', FIXTURE_GAMES)[0]!.id).toBe('blaster');
    expect(searchGames('word', FIXTURE_GAMES)[0]!.id).toBe('wordy');
    expect(searchGames('strategy', FIXTURE_GAMES)[0]!.id).toBe('thinker');
    expect(searchGames('zzzz', FIXTURE_GAMES)).toEqual([]);
    expect(searchGames('', FIXTURE_GAMES)).toHaveLength(FIXTURE_GAMES.length);
  });

  it('requires every word to match', () => {
    expect(searchGames('race drift', FIXTURE_GAMES).map((g) => g.id)).toEqual(['drifter']);
  });
});

describe('recommendations and popularity', () => {
  it('recommends similar games and never the current one', () => {
    const recs = recommend(FIXTURE_GAMES[0]!, FIXTURE_GAMES, {}, 3);
    expect(recs).toHaveLength(3);
    expect(recs.map((g) => g.id)).not.toContain('racer');
    expect(recs[0]!.id).toBe('drifter');
  });

  it('boosts games the player keeps coming back to', () => {
    const now = Date.now();
    const stats = { thinker: { ...emptyStats(now), plays: 40, lastPlayedAt: now } };
    expect(popularityScore(FIXTURE_GAMES[5]!, stats.thinker, now)).toBeGreaterThan(FIXTURE_GAMES[5]!.popularity);
    const ranked = rankPopular(FIXTURE_GAMES, stats, now);
    expect(ranked.findIndex((g) => g.id === 'thinker')).toBeLessThan(FIXTURE_GAMES.length - 1);
  });

  it('personalises suggestions from recent play', () => {
    const recs = recommendForPlayer(FIXTURE_GAMES, {}, [{ id: 'racer', at: 1 }], 2);
    expect(recs.map((g) => g.id)).not.toContain('racer');
    expect(recs[0]!.id).toBe('drifter');
  });

  it('rotates the featured shelf daily but deterministically', () => {
    expect(featuredForDay(FIXTURE_GAMES, '2026-01-01', 3)).toEqual(featuredForDay(FIXTURE_GAMES, '2026-01-01', 3));
    expect(newestGames([makeMeta({ id: 'old', addedAt: '2025-01-01' }), makeMeta({ id: 'new', addedAt: '2026-06-01' })], 1)[0]!.id).toBe('new');
  });
});

describe('rival leaderboard', () => {
  it('is sorted, deterministic and includes the player', () => {
    const meta = FIXTURE_GAMES[0]!;
    const board = getLeaderboard(meta, 22, 'Me');
    expect(board).toEqual(getLeaderboard(meta, 22, 'Me'));
    expect(board.some((e) => e.isPlayer && e.score === 22)).toBe(true);
    for (let i = 1; i < board.length; i++) expect(board[i - 1]!.score).toBeGreaterThanOrEqual(board[i]!.score);
    const rival = nextRival(board)!;
    expect(rival.score).toBeGreaterThanOrEqual(22);
  });

  it('sorts ascending for lower-is-better games', () => {
    const board = getLeaderboard(FIXTURE_GAMES[4]!, null, 'Me');
    for (let i = 1; i < board.length; i++) expect(board[i - 1]!.score).toBeLessThanOrEqual(board[i]!.score);
    expect(board.every((e) => e.score > 0)).toBe(true);
  });
});

describe('achievements', () => {
  it('have unique ids and evaluate against a snapshot', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    const player = { ...defaultPlayer(), rounds: 10, totalPoints: 1500 };
    const snapshot = { player, level: 1, stats: {}, favorites: 0, daily: emptyDaily(), games: FIXTURE_GAMES };
    const ids = findNewlyUnlocked(snapshot, {}).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['first-round', 'rounds-10', 'points-1k']));
    expect(ids).not.toContain('rounds-50');
    expect(findNewlyUnlocked(snapshot, { 'first-round': 1 }).map((a) => a.id)).not.toContain('first-round');
  });
});
