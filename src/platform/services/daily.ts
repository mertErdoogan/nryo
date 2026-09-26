import { addDays, DATE_KEY_PATTERN } from '../../lib/date';
import { hashString } from '../../lib/rng';
import { isPlainObject, nullable, num, obj, record, str } from '../../lib/schema';
import { meetsThreshold, niceNumber } from '../scoring';
import type { DailyChallenge, DailyRecord, DailyState, GameMeta } from '../types';
import type { StorageDriver } from '../storage/driver';
import { PersistentStore } from '../storage/persistent-store';

const KEEP_DAYS = 60;

const dailyRecordSchema = obj({
  gameId: str({ max: 64 }),
  target: num(),
  best: nullable(num()),
  attempts: num({ int: true, min: 0 }),
  completedAt: nullable(num({ min: 0 })),
});

const dailyStateSchema = obj({
  records: record(dailyRecordSchema, { maxKeys: 400 }),
  streak: num({ int: true, min: 0 }),
  bestStreak: num({ int: true, min: 0 }),
  lastCompleted: nullable(str({ pattern: DATE_KEY_PATTERN })),
  totalCompleted: num({ int: true, min: 0 }),
});

export const emptyDaily = (): DailyState => ({
  records: {},
  streak: 0,
  bestStreak: 0,
  lastCompleted: null,
  totalCompleted: 0,
});

export function createDailyStore(driver: StorageDriver) {
  return new PersistentStore<DailyState>(driver, {
    key: 'daily',
    version: 1,
    schema: dailyStateSchema,
    defaults: emptyDaily,
    repair: (data) => {
      if (!isPlainObject(data)) return null;
      const base = emptyDaily();
      const records: Record<string, DailyRecord> = {};
      if (isPlainObject(data.records)) {
        for (const [k, v] of Object.entries(data.records)) {
          if (DATE_KEY_PATTERN.test(k) && dailyRecordSchema.is(v)) records[k] = v;
        }
      }
      return { ...base, records };
    },
  });
}

export type DailyStore = ReturnType<typeof createDailyStore>;

type DailyGame = Pick<GameMeta, 'id' | 'medals' | 'score' | 'dailyEligible'>;

function eligible(games: readonly DailyGame[]): DailyGame[] {
  return games.filter((g) => g.dailyEligible !== false).sort((a, b) => a.id.localeCompare(b.id));
}

function rawPick(dateKey: string, pool: DailyGame[]): number {
  return hashString(`nryo-daily:${dateKey}`) % pool.length;
}

/**
 * Deterministic challenge for a calendar day: every visitor sees the same game,
 * target and seed for a given YYYY-MM-DD. Consecutive days never repeat a game.
 */
export function getDailyChallenge(dateKey: string, games: readonly DailyGame[]): DailyChallenge | null {
  const pool = eligible(games);
  if (pool.length === 0) return null;
  const hash = hashString(`nryo-daily:${dateKey}`);
  let index = rawPick(dateKey, pool);
  if (pool.length > 1 && index === rawPick(addDays(dateKey, -1), pool)) {
    index = (index + 1 + ((hash >>> 8) % (pool.length - 1))) % pool.length;
  }
  const game = pool[index]!;
  // Target sits between silver and gold: achievable, but a real stretch.
  const t = 0.2 + (((hash >>> 16) % 100) / 100) * 0.6;
  const { silver, gold } = game.medals;
  const raw = silver + (gold - silver) * t;
  return {
    date: dateKey,
    gameId: game.id,
    target: niceNumber(raw),
    seed: hashString(`${dateKey}:${game.id}`),
  };
}

/** Streak that is still alive today (completed today or yesterday). */
export function liveStreak(state: DailyState, today: string): number {
  if (!state.lastCompleted) return 0;
  if (state.lastCompleted === today || state.lastCompleted === addDays(today, -1)) return state.streak;
  return 0;
}

export interface DailyAttemptOutcome {
  completed: boolean;
  firstCompletion: boolean;
  streak: number;
}

export function applyDailyAttempt(
  state: DailyState,
  challenge: DailyChallenge,
  score: number,
  lowerIsBetter: boolean,
  now: number,
): { state: DailyState; outcome: DailyAttemptOutcome } {
  const prev: DailyRecord = state.records[challenge.date] ?? {
    gameId: challenge.gameId,
    target: challenge.target,
    best: null,
    attempts: 0,
    completedAt: null,
  };
  const best =
    prev.best === null ? score : lowerIsBetter ? Math.min(prev.best, score) : Math.max(prev.best, score);
  const completedNow = meetsThreshold(score, challenge.target, lowerIsBetter);
  const firstCompletion = completedNow && prev.completedAt === null;
  const record: DailyRecord = {
    ...prev,
    best,
    attempts: prev.attempts + 1,
    completedAt: prev.completedAt ?? (completedNow ? now : null),
  };

  let { streak, bestStreak, lastCompleted, totalCompleted } = state;
  if (firstCompletion) {
    streak = lastCompleted === addDays(challenge.date, -1) ? streak + 1 : 1;
    bestStreak = Math.max(bestStreak, streak);
    lastCompleted = challenge.date;
    totalCompleted += 1;
  }

  // Trim old history so storage stays small.
  const records: Record<string, DailyRecord> = { ...state.records, [challenge.date]: record };
  const cutoff = addDays(challenge.date, -KEEP_DAYS);
  for (const key of Object.keys(records)) if (key < cutoff) delete records[key];

  return {
    state: { records, streak, bestStreak, lastCompleted, totalCompleted },
    outcome: { completed: record.completedAt !== null, firstCompletion, streak },
  };
}
