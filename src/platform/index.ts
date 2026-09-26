import { GAMES } from '../games/catalog';
import { createPlatform } from './platform';
import { createBrowserDriver, KEY_PREFIX } from './storage/driver';

/** The app-wide platform instance backed by browser storage. */
export const platform = createPlatform(createBrowserDriver(), {
  games: GAMES,
  debugAnalytics: import.meta.env.DEV && import.meta.env.MODE !== 'test',
});

if (typeof window !== 'undefined') {
  // Keep multiple open tabs in sync.
  window.addEventListener('storage', (event) => {
    if (event.key === null) {
      platform.reloadAll();
      return;
    }
    if (!event.key.startsWith(KEY_PREFIX)) return;
    const store = platform.storeByKey.get(event.key);
    if (store) store.reload();
    else platform.saves.rebuildIndex();
  });
  window.addEventListener('pagehide', () => platform.analytics.flush());
}

export type { Platform } from './platform';
