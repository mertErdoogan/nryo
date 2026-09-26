import { describe, expect, it } from 'vitest';
import { makeMeta } from '../../test/fixtures';
import { initialPacing, noteRound, PACING, shouldShowInterstitial } from '../ads/policy';
import {
  coinsForRound,
  dailyRewardFor,
  ECONOMY,
  nicePrice,
  performanceRatio,
  reviveCost,
  upgradeCost,
} from '../economy';
import { createPlatform } from '../platform';
import { resolveLoadout, toActiveLoadout } from '../services/loadouts';
import { affordableCount } from '../shop';
import { createMemoryDriver } from '../storage/driver';
import type { GameShop } from '../types';

const shop: GameShop = {
  title: 'Garage',
  icon: '🏎️',
  upgrades: [
    { id: 'engine', name: 'Engine', icon: '⚙️', description: '+speed', maxLevel: 3, baseCost: 100 },
    { id: 'nitro', name: 'Nitro', icon: '🔥', description: '+boost', maxLevel: 2, baseCost: 50, growth: 2 },
  ],
  skins: [
    { id: 'basic', name: 'Basic', price: 0, colors: ['#fff', '#000', '#f00'] },
    { id: 'sport', name: 'Sport', price: 300, colors: ['#f00', '#000', '#fff'] },
    { id: 'gold', name: 'Gold', price: 0, adUnlock: 2, colors: ['#fc0', '#000', '#fff'] },
  ],
};
const meta = makeMeta({ id: 'racer', medals: { bronze: 100, silver: 200, gold: 400 }, shop });
const reflex = makeMeta({
  id: 'reflex',
  score: { label: 'ms', format: 'ms', lowerIsBetter: true },
  medals: { bronze: 350, silver: 280, gold: 230 },
});

function setup() {
  const driver = createMemoryDriver();
  const platform = createPlatform(driver, {
    games: [meta, reflex],
    now: () => new Date(2026, 8, 26).getTime(),
  });
  return { platform, driver };
}

describe('economy rules', () => {
  it('scales round rewards with performance and caps them', () => {
    expect(performanceRatio(meta, 0)).toBe(0);
    expect(performanceRatio(meta, 200)).toBeCloseTo(0.5);
    expect(performanceRatio(meta, 10_000)).toBe(1.5);
    expect(performanceRatio(reflex, 230)).toBeCloseTo(1);
    expect(performanceRatio(reflex, 180)).toBeGreaterThan(1);
    expect(performanceRatio(reflex, 900)).toBe(0);
  });

  it('builds coin lines for a round', () => {
    const r = coinsForRound({
      meta,
      score: 400,
      won: true,
      trivial: false,
      isNewBest: true,
      medalBefore: 1,
      medalAfter: 3,
      pickups: 12,
      dailyFirstCompletion: false,
    });
    expect(r.lines.map((l) => l.label)).toEqual([
      'Round reward',
      'Coins collected',
      'Victory bonus',
      'New best bonus',
      'Medal bonus',
    ]);
    expect(r.total).toBe(
      ECONOMY.roundBase +
        ECONOMY.roundPerformance +
        12 +
        ECONOMY.win +
        ECONOMY.newBest +
        2 * ECONOMY.perMedalTier,
    );
    const trivial = coinsForRound({
      meta,
      score: 0,
      won: false,
      trivial: true,
      isNewBest: false,
      medalBefore: 0,
      medalAfter: 0,
      pickups: -5,
      dailyFirstCompletion: false,
    });
    expect(trivial.total).toBe(ECONOMY.trivialRound);
  });

  it('prices upgrades on a friendly geometric ladder', () => {
    const engine = shop.upgrades[0]!;
    expect(upgradeCost(engine, 0)).toBe(100);
    expect(upgradeCost(engine, 1)).toBe(160);
    expect(upgradeCost(engine, 2)).toBe(260);
    expect(upgradeCost(engine, 3)).toBeNull();
    expect(nicePrice(1234)).toBe(1250);
    expect(nicePrice(1)).toBe(5);
  });

  it('escalates continue prices and daily rewards', () => {
    expect(reviveCost(0)).toBeLessThan(reviveCost(1));
    expect(reviveCost(99)).toBe(ECONOMY.reviveCost.at(-1));
    expect(dailyRewardFor(1)).toBe(ECONOMY.dailyRewards[0]);
    expect(dailyRewardFor(30)).toBe(ECONOMY.dailyRewards.at(-1));
  });
});

describe('ad pacing', () => {
  it('never shows an interstitial early, too often, or right after a rewarded ad', () => {
    let s = initialPacing();
    const t = 1_000_000;
    s = noteRound(s, 5_000); // too short to count
    expect(s.rounds).toBe(0);
    for (let i = 0; i < PACING.minRoundsBeforeFirst; i++) s = noteRound(s, 60_000);
    expect(shouldShowInterstitial(s, t)).toBe(true);
    expect(shouldShowInterstitial({ ...s, lastInterstitialAt: t - 10_000 }, t)).toBe(false);
    expect(shouldShowInterstitial({ ...s, lastRewardedAt: t - 10_000 }, t)).toBe(false);
    expect(shouldShowInterstitial({ ...s, lastInterstitialAt: t - PACING.minIntervalMs }, t)).toBe(true);
  });
});

