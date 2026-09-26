/**
 * Storage driver abstraction. The default implementation uses localStorage
 * (synchronous, so progress can be written reliably during `pagehide`) and
 * silently falls back to memory when storage is unavailable or full — the
 * game must keep working even if nothing can be persisted.
 */
export interface StorageDriver {
  readonly persistent: boolean;
  get(key: string): string | null;
  /** Returns false when the write could not be persisted (quota, private mode…). */
  set(key: string, value: string): boolean;
  remove(key: string): void;
  keys(): string[];
}

export function createMemoryDriver(initial: Record<string, string> = {}): StorageDriver {
  const map = new Map(Object.entries(initial));
  return {
    persistent: false,
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
      return true;
    },
    remove: (key) => {
      map.delete(key);
    },
    keys: () => [...map.keys()],
  };
}

function localStorageAvailable(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probe = '__nryo_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createBrowserDriver(): StorageDriver {
  const ls = localStorageAvailable();
  if (!ls) return createMemoryDriver();
  // Keep a memory mirror so reads never fail and writes that exceed the quota
  // are still visible for the rest of the session.
  const fallback = createMemoryDriver();
  return {
    persistent: true,
    get(key) {
      try {
        return ls.getItem(key) ?? fallback.get(key);
      } catch {
        return fallback.get(key);
      }
    },
    set(key, value) {
      try {
        ls.setItem(key, value);
        fallback.remove(key);
        return true;
      } catch {
        fallback.set(key, value);
        return false;
      }
    },
    remove(key) {
      try {
        ls.removeItem(key);
      } catch {
        /* ignore */
      }
      fallback.remove(key);
    },
    keys() {
      const out = new Set(fallback.keys());
      try {
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (k) out.add(k);
        }
      } catch {
        /* ignore */
      }
      return [...out];
    },
  };
}

export const KEY_PREFIX = 'nryo:';
