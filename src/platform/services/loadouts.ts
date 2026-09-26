import { arr, num, obj, record, str } from '../../lib/schema';
import { DEFAULT_SKIN } from '../economy';
import type { ActiveLoadout, GameLoadout, GameShop } from '../types';
import type { StorageDriver } from '../storage/driver';
import { PersistentStore } from '../storage/persistent-store';

const id = () => str({ max: 48 });
const loadoutSchema = obj({
  upgrades: record(num({ int: true, min: 0, max: 100 }), { maxKeys: 32 }),
  owned: arr(id(), { max: 64 }),
  equipped: id(),
  adProgress: record(num({ int: true, min: 0, max: 100 }), { maxKeys: 64 }),
});
const loadoutsSchema = record(loadoutSchema, { maxKeys: 500 });

export const emptyLoadout = (shop?: GameShop): GameLoadout => ({
  upgrades: {},
  owned: [],
  equipped: shop?.skins[0]?.id ?? DEFAULT_SKIN.id,
  adProgress: {},
});

/**
 * Normalises a stored loadout against the game's current shop definition:
 * unknown items are ignored, levels are capped, and the equipped skin falls
 * back to the default if it is no longer owned or no longer exists.
 */
export function resolveLoadout(stored: GameLoadout | undefined, shop?: GameShop): GameLoadout {
  const base = emptyLoadout(shop);
  if (!stored || !shop) return base;
  const upgrades: Record<string, number> = {};
  for (const u of shop.upgrades) {
    const lvl = stored.upgrades[u.id] ?? 0;
    if (lvl > 0) upgrades[u.id] = Math.min(u.maxLevel, lvl);
  }
  const owned = stored.owned.filter((s) => shop.skins.some((k) => k.id === s));
  const defaultSkin = shop.skins[0]?.id ?? DEFAULT_SKIN.id;
  const equippable = (s: string) =>
    s === defaultSkin || owned.includes(s) || shop.skins.find((k) => k.id === s)?.price === 0;
  return {
    upgrades,
    owned,
    equipped: equippable(stored.equipped) ? stored.equipped : defaultSkin,
    adProgress: { ...stored.adProgress },
  };
}

export function isSkinOwned(loadout: GameLoadout, shop: GameShop, skinId: string): boolean {
  const skin = shop.skins.find((s) => s.id === skinId);
  if (!skin) return false;
  return skin.price === 0 && !skin.adUnlock ? true : loadout.owned.includes(skinId);
}

export function toActiveLoadout(loadout: GameLoadout, shop?: GameShop): ActiveLoadout {
  const skin = shop?.skins.find((s) => s.id === loadout.equipped) ?? shop?.skins[0] ?? DEFAULT_SKIN;
  const levels = { ...loadout.upgrades };
  return { level: (upgradeId) => levels[upgradeId] ?? 0, skin };
}

export function createLoadoutStore(driver: StorageDriver) {
  const store = new PersistentStore<Record<string, GameLoadout>>(driver, {
    key: 'loadouts',
    version: 1,
    schema: loadoutsSchema,
    defaults: () => ({}),
    repair: (data) => {
      if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
      return Object.fromEntries(
        Object.entries(data as Record<string, unknown>).filter(([, v]) => loadoutSchema.is(v)),
      ) as Record<string, GameLoadout>;
    },
  });
  return Object.assign(store, {
    of(gameId: string, shop?: GameShop): GameLoadout {
      return resolveLoadout(store.get()[gameId], shop);
    },
    put(gameId: string, loadout: GameLoadout): void {
      store.set((all) => ({ ...all, [gameId]: loadout }));
    },
  });
}

export type LoadoutStore = ReturnType<typeof createLoadoutStore>;