describe('wallet', () => {
  it('earns coins from rounds and never goes negative', () => {
    const { platform } = setup();
    const out = platform.recordRound({
      meta,
      result: { score: 400 },
      mode: 'normal',
      durationMs: 60_000,
      daily: null,
      pickups: 7,
    });
    expect(out.coins.total).toBeGreaterThan(40);
    expect(platform.wallet.get().coins).toBe(out.coins.total);
    expect(platform.wallet.spend(1_000_000)).toBe(false);
    expect(platform.wallet.get().coins).toBe(out.coins.total);
  });

  it('pays the daily reward once per day and grows the streak', () => {
    const { platform } = setup();
    expect(platform.wallet.claimDaily('2026-09-26')).toBe(ECONOMY.dailyRewards[0]);
    expect(platform.wallet.claimDaily('2026-09-26')).toBe(0);
    expect(platform.wallet.dailyStatus('2026-09-27')).toMatchObject({ available: true, day: 2 });
    expect(platform.wallet.claimDaily('2026-09-27', 2)).toBe(ECONOMY.dailyRewards[1]! * 2);
    // Missing a day resets the streak.
    expect(platform.wallet.dailyStatus('2026-09-29').day).toBe(1);
  });

  it('caps rewarded free coins per day', () => {
    const { platform } = setup();
    for (let i = 0; i < ECONOMY.freeCoinsPerDay; i++)
      expect(platform.wallet.grantFreeCoins('2026-09-26')).toBe(40);
    expect(platform.wallet.grantFreeCoins('2026-09-26')).toBe(0);
    expect(platform.wallet.freeCoinsLeft('2026-09-27')).toBe(ECONOMY.freeCoinsPerDay);
  });

  it('repairs a partially corrupted wallet instead of wiping it', () => {
    const driver = createMemoryDriver({
      'nryo:wallet': JSON.stringify({ v: 1, d: { coins: 250, earned: 'lots', spent: -3 } }),
    });
    const platform = createPlatform(driver, { games: [meta] });
    expect(platform.wallet.get().coins).toBe(250);
    expect(platform.wallet.get().earned).toBe(0);
  });
});

describe('shop', () => {
  it('buys upgrades up to the max level and charges the ladder price', () => {
    const { platform } = setup();
    platform.wallet.earn(1000);
    expect(platform.buyUpgrade(meta, 'engine')).toEqual({ ok: true });
    expect(platform.buyUpgrade(meta, 'engine')).toEqual({ ok: true });
    expect(platform.buyUpgrade(meta, 'engine')).toEqual({ ok: true });
    expect(platform.buyUpgrade(meta, 'engine')).toEqual({ ok: false, reason: 'maxed' });
    expect(platform.wallet.get().coins).toBe(1000 - 100 - 160 - 260);
    expect(platform.buyUpgrade(meta, 'nope')).toEqual({ ok: false, reason: 'unknown' });
    const active = toActiveLoadout(platform.loadouts.of(meta.id, shop), shop);
    expect(active.level('engine')).toBe(3);
    expect(active.level('nitro')).toBe(0);
  });

  it('refuses purchases the player cannot afford', () => {
    const { platform } = setup();
    expect(platform.buySkin(meta, 'sport')).toEqual({ ok: false, reason: 'insufficient' });
    platform.wallet.earn(300);
    expect(affordableCount(shop, platform.loadouts.of(meta.id, shop), 300)).toBe(3);
    expect(platform.buySkin(meta, 'sport')).toEqual({ ok: true });
    expect(platform.loadouts.of(meta.id, shop).equipped).toBe('sport');
    expect(platform.buySkin(meta, 'sport')).toEqual({ ok: false, reason: 'owned' });
    expect(platform.equipSkin(meta, 'basic')).toBe(true);
    expect(platform.equipSkin(meta, 'gold')).toBe(false);
  });

  it('unlocks ad skins after enough rewarded views', () => {
    const { platform } = setup();
    expect(platform.buySkin(meta, 'gold')).toEqual({ ok: false, reason: 'locked' });
    expect(platform.progressSkinAd(meta, 'gold')).toBe(false);
    expect(platform.progressSkinAd(meta, 'gold')).toBe(true);
    expect(platform.loadouts.of(meta.id, shop).equipped).toBe('gold');
  });

  it('normalises stale loadouts against the current shop', () => {
    const l = resolveLoadout(
      { upgrades: { engine: 99, removed: 2 }, owned: ['gone'], equipped: 'gone', adProgress: {} },
      shop,
    );
    expect(l.upgrades).toEqual({ engine: 3 });
    expect(l.owned).toEqual([]);
    expect(l.equipped).toBe('basic');
    expect(toActiveLoadout(l, undefined).skin.id).toBe('default');
  });
});
