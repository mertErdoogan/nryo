import type { CSSProperties } from 'react';
import { GAMES } from '../games/catalog';
import { Link } from '../app/router';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useStats } from '../hooks/usePlatform';
import { CATEGORIES } from '../platform/categories';
import { rankPopular } from '../platform/discovery';
import { categoriesMeta } from '../seo';
import { Icon } from '../ui/Icon';
import styles from './CategoriesPage.module.css';

export function CategoriesPage() {
  useDocumentMeta(categoriesMeta());
  const stats = useStats();
  return (
    <div className="container">
      <div className={styles.head}>
        <h1 className={styles.title}>Categories</h1>
        <p className={styles.sub}>Every kind of quick fun — pick a mood.</p>
      </div>
      <div className={styles.grid}>
        {CATEGORIES.map((c, i) => {
          const games = GAMES.filter((g) => g.categories.includes(c.id));
          const played = games.filter((g) => (stats[g.id]?.plays ?? 0) > 0).length;
          const top = rankPopular(games, stats).slice(0, 3);
          return (
            <article
              key={c.id}
              className={styles.tile}
              style={{ '--cat': c.color, animationDelay: `${i * 30}ms` } as CSSProperties}
            >
              <div className={styles.tileHead}>
                <span className={styles.emoji} aria-hidden="true">
                  {c.emoji}
                </span>
                <div>
                  <h2 className={styles.name}>
                    <Link to={`/games?category=${c.id}`} className={styles.link}>
                      {c.label}
                    </Link>
                  </h2>
                  <p className={styles.blurb}>{c.blurb}</p>
                </div>
              </div>
              <div className={styles.thumbs} aria-hidden="true">
                {top.map((g) => (
                  <div
                    key={g.id}
                    className={styles.thumb}
                    style={{ background: `linear-gradient(135deg, ${g.theme.from}, ${g.theme.to})` }}
                  >
                    {g.thumbnail && <img src={g.thumbnail} alt="" loading="lazy" />}
                  </div>
                ))}
              </div>
              <div className={styles.foot}>
                <span>
                  <strong>{games.length}</strong> games · {played} played
                </span>
                <Icon name="forward" size={18} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
