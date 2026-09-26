import { isPlainObject, nullable, num, obj, oneOf, record } from '../../lib/schema';
import type { GameStats } from '../types';
import type { StorageDriver } from '../storage/driver';
import { PersistentStore } from '../storage/persistent-store';

export const gameStatsSchema = obj({
  plays: num({ int: true, min: 0 }),
  best: nullable(num()),
  last: nullable(num()),
  totalScore: num({ min: 0 }),
  wins: num({ int: true, min: 0 }),
  medal: oneOf([0, 1, 2, 3] as const),
  firstPlayedAt: num({ min: 0 }),
  lastPlayedAt: num({ min: 0 }),
  timePlayedMs: num({ min: 0 }),
});

export const emptyStats = (now: number): GameStats => ({
  plays: 0,
  best: null,
  last: null,
  totalScore: 0,
  wins: 0,
  medal: 0,
  firstPlayedAt: now,
  lastPlayedAt: now,
  timePlayedMs: 0,
});

const statsSchema = record(gameStatsSchema, { maxKeys: 500 });

export function createStatsStore(driver: StorageDriver) {
  return new PersistentStore<Record<string, GameStats>>(driver, {
    key: 'stats',
    version: 1,
    schema: statsSchema,
    defaults: () => ({}),
    // Drop only the broken entries — never lose every record because of one.
    repair: (data) => {
      if (!isPlainObject(data)) return null;
      const out: Record<string, GameStats> = {};
      for (const [id, value] of Object.entries(data)) {
        if (gameStatsSchema.is(value)) out[id] = value;
      }
      return out;
    },
  });
}

export type StatsStore = ReturnType<typeof createStatsStore>;
