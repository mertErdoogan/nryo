import type { CSSProperties } from 'react';
import { formatRelativeTime, formatScore } from '../lib/format';
import type { GameEntry, GameStats, SaveSummary } from '../platform/types';
import { ButtonLink } from '../ui/Button';
import { Medal } from '../ui/Medal';
import { ProgressBar } from '../ui/ProgressBar';
import { medalProgress } from '../platform/scoring';
import styles from './ContinueCard.module.css';

interface ContinueCardProps {
  game: GameEntry;
  /** Present when there is an unfinished round to resume. */
  save?: { summary: SaveSummary; updatedAt: number };
  stats?: GameStats;
  lastPlayedAt: number;
  index?: number;
}

export function ContinueCard({ game, save, stats, lastPlayedAt, index = 0 }: ContinueCardProps) {
  const style = {
    '--card-from': game.theme.from,
    '--card-to': game.theme.to,
    '--card-accent': game.theme.accent,
    animationDelay: `${index * 40}ms`,
  } as CSSProperties;
  const progress = save ? save.summary.progress : medalProgress(stats?.best ?? null, game);
  const label = save
    ? save.summary.label
    : stats?.best != null
      ? `Best ${formatScore(stats.best, game.score.format)}`
      : game.tagline;

  return (
    <article className={styles.card} style={style} aria-label={game.title}>
      <div className={styles.thumb}>
        {game.thumbnail && <img src={game.thumbnail} alt="" loading="lazy" />}
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{game.title}</h3>
        <p className={styles.label}>
          {!save && stats && <Medal tier={stats.medal} size={14} />} {label}
        </p>
        <p className={styles.when}>
          {save ? 'Saved' : 'Played'} {formatRelativeTime(save?.updatedAt ?? lastPlayedAt)}
        </p>
      </div>
      <div className={styles.bottom}>
        <ProgressBar
          className={styles.bar}
          value={progress}
          size="thin"
          label={save ? `${game.title} progress` : `${game.title} progress toward gold medal`}
        />
        <ButtonLink
          to={save ? `/games/${game.id}?continue=1` : `/games/${game.id}?autostart=1`}
          size="sm"
          variant={save ? 'primary' : 'secondary'}
          icon={save ? 'play' : 'restart'}
          label={save ? `Continue ${game.title}` : `Play ${game.title} again`}
        >
          {save ? 'Continue' : 'Play'}
        </ButtonLink>
      </div>
    </article>
  );
}
