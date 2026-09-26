import { toDateKey } from '../lib/date';
import { num, record } from '../lib/schema';
import { findNewlyUnlocked } from './achievements';
import { levelFromXp } from './services/levels';
import { createPlayerStore } from './services/player';
import { createSettingsStore } from './services/settings';
import { createStatsStore, emptyStats } from './services/stats';
import { createFavoritesStore, createRecentStore } from './services/lists';
import { GameSaveService } from './services/saves';
import { applyDailyAttempt, createDailyStore, getDailyChallenge } from './services/daily';
import { Analytics, consoleSink, createLocalBufferSink } from './services/analytics';
import { isBetter, medalFor } from './scoring';
import { coinsForRound, upgradeCost } from './economy';
import { createWalletStore } from './services/wallet';
import { createLoadoutStore, isSkinOwned } from './services/loadouts';
import type { StorageDriver } from './storage/driver';
import { KEY_PREFIX } from './storage/driver';
import { PersistentStore } from './storage/persistent-store';
import type {
  Achievement,
  DailyChallenge,
  GameMeta,
  GameResult,
  MedalTier,
  PlayMode,
  ProgressSnapshot,
  RoundOutcome,
  XpLine,
} from './types';

export interface PlatformOptions {
  games: readonly GameMeta[];
  now?: () => number;
  debugAnalytics?: boolean;
}

export type PlatformEvent =
  { type: 'achievement'; achievement: Achievement } | { type: 'level-up'; level: number };

const MEDAL_XP: Record<1 | 2 | 3, number> = { 1: 20, 2: 40, 3: 80 };

export const XP_RULES = {
  round: 10,
  shortRound: 3,
  newBest: 15,
  win: 10,
  daily: 100,
} as const;

export interface RecordRoundInput {
  meta: GameMeta;
  result: GameResult;
  mode: PlayMode;
  durationMs: number;
  daily: DailyChallenge | null;
  /** Coins picked up during the round (`api.addCoins`). */
  pickups?: number;
}

export type PurchaseResult =
  { ok: true } | { ok: false; reason: 'insufficient' | 'maxed' | 'unknown' | 'owned' | 'locked' };

/**
 * Wires every persistent service together and implements cross-cutting flows
 * (finishing a round, favorites, achievements). One instance per app; tests
 * create their own with a memory driver.
 */
