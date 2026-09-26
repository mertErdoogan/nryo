import type { CSSProperties } from 'react';
import { memo } from 'react';
import { Link } from '../app/router';
import { getCategory } from '../platform/categories';
import { formatScore } from '../lib/format';
import type { GameEntry, GameStats } from '../platform/types';
import { Badge } from './Chip';
import { FavoriteButton } from './FavoriteButton';
import { Icon } from './Icon';
import { Medal } from './Medal';
import styles from './GameCard.module.css';

export interface GameCardProps {
  game: GameEntry;
  stats?: GameStats;
  isNew?: boolean;
  isHot?: boolean;
  isDaily?: boolean;
  compact?: boolean;
  /** Stagger index for the entrance animation. */
  index?: number;
  onOpen?: () => void;
}

export const GameCard = memo(function GameCard({
  game,
  stats,
  isNew,
  isHot,
  isDaily,
  compact,
  index = 0,
  onOpen,
}: GameCardProps) {
  const category = getCategory(game.categories[0]!);
  const style = {
    '--card-from': game.theme.from,
    '--card-to': game.theme.to,
    '--card-accent': game.theme.accent,
    animationDelay: `${Math.min(index, 12) * 30}ms`,
  } as CSSProperties;

  return (
    <article className={[styles.card, compact && styles.compact].filter(Boolean).join(' ')} style={style}>
      <div className={styles.thumb}>
        {game.thumbnail && (
          <img
            className={styles.art}
            src={game.thumbnail}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        )}
        <span className={styles.play} aria-hidden="true">
          <Icon name="play" size={24} />
        </span>
        <div className={styles.badges}>
          {isDaily && <Badge tone="daily">Daily</Badge>}
          {isNew && <Badge tone="new">New</Badge>}
          {isHot && !isNew && <Badge tone="hot">Hot</Badge>}
        </div>
      </div>
      <FavoriteButton gameId={game.id} title={game.title} className={styles.fav} />
      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link to={`/games/${game.id}`} className={styles.link} onClick={onOpen}>
            {game.title}
          </Link>
        </h3>
        <p className={styles.tagline}>{game.tagline}</p>
        <div className={styles.meta}>
          <span className={styles.category}>
            <span aria-hidden="true">{category?.emoji}</span> {category?.label}
          </span>
          {stats && stats.best !== null ? (
            <span className={styles.best} title="Your best">
              <Medal tier={stats.medal} size={16} />
              {formatScore(stats.best, game.score.format)}
            </span>
          ) : (
            <span className={styles.best}>{game.sessionLength}</span>
          )}
        </div>
      </div>
    </article>
  );
});
