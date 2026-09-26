import type { KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GAMES } from '../games/catalog';
import { useStats } from '../hooks/usePlatform';
import { platform } from '../platform';
import { CATEGORIES, getCategory } from '../platform/categories';
import { rankPopular, searchGames } from '../platform/discovery';
import { Chip } from '../ui/Chip';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { navigate } from './router';
import { setUi, useUi } from './ui-state';
import styles from './SearchPalette.module.css';

const QUICK = ['race', 'word', 'shoot', 'strategy', 'puzzle', 'memory'];

export function SearchPalette() {
  const { searchOpen } = useUi();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const stats = useStats();

  const results = useMemo(
    () => (query.trim() ? searchGames(query, GAMES) : rankPopular(GAMES, stats)).slice(0, 8),
    [query, stats],
  );

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [searchOpen]);

  const close = () => setUi({ searchOpen: false });
  const open = (id: string) => {
    if (query.trim()) platform.analytics.track('search_performed', { query: query.trim().slice(0, 40), results: results.length });
    close();
    navigate(`/games/${id}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      const pick = results[active];
      if (pick) open(pick.id);
      else if (query.trim()) {
        close();
        navigate(`/games?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  return (
    <Dialog open={searchOpen} onClose={close} title="Search games" hideTitle>
      <div className={styles.inputWrap}>
        <Icon name="search" />
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          value={query}
          placeholder="Search by name, category or tag"
          aria-label="Search games"
          aria-controls="search-results"
          aria-activedescendant={results[active] ? `search-${results[active].id}` : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={60}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {!query.trim() && (
        <>
          <p className={styles.hint}>Try</p>
          <div className={styles.chips}>
            {QUICK.map((q) => (
              <Chip key={q} onClick={() => setQuery(q)}>
                {q}
              </Chip>
            ))}
          </div>
        </>
      )}
      <p className={styles.hint}>{query.trim() ? `${results.length ? 'Results' : 'No results'}` : 'Popular right now'}</p>
      {results.length === 0 ? (
        <div className={styles.none}>
          Nothing matches “{query.trim()}”. Try a category:
          <div className={styles.chips} style={{ justifyContent: 'center', marginTop: 12 }}>
            {CATEGORIES.slice(0, 6).map((c) => (
              <Chip key={c.id} to={`/games?category=${c.id}`} onClick={close}>
                {c.emoji} {c.label}
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.results} role="listbox" id="search-results" aria-label="Games">
          {results.map((g, i) => (
            <a
              key={g.id}
              id={`search-${g.id}`}
              role="option"
              aria-selected={i === active}
              href={`/games/${g.id}`}
              className={styles.result}
              onMouseEnter={() => setActive(i)}
              onClick={(e) => {
                e.preventDefault();
                open(g.id);
              }}
            >
              <span className={styles.thumb} style={{ background: `linear-gradient(135deg, ${g.theme.from}, ${g.theme.to})` }}>
                {g.thumbnail && <img src={g.thumbnail} alt="" />}
              </span>
              <span className={styles.info}>
                <span className={styles.name}>{g.title}</span>
                <span className={styles.sub}>
                  {getCategory(g.categories[0]!)?.emoji} {getCategory(g.categories[0]!)?.label} · {g.tagline}
                </span>
              </span>
            </a>
          ))}
        </div>
      )}
    </Dialog>
  );
}
