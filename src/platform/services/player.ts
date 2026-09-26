import { num, nullable, obj, str } from '../../lib/schema';
import { DATE_KEY_PATTERN } from '../../lib/date';
import type { PlayerState } from '../types';
import type { StorageDriver } from '../storage/driver';
import { PersistentStore } from '../storage/persistent-store';

export function createAnonymousId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const playerSchema = obj({
  id: str({ max: 64, pattern: /^[a-f0-9-]{16,64}$/ }),
  createdAt: num({ min: 0 }),
  nickname: str({ max: 24 }),
  avatar: str({ max: 32 }),
  accent: str({ max: 32 }),
  xp: num({ min: 0 }),
  rounds: num({ int: true, min: 0 }),
  totalPoints: num({ min: 0 }),
  wins: num({ int: true, min: 0 }),
  recordsBroken: num({ int: true, min: 0 }),
  daysPlayed: num({ int: true, min: 0 }),
  lastDay: nullable(str({ pattern: DATE_KEY_PATTERN })),
});

export function defaultPlayer(now = Date.now()): PlayerState {
  return {
    id: createAnonymousId(),
    createdAt: now,
    nickname: '',
    avatar: 'controller',
    accent: 'violet',
    xp: 0,
    rounds: 0,
    totalPoints: 0,
    wins: 0,
    recordsBroken: 0,
    daysPlayed: 0,
    lastDay: null,
  };
}

export function createPlayerStore(driver: StorageDriver) {
  const store = new PersistentStore<PlayerState>(driver, {
    key: 'player',
    version: 1,
    schema: playerSchema,
    defaults: () => defaultPlayer(),
  });
  // Persist the generated anonymous id immediately so it is stable across visits.
  if (driver.get(store.storageKey) === null) store.set({ ...store.get() });
  return store;
}

export type PlayerStore = ReturnType<typeof createPlayerStore>;
