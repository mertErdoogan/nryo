import type { GameMeta } from './platform/types';
import { CATEGORIES, getCategory } from './platform/categories';

/** Shared by the client (runtime <head> updates) and the build-time prerenderer. */
export const SITE_NAME = 'Nryo Arcade';
export const SITE_TAGLINE = 'Free browser games. No sign-up. Play instantly.';
export const SITE_DESCRIPTION =
  'Play 40+ free browser games instantly — arcade, puzzle, word, racing, strategy and more. No login, no downloads. Your scores and progress are saved right in your browser.';

export interface PageMeta {
  title: string;
  description: string;
  path: string;
  /** Structured data (JSON-LD) for crawlers. */
  jsonLd?: Record<string, unknown>;
}

export const homeMeta = (): PageMeta => ({
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  path: '/',
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
});

export const gamesMeta = (): PageMeta => ({
  title: `All Games — ${SITE_NAME}`,
  description: `Browse every game in ${SITE_NAME}: ${CATEGORIES.map((c) => c.label.toLowerCase()).join(', ')} games. Free, instant, no account.`,
  path: '/games',
});

export const categoriesMeta = (): PageMeta => ({
  title: `Game Categories — ${SITE_NAME}`,
  description: `Find your next favorite: ${CATEGORIES.map((c) => `${c.label} (${c.blurb.replace(/\.$/, '')})`).join(', ')}.`,
  path: '/categories',
});

export const favoritesMeta = (): PageMeta => ({
  title: `Your Favorites — ${SITE_NAME}`,
  description: 'Your favorite games, saved in this browser. One tap to play again.',
  path: '/favorites',
});

export const profileMeta = (): PageMeta => ({
  title: `Your Progress — ${SITE_NAME}`,
  description: 'Level, achievements, medals and personal bests — all stored locally, no account needed.',
  path: '/profile',
});

export const gameMeta = (game: GameMeta): PageMeta => {
  const cat = getCategory(game.categories[0]!);
  return {
    title: `${game.title} — Play free online | ${SITE_NAME}`,
    description: `${game.description} Free ${cat?.label.toLowerCase() ?? ''} game — no download, no sign-up.`.replace(/\s+/g, ' '),
    path: `/games/${game.id}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: game.title,
      description: game.description,
      genre: game.categories.map((c) => getCategory(c)?.label ?? c),
      gamePlatform: 'Web browser',
      applicationCategory: 'Game',
      operatingSystem: 'Any',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
  };
};

export const notFoundMeta = (): PageMeta => ({
  title: `Page not found — ${SITE_NAME}`,
  description: SITE_DESCRIPTION,
  path: '/404',
});
