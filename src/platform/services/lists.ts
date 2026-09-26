import { arr, num, obj, str } from '../../lib/schema';
import type { FavoriteEntry, RecentEntry } from '../types';
import type { StorageDriver } from '../storage/driver';
import { PersistentStore } from '../storage/persistent-store';

const entrySchema = obj({ id: str({ max: 64 }), at: num({ min: 0 }) });
const MAX_RECENT = 24;

function repairEntries(data: unknown) {
  if (!Array.isArray(data)) return null;
  const seen = new Set<string>();
  return data.filter((e): e is { id: string; at: number } => {
    if (!entrySchema.is(e) || seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

export function createFavoritesStore(driver: StorageDriver) {
  const store = new PersistentStore<FavoriteEntry[]>(driver, {
    key: 'favorites',
    version: 1,
    schema: arr(entrySchema, { max: 500 }),
    defaults: () => [],
    repair: repairEntries,
  });
  return Object.assign(store, {
    has: (id: string) => store.get().some((f) => f.id === id),
    /** Returns the new favorite state. */
    toggle(id: string, now = Date.now()): boolean {
      const exists = store.get().some((f) => f.id === id);
      store.set((prev) => (exists ? prev.filter((f) => f.id !== id) : [{ id, at: now }, ...prev]));
      return !exists;
    },
  });
}

export function createRecentStore(driver: StorageDriver) {
  const store = new PersistentStore<RecentEntry[]>(driver, {
    key: 'recent',
    version: 1,
    schema: arr(entrySchema, { max: 100 }),
    defaults: () => [],
    repair: repairEntries,
  });
  return Object.assign(store, {
    touch(id: string, now = Date.now()) {
      store.set((prev) => [{ id, at: now }, ...prev.filter((r) => r.id !== id)].slice(0, MAX_RECENT));
    },
  });
}

export type FavoritesStore = ReturnType<typeof createFavoritesStore>;
export type RecentStore = ReturnType<typeof createRecentStore>;
