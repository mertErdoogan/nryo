/**
 * Coin economy rules. Pure functions so the numbers are easy to tune and test.
 *
 * The loop the numbers are built for: play a round → earn coins (double them
 * with an optional ad) → buy an upgrade or a skin → play again a little
 * stronger. Continues after a loss cost an ad or a growing number of coins.
 */
import type { CoinLine, GameMeta, MedalTier, SkinDef, UpgradeDef } from './types';

export const ECONOMY = {
  /** Base coins for any non-trivial round. */
  roundBase: 5,
  /** Extra coins for reaching the gold-medal score (scaled linearly, capped at 1.5× gold). */
  roundPerformance: 35,
  trivialRound: 1,
  win: 15,
  newBest: 20,
  perMedalTier: 25,
  dailyChallenge: 100,
  /** Coin price of the n-th continue in a round (0-based). */
  reviveCost: [120, 240, 400] as readonly number[],
  /** Rewarded "free coins" in the shop. */
  freeCoinsAmount: 40,
  freeCoinsPerDay: 5,
  /** Daily login reward by streak day (1-based, repeats the last value). */
  dailyRewards: [30, 40, 50, 60, 80, 100, 200] as readonly number[],
  defaultUpgradeGrowth: 1.6,
  defaultMaxRevives: 2,
} as const;

/** 0…1.5: how close a score is to the gold medal (inverted for lower-is-better games). */
export function performanceRatio(meta: Pick<GameMeta, 'medals' | 'score'>, score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  const gold = meta.medals.gold;
  if (gold <= 0) return 0;
  if (meta.score.lowerIsBetter) {
    // e.g. reaction time: bronze 350ms … gold 230ms. Anything at bronze is ~0.3.
    const bronze = meta.medals.bronze;
    if (score >= bronze * 1.6) return 0;
    const t = (bronze * 1.6 - score) / (bronze * 1.6 - gold);
    return Math.min(1.5, Math.max(0, t));
  }
  return Math.min(1.5, score / gold);
}

export interface RoundCoinsInput {
  meta: Pick<GameMeta, 'medals' | 'score'>;
  score: number;
  won: boolean;
  trivial: boolean;
  isNewBest: boolean;
  medalBefore: MedalTier;
  medalAfter: MedalTier;
  pickups: number;
  dailyFirstCompletion: boolean;
}

export function coinsForRound(input: RoundCoinsInput): { lines: CoinLine[]; total: number } {
  const lines: CoinLine[] = [];
  if (input.trivial) lines.push({ label: 'Round played', coins: ECONOMY.trivialRound });
  else
    lines.push({
      label: 'Round reward',
      coins:
        ECONOMY.roundBase + Math.round(ECONOMY.roundPerformance * performanceRatio(input.meta, input.score)),
    });
  const pickups = Math.max(0, Math.min(5000, Math.floor(input.pickups)));
  if (pickups > 0) lines.push({ label: 'Coins collected', coins: pickups });
  if (input.won) lines.push({ label: 'Victory bonus', coins: ECONOMY.win });
  if (input.isNewBest) lines.push({ label: 'New best bonus', coins: ECONOMY.newBest });
  const tiers = Math.max(0, input.medalAfter - input.medalBefore);
  if (tiers > 0) lines.push({ label: 'Medal bonus', coins: tiers * ECONOMY.perMedalTier });
  if (input.dailyFirstCompletion) lines.push({ label: 'Daily challenge', coins: ECONOMY.dailyChallenge });
  return { lines, total: lines.reduce((sum, l) => sum + l.coins, 0) };
}

/** Rounds a price to a friendly number (5s under 100, 10s under 1000, 50s above). */
export function nicePrice(value: number): number {
  const step = value < 100 ? 5 : value < 1000 ? 10 : 50;
  return Math.max(step, Math.round(value / step) * step);
}

/** Price of buying the next level when the upgrade is currently at `level`. Null when maxed. */
export function upgradeCost(def: UpgradeDef, level: number): number | null {
  if (level >= def.maxLevel) return null;
  return nicePrice(def.baseCost * (def.growth ?? ECONOMY.defaultUpgradeGrowth) ** level);
}

export function reviveCost(revivesUsed: number): number {
  const table = ECONOMY.reviveCost;
  return table[Math.min(revivesUsed, table.length - 1)]!;
}

export function dailyRewardFor(streakDay: number): number {
  const table = ECONOMY.dailyRewards;
  return table[Math.max(0, Math.min(streakDay, table.length) - 1)]!;
}

/** The skin a game falls back to when it has no shop. */
export const DEFAULT_SKIN: SkinDef = {
  id: 'default',
  name: 'Classic',
  price: 0,
  colors: ['#fbbf24', '#f97316', '#fef3c7'],
};
