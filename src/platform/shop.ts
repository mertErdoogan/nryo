import { upgradeCost } from './economy';
import { isSkinOwned } from './services/loadouts';
import type { GameLoadout, GameShop } from './types';

/** How many shop items the player could buy right now (drives the "ready to upgrade" badge). */
export function affordableCount(shop: GameShop | undefined, loadout: GameLoadout, coins: number): number {
  if (!shop) return 0;
  let n = 0;
  for (const u of shop.upgrades) {
    const cost = upgradeCost(u, loadout.upgrades[u.id] ?? 0);
    if (cost !== null && cost <= coins) n++;
  }
  for (const s of shop.skins) {
    if (s.price > 0 && s.price <= coins && !isSkinOwned(loadout, shop, s.id)) n++;
  }
  return n;
}

/** The cheapest thing still to buy, for "next upgrade at N coins" hints. */
export function cheapestItem(shop: GameShop | undefined, loadout: GameLoadout): number | null {
  if (!shop) return null;
  const prices: number[] = [];
  for (const u of shop.upgrades) {
    const cost = upgradeCost(u, loadout.upgrades[u.id] ?? 0);
    if (cost !== null) prices.push(cost);
  }
  for (const s of shop.skins) if (s.price > 0 && !isSkinOwned(loadout, shop, s.id)) prices.push(s.price);
  return prices.length ? Math.min(...prices) : null;
}
