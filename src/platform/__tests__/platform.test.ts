import { describe, expect, it } from 'vitest';
import { FIXTURE_GAMES } from '../../test/fixtures';
import { exportProgress, importProgress } from '../data-transfer';
import { createPlatform, XP_RULES } from '../platform';
import { createMemoryDriver } from '../storage/driver';
import type { PlatformEvent } from '../platform';

const racer = FIXTURE_GAMES[0]!;
const reflex = FIXTURE_GAMES[4]!;

function setup(now = new Date(2026, 8, 26, 12).getTime()) {
  let clock = now;
  const driver = createMemoryDriver();
  const platform = createPlatform(driver, { games: FIXTURE_GAMES, now: () => clock });
  return { platform, driver, advance: (ms: number) => (clock += ms) };
}

const round = (score: number, extra: Partial<{ won: boolean; durationMs: number }> = {}) => ({
  meta: racer,
  result: { score, won: extra.won },
  mode: 'normal' as const,
  durationMs: extra.durationMs ?? 30_000,
  daily: null,
});

describe('platform.recordRound', () => {
  it('creates a stable anonymous player id', () => {
    const { platform, driver } = setup();
    const id = platform.player.get().id;
    expect(id).toMatch(/^[a-f0-9-]{16,64}$/);
    const again = createPlatform(driver, { games: FIXTURE_GAMES });
    expect(again.player.get().id).toBe(id);
  });

  it('records stats, best score, medals and XP', () => {
    const { platform } = setup();
    const first = platform.recordRound(round(12));
    expect(first.previousBest).toBeNull();
    expect(first.isNewBest).toBe(false);
    expect(first.best).toBe(12);
    expect(first.newMedal).toBe(1);
    expect(first.xp.find((l) => l.label === 'Round played')?.xp).toBe(XP_RULES.round);

    const second = platform.recordRound(round(8));
    expect(second.best).toBe(12);
    expect(second.isNewBest).toBe(false);

    const third = platform.recordRound(round(35, { won: true }));
    expect(third.isNewBest).toBe(true);
    expect(third.previousBest).toBe(12);
    expect(third.newMedal).toBe(3);
    expect(third.xp.map((l) => l.label)).toEqual(
      expect.arrayContaining([
        'New personal best',
        'Silver medal unlocked',
        'Gold medal unlocked',
        'Victory',
      ]),
    );

    const stats = platform.stats.get()[racer.id]!;
    expect(stats).toMatchObject({ plays: 3, best: 35, last: 35, wins: 1, medal: 3 });
    expect(platform.player.get()).toMatchObject({ rounds: 3, wins: 1, recordsBroken: 1, daysPlayed: 1 });
    expect(platform.recent.get()[0]!.id).toBe(racer.id);
  });

  it('keeps lower-is-better bests correct', () => {
    const { platform } = setup();
    platform.recordRound({ ...round(320), meta: reflex });
    const r = platform.recordRound({ ...round(240), meta: reflex });
    expect(r.isNewBest).toBe(true);
    expect(platform.stats.get().reflex!.best).toBe(240);
    expect(platform.recordRound({ ...round(400), meta: reflex }).best).toBe(240);
  });

  it('unlocks achievements (once) and grants their XP', () => {
    const { platform } = setup();
    const r = platform.recordRound(round(5));
    expect(r.achievements.map((a) => a.id)).toContain('first-round');
    const xpAfter = platform.player.get().xp;
    const again = platform.recordRound(round(5));
    expect(again.achievements.map((a) => a.id)).not.toContain('first-round');
    expect(platform.player.get().xp).toBeGreaterThan(xpAfter);
    expect(Object.keys(platform.achievements.get())).toContain('first-round');
  });

  it('gives short, scoreless rounds less XP', () => {
    const { platform } = setup();
    const r = platform.recordRound(round(0, { durationMs: 1000 }));
    expect(r.xp[0]).toEqual({ label: 'Round played', xp: XP_RULES.shortRound });
  });

  it('completes daily challenges and counts streaks', () => {
    const { platform, advance } = setup();
    const challenge = platform.todaysChallenge()!;
    const game = FIXTURE_GAMES.find((g) => g.id === challenge.gameId)!;
    const good = game.score.lowerIsBetter ? challenge.target - 1 : challenge.target + 1;
    const r = platform.recordRound({
      meta: game,
      result: { score: good },
      mode: 'daily',
      durationMs: 20_000,
      daily: challenge,
    });
    expect(r.daily).toMatchObject({ completed: true, firstCompletion: true, streak: 1 });
    expect(r.xp.some((l) => l.label === 'Daily challenge complete')).toBe(true);
    expect(r.achievements.map((a) => a.id)).toContain('daily-1');
    advance(86_400_000);
    const tomorrow = platform.todaysChallenge()!;
    const g2 = FIXTURE_GAMES.find((g) => g.id === tomorrow.gameId)!;
    const r2 = platform.recordRound({
      meta: g2,
      result: { score: g2.score.lowerIsBetter ? tomorrow.target - 1 : tomorrow.target + 1 },
      mode: 'daily',
      durationMs: 20_000,
      daily: tomorrow,
    });
    expect(r2.daily?.streak).toBe(2);
    expect(platform.player.get().daysPlayed).toBe(2);
  });

  it('toggles favorites and emits achievement events', () => {
    const { platform } = setup();
    const events: PlatformEvent[] = [];
    platform.on((e) => events.push(e));
    expect(platform.toggleFavorite('racer')).toBe(true);
    expect(platform.favorites.has('racer')).toBe(true);
    expect(events.some((e) => e.type === 'achievement' && e.achievement.id === 'favorite-1')).toBe(true);
    expect(platform.toggleFavorite('racer')).toBe(false);
    expect(platform.favorites.get()).toEqual([]);
  });

  it('resets everything including the anonymous id', () => {
    const { platform } = setup();
    const id = platform.player.get().id;
    platform.recordRound(round(20));
    platform.toggleFavorite('racer');
    platform.saves.write('racer', 1, { a: 1 }, { label: 'x', progress: 0 });
    platform.resetAll();
    expect(platform.stats.get()).toEqual({});
    expect(platform.favorites.get()).toEqual([]);
    expect(platform.saves.get()).toEqual([]);
    expect(platform.player.get().rounds).toBe(0);
    expect(platform.player.get().id).not.toBe(id);
  });
});

describe('progress export / import', () => {
  it('round-trips all progress to a new browser', () => {
    const a = setup().platform;
    a.recordRound(round(22));
    a.toggleFavorite('wordy');
    a.saves.write('racer', 1, { lap: 2 }, { label: 'Lap 2', progress: 0.5 });
    const file = exportProgress(a);

    const b = setup().platform;
    const result = importProgress(b, JSON.stringify(file));
    expect(result).toMatchObject({ ok: true });
    expect(b.stats.get().racer!.best).toBe(22);
    expect(b.favorites.has('wordy')).toBe(true);
    expect(b.saves.has('racer')).toBe(true);
    expect(b.player.get().id).toBe(a.player.get().id);
  });

  it('rejects invalid files without touching existing data', () => {
    const p = setup().platform;
    p.recordRound(round(9));
    expect(importProgress(p, 'not json').ok).toBe(false);
    expect(importProgress(p, JSON.stringify({ app: 'other', format: 1, data: {} })).ok).toBe(false);
    expect(
      importProgress(
        p,
        JSON.stringify({ app: 'nryo-arcade', format: 1, data: { 'nryo:stats': '{"v":1,"d":"bad"}' } }),
      ).ok,
    ).toBe(false);
    expect(p.stats.get().racer!.best).toBe(9);
  });
});
