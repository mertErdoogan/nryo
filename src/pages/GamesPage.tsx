import { useEffect, useMemo, useRef, useState } from 'react';
import { GAMES } from '../games/catalog';
import { navigate, useSearchParams } from '../app/router';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useFavorites, useRecent, useStats } from '../hooks/usePlatform';
import { CATEGORIES, getCategory, isCategory } from '../platform/categories';
import { newestGames, rankPopular, searchGames } from '../platform/discovery';
import { gamesMeta } from '../seo';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { GameGrid } from '../ui/GameList';
import { Icon } from '../ui/Icon';
import { EmptyState } from '../ui/Section';
import styles from './GamesPage.module.css';

type Filter = 'all' | 'new' | 'popular' | 'favorites';
type Sort = 'popular' | 'az' | 'new' | 'recent';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'new', label: 'Newest' },
  { value: 'recent', label: 'Recently played' },
  { value: 'az', label: 'A → Z' },
];

function buildUrl(params: { q?: string; category?: string | null; filter?: Filter; sort?: Sort }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.category) sp.set('category', params.category);
  if (params.filter && params.filter !== 'all') sp.set('filter', params.filter);
  if (params.sort && params.sort !== 'popular') sp.set('sort', params.sort);
  const s = sp.toString();
  return s ? `/games?${s}` : '/games';
}

export function GamesPage() {
  const params = useSearchParams();
  const categoryParam = params.get('category');
  const category = categoryParam && isCategory(categoryParam) ? categoryParam : null;
  const filterParam = params.get('filter');
  const filter: Filter =
    filterParam === 'new' || filterParam === 'popular' || filterParam === 'favorites' ? filterParam : 'all';
  const sortParam = params.get('sort') as Sort | null;
  const sort: Sort = SORTS.some((s) => s.value === sortParam) ? (sortParam as Sort) : 'popular';
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const pushedQuery = useRef(urlQuery);

  // Follow external URL changes (e.g. a search submitted from the header palette).
  useEffect(() => {
    if (urlQuery !== pushedQuery.current) {
      pushedQuery.current = urlQuery;
      setQuery(urlQuery);
    }
  }, [urlQuery]);

  const stats = useStats();
  const favorites = useFavorites();
  const recent = useRecent();

  const cat = category ? getCategory(category) : null;
  const meta = gamesMeta();
  useDocumentMeta(cat ? { ...meta, title: `${cat.label} Games — Nryo Arcade`, path: `/games?category=${cat.id}` } : meta);

  // Keep the URL in sync with the search box (replace, so Back isn't spammed).
  useEffect(() => {
    const t = setTimeout(() => {
      const q = query.trim();
      if (q !== urlQuery) {
        pushedQuery.current = q;
        navigate(buildUrl({ q, category, filter, sort }), { replace: true, keepScroll: true });
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, urlQuery, category, filter, sort]);

  const results = useMemo(() => {
    let list = query.trim() ? searchGames(query, GAMES) : [...GAMES];
    if (category) list = list.filter((g) => g.categories.includes(category));
    if (filter === 'new') {
      const ids = new Set(newestGames(GAMES).map((g) => g.id));
      list = list.filter((g) => ids.has(g.id));
    } else if (filter === 'favorites') {
      const ids = new Set(favorites.map((f) => f.id));
      list = list.filter((g) => ids.has(g.id));
    } else if (filter === 'popular') {
      const ids = new Set(rankPopular(GAMES, stats).slice(0, 12).map((g) => g.id));
      list = list.filter((g) => ids.has(g.id));
    }
    if (query.trim() && sort === 'popular') return list; // keep relevance order for searches
    switch (sort) {
      case 'az':
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case 'new':
        return list.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.title.localeCompare(b.title));
      case 'recent': {
        const order = new Map(recent.map((r, i) => [r.id, i]));
        return list.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999) || b.popularity - a.popularity);
      }
      default:
        return rankPopular(list, stats);
    }
  }, [query, category, filter, sort, stats, favorites, recent]);

  const setFilter = (next: { category?: string | null; filter?: Filter }) =>
    navigate(buildUrl({ q: query.trim(), category: next.category ?? null, filter: next.filter ?? 'all', sort }), {
      replace: true,
      keepScroll: true,
    });

  const heading = cat ? `${cat.emoji} ${cat.label} games` : filter === 'favorites' ? 'Your favorites' : 'All games';

  return (
    <div className="container">
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{heading}</h1>
          <span className={styles.count} aria-live="polite">
            {results.length} {results.length === 1 ? 'game' : 'games'}
          </span>
        </div>
        <div className={styles.controls}>
          <label className={styles.searchBox}>
            <Icon name="search" size={18} />
            <span className="visually-hidden">Search games</span>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Search: race, word, shoot, puzzle…"
              value={query}
              maxLength={60}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className={styles.clear} aria-label="Clear search" onClick={() => setQuery('')}>
                <Icon name="x" size={16} />
              </button>
            )}
          </label>
          <label>
            <span className="visually-hidden">Sort games</span>
            <select
              className={styles.select}
              value={sort}
              onChange={(e) =>
                navigate(buildUrl({ q: query.trim(), category, filter, sort: e.target.value as Sort }), {
                  replace: true,
                  keepScroll: true,
                })
              }
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.chips} role="group" aria-label="Filter games">
          <Chip active={!category && filter === 'all'} onClick={() => setFilter({})} count={GAMES.length}>
            All
          </Chip>
          <Chip active={filter === 'new'} onClick={() => setFilter({ filter: 'new' })}>
            ✨ New
          </Chip>
          <Chip active={filter === 'popular'} onClick={() => setFilter({ filter: 'popular' })}>
            🔥 Popular
          </Chip>
          <Chip active={filter === 'favorites'} onClick={() => setFilter({ filter: 'favorites' })} count={favorites.length}>
            ❤️ Favorites
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              active={category === c.id}
              onClick={() => setFilter({ category: category === c.id ? null : c.id })}
              count={GAMES.filter((g) => g.categories.includes(c.id)).length}
            >
              {c.emoji} {c.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className={styles.results}>
        {results.length > 0 ? (
          <GameGrid games={results} dense />
        ) : (
          <EmptyState
            icon={filter === 'favorites' ? '💔' : '🔍'}
            title={filter === 'favorites' ? 'No favorites here yet' : 'No games found'}
            action={
              <Button
                icon="restart"
                onClick={() => {
                  setQuery('');
                  navigate('/games', { replace: true });
                }}
              >
                Show all games
              </Button>
            }
          >
            {filter === 'favorites'
              ? 'Tap the heart on any game to keep it here.'
              : 'Try a shorter word like “race”, “word” or “puzzle”.'}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
