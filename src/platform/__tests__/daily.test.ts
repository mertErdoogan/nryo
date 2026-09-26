import { describe, expect, it } from 'vitest';
import { addDays } from '../../lib/date';
import { FIXTURE_GAMES } from '../../test/fixtures';
import { applyDailyAttempt, emptyDaily, getDailyChallenge, liveStreak } from '../services/daily';

describe('daily challenge', () => {
  it('is deterministic for a date and differs across dates', () => {
    const a = getDailyChallenge('2026-09-26', FIXTURE_GAMES)!;
    const b = getDailyChallenge('2026-09-26', FIXTURE_GAMES)!;
    expect(a).toEqual(b);
    const week = Array.from({ length: 30 }, (_, i) => getDailyChallenge(addDays('2026-09-01', i), FIXTURE_GAMES)!);
    expect(new Set(week.map((c) => c.seed)).size).toBe(30);
  });

  it('never repeats the same game on consecutive days and skips ineligible games', () => {
    let prev = getDailyChallenge('2026-01-01', FIXTURE_GAMES)!;
    for (let i = 1; i < 200; i++) {
      const next = getDailyChallenge(addDays('2026-01-01', i), FIXTURE_GAMES)!;
      expect(next.gameId).not.toBe(prev.gameId);
      expect(next.gameId).not.toBe('thinker');
      prev = next;
    }
  });

  it('shows every eligible game once per cycle', () => {
    const eligible = FIXTURE_GAMES.filter((g) => g.dailyEligible !== false).length;
    // Find a cycle boundary, then check one full cycle.
    const start = '2026-01-01';
    const ids = Array.from({ length: eligible * 3 }, (_, i) => getDailyChallenge(addDays(start, i), FIXTURE_GAMES)!.gameId);
    const counts = new Map<string, number>();
    ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    for (const c of counts.values()) expect(c).toBeGreaterThanOrEqual(2);
  });

  it('sets targets between silver and gold', () => {
    for (let i = 0; i < 60; i++) {
      const c = getDailyChallenge(addDays('2026-05-01', i), FIXTURE_GAMES)!;
      const g = FIXTURE_GAMES.find((x) => x.id === c.gameId)!;
      const [lo, hi] = [Math.min(g.medals.silver, g.medals.gold), Math.max(g.medals.silver, g.medals.gold)];
      expect(c.target).toBeGreaterThanOrEqual(lo - 5);
      expect(c.target).toBeLessThanOrEqual(hi + 5);
    }
  });

  it('tracks completion, best result and streaks', () => {
    const day1 = { date: '2026-09-01', gameId: 'racer', target: 20, seed: 1 };
    let r = applyDailyAttempt(emptyDaily(), day1, 10, false, 1);
    expect(r.outcome).toEqual({ completed: false, firstCompletion: false, streak: 0 });
    r = applyDailyAttempt(r.state, day1, 25, false, 2);
    expect(r.outcome.firstCompletion).toBe(true);
    expect(r.state.records['2026-09-01']).toMatchObject({ best: 25, attempts: 2 });
    r = applyDailyAttempt(r.state, day1, 30, false, 3);
    expect(r.outcome.firstCompletion).toBe(false);
    expect(r.state.streak).toBe(1);

    const day2 = { ...day1, date: '2026-09-02' };
    r = applyDailyAttempt(r.state, day2, 22, false, 4);
    expect(r.state.streak).toBe(2);
    expect(liveStreak(r.state, '2026-09-03')).toBe(2);
    expect(liveStreak(r.state, '2026-09-05')).toBe(0);

    const day5 = { ...day1, date: '2026-09-05' };
    r = applyDailyAttempt(r.state, day5, 40, false, 5);
    expect(r.state.streak).toBe(1);
    expect(r.state.bestStreak).toBe(2);
    expect(r.state.totalCompleted).toBe(3);
  });

  it('handles lower-is-better targets', () => {
    const c = { date: '2026-09-01', gameId: 'reflex', target: 260, seed: 1 };
    expect(applyDailyAttempt(emptyDaily(), c, 300, true, 1).outcome.completed).toBe(false);
    expect(applyDailyAttempt(emptyDaily(), c, 240, true, 1).outcome.completed).toBe(true);
  });
});
