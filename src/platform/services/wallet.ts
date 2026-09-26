import { DATE_KEY_PATTERN, addDays } from '../../lib/date';
import { num, nullable, obj, str } from '../../lib/schema';
import { ECONOMY, dailyRewardFor } from '../economy';
import type { StorageDriver } from '../storage/driver';
import { PersistentStore } from '../storage/persistent-store';

export interface WalletState {
  coins: number;
  /** Lifetime totals, for the profile page and achievements. */
  earned: number;
  spent: number;
  adsWatched: number;
  revives: number;
  purchases: number;
  /** Daily login reward. */
  lastClaim: string | null;
  claimStreak: number;
  /** Rewarded "free coins" in the shop, capped per day. */
  freeCoinsDay: string | null;
  freeCoinsCount: number;
}

const int = () => num({ int: true, min: 0 });
const dateKey = () => nullable(str({ pattern: DATE_KEY_PATTERN }));

const walletSchema = obj({
  coins: int(),
  earned: int(),
  spent: int(),
  adsWatched: int(),
  revives: int(),
  purchases: int(),
  lastClaim: dateKey(),
  claimStreak: int(),
  freeCoinsDay: dateKey(),
  freeCoinsCount: int(),
});

export const emptyWallet = (): WalletState => ({
  coins: 0,
  earned: 0,
  spent: 0,
  adsWatched: 0,
  revives: 0,
  purchases: 0,
  lastClaim: null,
  claimStreak: 0,
  freeCoinsDay: null,
  freeCoinsCount: 0,
});

export interface DailyRewardStatus {
  available: boolean;
  /** Streak day the next claim counts as (1-based). */
  day: number;
  amount: number;
}

export function createWalletStore(driver: StorageDriver) {
  const store = new PersistentStore<WalletState>(driver, {
    key: 'wallet',
    version: 1,
    schema: walletSchema,
    defaults: emptyWallet,
    repair: (data) => {
      if (typeof data !== 'object' || data === null) return null;
      const d = data as Record<string, unknown>;
      const base = emptyWallet();
      for (const k of Object.keys(base) as (keyof WalletState)[]) {
        const v = d[k];
        if (k === 'lastClaim' || k === 'freeCoinsDay') {
          if (v === null || (typeof v === 'string' && DATE_KEY_PATTERN.test(v))) base[k] = v;
        } else if (typeof v === 'number' && Number.isInteger(v) && v >= 0) base[k] = v;
      }
      return base;
    },
  });

  const clampInt = (n: number) => Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));

  return Object.assign(store, {
    earn(amount: number): void {
      const n = clampInt(amount);
      if (n === 0) return;
      store.set((w) => ({ ...w, coins: w.coins + n, earned: w.earned + n }));
    },
    /** Returns false (and changes nothing) when the balance is too low. */
    spend(amount: number): boolean {
      const n = clampInt(amount);
      if (store.get().coins < n) return false;
      store.set((w) => ({ ...w, coins: w.coins - n, spent: w.spent + n }));
      return true;
    },
    countAd(): void {
      store.set((w) => ({ ...w, adsWatched: w.adsWatched + 1 }));
    },
    countRevive(): void {
      store.set((w) => ({ ...w, revives: w.revives + 1 }));
    },
    countPurchase(): void {
      store.set((w) => ({ ...w, purchases: w.purchases + 1 }));
    },
    dailyStatus(today: string): DailyRewardStatus {
      const w = store.get();
      if (w.lastClaim === today) {
        const day = Math.max(1, w.claimStreak);
        return { available: false, day, amount: dailyRewardFor(day) };
      }
      const day = w.lastClaim !== null && addDays(w.lastClaim, 1) === today ? w.claimStreak + 1 : 1;
      return { available: true, day, amount: dailyRewardFor(day) };
    },
    /** Claims today's login reward. Returns the coins granted (0 if already claimed). */
    claimDaily(today: string, multiplier = 1): number {
      const status = this.dailyStatus(today);
      if (!status.available) return 0;
      const amount = status.amount * Math.max(1, Math.floor(multiplier));
      store.set((w) => ({
        ...w,
        coins: w.coins + amount,
        earned: w.earned + amount,
        lastClaim: today,
        claimStreak: status.day,
      }));
      return amount;
    },
    freeCoinsLeft(today: string): number {
      const w = store.get();
      return w.freeCoinsDay === today
        ? Math.max(0, ECONOMY.freeCoinsPerDay - w.freeCoinsCount)
        : ECONOMY.freeCoinsPerDay;
    },
    /** Grants the rewarded "free coins" if today's cap allows it. */
    grantFreeCoins(today: string): number {
      if (this.freeCoinsLeft(today) <= 0) return 0;
      const amount = ECONOMY.freeCoinsAmount;
      store.set((w) => ({
        ...w,
        coins: w.coins + amount,
        earned: w.earned + amount,
        freeCoinsDay: today,
        freeCoinsCount: (w.freeCoinsDay === today ? w.freeCoinsCount : 0) + 1,
      }));
      return amount;
    },
  });
}

export type WalletStore = ReturnType<typeof createWalletStore>;
