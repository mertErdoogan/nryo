import { hashString } from '../lib/rng';
import { normalizeQuery } from '../lib/sanitize';
import { getCategory } from './categories';
import type { GameMeta, GameStats, RecentEntry } from './types';

const DAY = 86_400_000;

/**
 * Popularity model: curated base score (editorial ranking) plus this
 * browser's own engagement — games you come back to rise, and recently
 * played games get a short-lived boost.
 */
export function popularityScore(meta: GameMeta, stats: GameStats | undefined, now = Date.now()): number {
  let score = meta.popularity;
  if (stats && stats.plays > 0) {
    score += Math.min(18, Math.log2(1 + stats.plays) * 5);
    const ageDays = (now - stats.lastPlayedAt) / DAY;
    score += Math.max(0, 6 - ageDays);
  }
  return score;
}

export function rankPopular<T extends GameMeta>(games: readonly T[], stats: Record<string, GameStats>, now = Date.now()): T[] {
  return [...games].sort(
    (a, b) => popularityScore(b, stats[b.id], now) - popularityScore(a, stats[a.id], now) || a.id.localeCompare(b.id),
  );
}

export function newestGames<T extends GameMeta>(games: readonly T[], count = 8): T[] {
  return [...games].sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.id.localeCompare(b.id)).slice(0, count);
}

export function isNewGame(meta: GameMeta, games: readonly GameMeta[]): boolean {
  return newestGames(games).some((g) => g.id === meta.id);
}

function similarity(a: GameMeta, b: GameMeta): number {
  let score = 0;
  if (a.categories[0] === b.categories[0]) score += 4;
  for (const c of a.categories) if (b.categories.includes(c)) score += 2;
  for (const t of a.tags) if (b.tags.includes(t)) score += 1;
  if (a.difficulty === b.difficulty) score += 0.5;
  return score;
}

/**
 * Related games for "Try another game": category/tag similarity, nudged by
 * popularity, with a bonus for games the player hasn't discovered yet.
 */
export function recommend<T extends GameMeta>(
  current: GameMeta,
  games: readonly T[],
  stats: Record<string, GameStats>,
  count = 3,
): T[] {
  return games
    .filter((g) => g.id !== current.id)
    .map((g) => {
      const played = (stats[g.id]?.plays ?? 0) > 0;
      const score = similarity(current, g) + g.popularity / 40 + (played ? 0 : 1.5);
      return { g, score };
    })
    .sort((a, b) => b.score - a.score || a.g.id.localeCompare(b.g.id))
    .slice(0, count)
    .map((x) => x.g);
}

/** Suggestions for the home page based on what the player enjoys most. */
export function recommendForPlayer<T extends GameMeta>(
  games: readonly T[],
  stats: Record<string, GameStats>,
  recent: readonly RecentEntry[],
  count = 6,
): T[] {
  const played = recent.map((r) => games.find((g) => g.id === r.id)).filter((g): g is T => !!g);
  if (played.length === 0) return rankPopular(games, stats).slice(0, count);
  const seen = new Set(played.map((g) => g.id));
  return games
    .filter((g) => !seen.has(g.id))
    .map((g) => ({
      g,
      score: played.slice(0, 5).reduce((sum, p, i) => sum + similarity(p, g) / (i + 1), 0) + g.popularity / 30,
    }))
    .sort((a, b) => b.score - a.score || a.g.id.localeCompare(b.g.id))
    .slice(0, count)
    .map((x) => x.g);
}

/** Rotates the "Play Now" shelf daily among the top of the catalog. */
export function featuredForDay<T extends GameMeta>(games: readonly T[], dateKey: string, count = 6): T[] {
  const pool = [...games].sort((a, b) => b.popularity - a.popularity || a.id.localeCompare(b.id)).slice(0, 24);
  return pool
    .map((g) => ({ g, k: hashString(`${dateKey}:${g.id}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, count)
    .map((x) => x.g);
}

function tokenMatches(token: string, word: string): number {
  if (word === token) return 3;
  if (word.startsWith(token)) return 2;
  if (token.length >= 4 && word.includes(token)) return 1;
  if (token.length >= 4 && word.length >= 4 && token.slice(0, 4) === word.slice(0, 4)) return 1;
  return 0;
}

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Fast in-memory search over title, categories, tags and description. */
export function searchGames<T extends GameMeta>(rawQuery: string, games: readonly T[]): T[] {
  const query = normalizeQuery(rawQuery);
  if (!query) return [...games];
  const tokens = words(query);
  if (tokens.length === 0) return [];
  const results: { g: T; score: number }[] = [];
  for (const g of games) {
    const fields: [string[], number][] = [
      [words(g.title), 6],
      [g.categories.flatMap((c) => [c, ...words(getCategory(c)?.label ?? '')]), 4],
      [g.tags.flatMap(words), 3],
      [words(g.tagline), 1.5],
      [words(g.description), 1],
    ];
    let total = 0;
    let allMatched = true;
    for (const token of tokens) {
      let best = 0;
      for (const [list, weight] of fields) {
        for (const w of list) best = Math.max(best, tokenMatches(token, w) * weight);
      }
      if (best === 0) allMatched = false;
      total += best;
    }
    if (allMatched && total > 0) results.push({ g, score: total + g.popularity / 100 });
  }
  return results.sort((a, b) => b.score - a.score || a.g.title.localeCompare(b.g.title)).map((r) => r.g);
}