export function createPlatform(driver: StorageDriver, options: PlatformOptions) {
  const now = options.now ?? Date.now;
  const games = options.games;
  const settings = createSettingsStore(driver);
  const player = createPlayerStore(driver);
  const stats = createStatsStore(driver);
  const favorites = createFavoritesStore(driver);
  const recent = createRecentStore(driver);
  const daily = createDailyStore(driver);
  const wallet = createWalletStore(driver);
  const loadouts = createLoadoutStore(driver);
  const achievements = new PersistentStore<Record<string, number>>(driver, {
    key: 'achievements',
    version: 1,
    schema: record(num({ min: 0 }), { maxKeys: 500 }),
    defaults: () => ({}),
  });
  const saves = new GameSaveService(driver, now);
  const analytics = new Analytics(now);
  const eventBuffer = createLocalBufferSink(driver);
  analytics.addSink(eventBuffer);
  if (options.debugAnalytics) analytics.addSink(consoleSink);

  const listeners = new Set<(e: PlatformEvent) => void>();
  const emit = (e: PlatformEvent) => listeners.forEach((l) => l(e));

  const snapshot = (): ProgressSnapshot => {
    const p = player.get();
    return {
      player: p,
      level: levelFromXp(p.xp),
      stats: stats.get(),
      favorites: favorites.get().length,
      daily: daily.get(),
      games,
    };
  };

  /** Unlocks any achievements now satisfied, awarding their XP (cascades, e.g. level achievements). */
  function evaluateAchievements(notify: boolean): Achievement[] {
    const unlockedNow: Achievement[] = [];
    for (let pass = 0; pass < 4; pass++) {
      const fresh = findNewlyUnlocked(snapshot(), achievements.get());
      if (fresh.length === 0) break;
      const at = now();
      achievements.set((prev) => ({ ...prev, ...Object.fromEntries(fresh.map((a) => [a.id, at])) }));
      const levelBefore = levelFromXp(player.get().xp);
      const gained = fresh.reduce((sum, a) => sum + a.xp, 0);
      player.set((prev) => ({ ...prev, xp: prev.xp + gained }));
      for (const a of fresh) analytics.track('achievement_unlocked', { achievementId: a.id });
      unlockedNow.push(...fresh);
      const levelAfter = levelFromXp(player.get().xp);
      if (notify) {
        fresh.forEach((a) => emit({ type: 'achievement', achievement: a }));
        if (levelAfter > levelBefore) emit({ type: 'level-up', level: levelAfter });
      }
    }
    return unlockedNow;
  }

  function todaysChallenge(dateKey = toDateKey(new Date(now()))): DailyChallenge | null {
    return getDailyChallenge(dateKey, games);
  }

  function recordRound(input: RecordRoundInput): RoundOutcome {
    const { meta, mode } = input;
    const t = now();
    const today = toDateKey(new Date(t));
    const score = Number.isFinite(input.result.score) ? input.result.score : 0;
    const won = input.result.won === true;
    const low = meta.score.lowerIsBetter === true;

    // ---- per-game stats
    const prev = stats.get()[meta.id] ?? emptyStats(t);
    const previousBest = prev.best;
    const best = isBetter(score, previousBest, low) ? score : (previousBest as number);
    const medalBefore = prev.medal;
    const medalAfter = Math.max(medalBefore, medalFor(best, meta)) as MedalTier;
    const pointsContribution =
      meta.score.format === 'points' ? Math.min(Math.max(0, score), meta.medals.gold * 2) : 0;
    stats.set((all) => ({
      ...all,
      [meta.id]: {
        plays: prev.plays + 1,
        best,
        last: score,
        totalScore: prev.totalScore + pointsContribution,
        wins: prev.wins + (won ? 1 : 0),
        medal: medalAfter,
        firstPlayedAt: prev.plays === 0 ? t : prev.firstPlayedAt,
        lastPlayedAt: t,
        timePlayedMs: prev.timePlayedMs + Math.max(0, Math.min(input.durationMs, 3_600_000)),
      },
    }));
    recent.touch(meta.id, t);

    const isNewBest = previousBest !== null && isBetter(score, previousBest, low);

    // ---- XP
    const xp: XpLine[] = [];
    const trivial = input.durationMs < 3000 && score === 0;
    xp.push({ label: 'Round played', xp: trivial ? XP_RULES.shortRound : XP_RULES.round });
    if (isNewBest) xp.push({ label: 'New personal best', xp: XP_RULES.newBest });
    for (let tier = medalBefore + 1; tier <= medalAfter; tier++) {
      const name = tier === 1 ? 'Bronze' : tier === 2 ? 'Silver' : 'Gold';
      xp.push({ label: `${name} medal unlocked`, xp: MEDAL_XP[tier as 1 | 2 | 3] });
    }
    if (won) xp.push({ label: 'Victory', xp: XP_RULES.win });

    // ---- daily challenge
    let dailyOutcome: RoundOutcome['daily'] = null;
    if (mode === 'daily' && input.daily && input.daily.gameId === meta.id) {
      const { state, outcome } = applyDailyAttempt(daily.get(), input.daily, score, low, t);
      daily.set(state);
      dailyOutcome = { target: input.daily.target, ...outcome };
      if (outcome.firstCompletion) {
        xp.push({ label: 'Daily challenge complete', xp: XP_RULES.daily });
        analytics.track('daily_challenge_completed', { gameId: meta.id, date: input.daily.date, score });
      }
    }

    // ---- coins
    const coins = coinsForRound({
      meta,
      score,
      won,
      trivial,
      isNewBest,
      medalBefore,
      medalAfter,
      pickups: input.pickups ?? 0,
      dailyFirstCompletion: dailyOutcome?.firstCompletion === true,
    });
    wallet.earn(coins.total);

    // ---- player totals
    const levelBefore = levelFromXp(player.get().xp);
    const roundXp = xp.reduce((sum, l) => sum + l.xp, 0);
    player.set((p) => ({
      ...p,
      xp: p.xp + roundXp,
      rounds: p.rounds + 1,
      wins: p.wins + (won ? 1 : 0),
      totalPoints: p.totalPoints + pointsContribution,
      recordsBroken: p.recordsBroken + (isNewBest ? 1 : 0),
      daysPlayed: p.lastDay === today ? p.daysPlayed : p.daysPlayed + 1,
      lastDay: today,
    }));

    const unlocked = evaluateAchievements(false);
    for (const a of unlocked) xp.push({ label: `Achievement: ${a.title}`, xp: a.xp });
    const levelAfter = levelFromXp(player.get().xp);
    if (levelAfter > levelBefore) analytics.track('level_up', { level: levelAfter });

    analytics.track('game_completed', {
      gameId: meta.id,
      mode,
      score,
      won,
      newBest: isNewBest,
      durationMs: Math.round(input.durationMs),
    });

    return {
      gameId: meta.id,
      mode,
      score,
      won,
      stats: input.result.stats ?? [],
      previousBest,
      best,
      isNewBest,
      medal: medalFor(score, meta),
      newMedal: medalAfter > medalBefore ? medalAfter : 0,
      xp,
      xpTotal: xp.reduce((sum, l) => sum + l.xp, 0),
      levelBefore,
      levelAfter,
      achievements: unlocked,
      daily: dailyOutcome,
      coins,
    };
  }

  // ---- shop
  function buyUpgrade(meta: GameMeta, upgradeId: string): PurchaseResult {
    const def = meta.shop?.upgrades.find((u) => u.id === upgradeId);
    if (!def) return { ok: false, reason: 'unknown' };
    const loadout = loadouts.of(meta.id, meta.shop);
    const level = loadout.upgrades[upgradeId] ?? 0;
    const cost = upgradeCost(def, level);
    if (cost === null) return { ok: false, reason: 'maxed' };
    if (!wallet.spend(cost)) return { ok: false, reason: 'insufficient' };
    loadouts.put(meta.id, { ...loadout, upgrades: { ...loadout.upgrades, [upgradeId]: level + 1 } });
    wallet.countPurchase();
    analytics.track('item_purchased', { gameId: meta.id, item: upgradeId, level: level + 1, cost });
    return { ok: true };
  }

  function buySkin(meta: GameMeta, skinId: string): PurchaseResult {
    const shop = meta.shop;
    const skin = shop?.skins.find((s) => s.id === skinId);
    if (!shop || !skin) return { ok: false, reason: 'unknown' };
    const loadout = loadouts.of(meta.id, shop);
    if (isSkinOwned(loadout, shop, skinId)) return { ok: false, reason: 'owned' };
    if (skin.adUnlock && skin.price === 0) return { ok: false, reason: 'locked' };
    if (!wallet.spend(skin.price)) return { ok: false, reason: 'insufficient' };
    loadouts.put(meta.id, { ...loadout, owned: [...loadout.owned, skinId], equipped: skinId });
    wallet.countPurchase();
    analytics.track('item_purchased', { gameId: meta.id, item: skinId, cost: skin.price });
    return { ok: true };
  }

  /** Counts one watched ad towards an ad-unlockable skin. Returns true when it just unlocked. */
  function progressSkinAd(meta: GameMeta, skinId: string): boolean {
    const shop = meta.shop;
    const skin = shop?.skins.find((s) => s.id === skinId);
    if (!shop || !skin?.adUnlock) return false;
    const loadout = loadouts.of(meta.id, shop);
    if (isSkinOwned(loadout, shop, skinId)) return false;
    const watched = (loadout.adProgress[skinId] ?? 0) + 1;
    const unlocked = watched >= skin.adUnlock;
    loadouts.put(meta.id, {
      ...loadout,
      adProgress: { ...loadout.adProgress, [skinId]: watched },
      owned: unlocked ? [...loadout.owned, skinId] : loadout.owned,
      equipped: unlocked ? skinId : loadout.equipped,
    });
    return unlocked;
  }

  function equipSkin(meta: GameMeta, skinId: string): boolean {
    const shop = meta.shop;
    if (!shop) return false;
    const loadout = loadouts.of(meta.id, shop);
    if (!isSkinOwned(loadout, shop, skinId)) return false;
    loadouts.put(meta.id, { ...loadout, equipped: skinId });
    return true;
  }

  function toggleFavorite(id: string): boolean {
    const on = favorites.toggle(id, now());
    analytics.track(on ? 'game_favorited' : 'game_unfavorited', { gameId: id });
    if (on) evaluateAchievements(true);
    return on;
  }

  const stores = { settings, player, stats, favorites, recent, daily, achievements, wallet, loadouts };

  /** Keys owned by the platform (used for sync, export and reset). */
  const storeByKey = new Map<string, PersistentStore<unknown>>(
    Object.values(stores).map((s) => [s.storageKey, s as unknown as PersistentStore<unknown>]),
  );

  function reloadAll(): void {
    for (const s of storeByKey.values()) s.reload();
    saves.rebuildIndex();
  }

  function resetAll(): void {
    for (const key of driver.keys()) if (key.startsWith(KEY_PREFIX)) driver.remove(key);
    eventBuffer.clear();
    for (const s of storeByKey.values()) s.reset();
    saves.rebuildIndex();
    // A fresh anonymous identity after a full reset.
    player.reload();
    player.set({ ...player.get() });
    analytics.track('progress_reset');
  }

  return {
    games,
    driver,
    ...stores,
    saves,
    analytics,
    eventBuffer,
    storeByKey,
    snapshot,
    recordRound,
    buyUpgrade,
    buySkin,
    progressSkinAd,
    equipSkin,
    toggleFavorite,
    evaluateAchievements,
    todaysChallenge,
    reloadAll,
    resetAll,
    on(listener: (e: PlatformEvent) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type Platform = ReturnType<typeof createPlatform>;
