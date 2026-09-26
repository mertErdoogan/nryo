import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { getGame } from '../games/catalog';
import { useDaily, useTodaysChallenge, useTodayKey } from '../hooks/usePlatform';
import { formatScore } from '../lib/format';
import { addDays, msUntilTomorrow, parseDateKey } from '../lib/date';
import { liveStreak } from '../platform/services/daily';
import { ButtonLink } from '../ui/Button';
import { Icon } from '../ui/Icon';
import styles from './DailyChallengeCard.module.css';

function useCountdown(): string {
  const [ms, setMs] = useState(() => msUntilTomorrow());
  useEffect(() => {
    const id = setInterval(() => setMs(msUntilTomorrow()), 30_000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function DailyChallengeCard() {
  const challenge = useTodaysChallenge();
  const daily = useDaily();
  const today = useTodayKey();
  const resetIn = useCountdown();
  if (!challenge) return null;
  const game = getGame(challenge.gameId);
  if (!game) return null;
  const record = daily.records[challenge.date];
  const done = !!record?.completedAt;
  const streak = liveStreak(daily, today);
  const low = game.score.lowerIsBetter;

  const style = {
    '--card-from': game.theme.from,
    '--card-to': game.theme.to,
    '--card-accent': game.theme.accent,
  } as CSSProperties;

  return (
    <section className={styles.card} style={style} aria-labelledby="daily-title">
      <div className={styles.top}>
        <span className={styles.kicker}>
          <Icon name="calendar" size={14} /> Daily challenge
        </span>
        {streak > 0 && (
          <span className={styles.streak} title="Daily streak">
            <Icon name="flame" size={14} /> {streak} day{streak === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className={styles.row}>
        <div
          className={styles.thumb}
          style={{ background: `linear-gradient(135deg, ${game.theme.from}, ${game.theme.to})` }}
        >
          {game.thumbnail && <img src={game.thumbnail} alt="" />}
        </div>
        <div className={styles.info}>
          <h2 className={styles.title} id="daily-title">
            {game.title}
          </h2>
          <p className={styles.goal}>
            {low ? 'Finish in' : 'Score'} <strong>{formatScore(challenge.target, game.score.format)}</strong>
            {low ? ' or less' : ' or more'} · same seed for everyone today
          </p>
        </div>
      </div>
      <ol className={styles.week} aria-label="Your last 7 days">
        {Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((key) => {
          const rec = daily.records[key];
          const state = rec?.completedAt ? 'done' : key === today ? 'today' : rec ? 'tried' : 'missed';
          const date = parseDateKey(key);
          const long = date?.toLocaleDateString(undefined, { weekday: 'long' }) ?? key;
          const label = { done: 'completed', today: 'today', tried: 'attempted', missed: 'not played' }[
            state
          ];
          return (
            <li key={key} className={styles.day} data-state={state}>
              <span className={styles.dayName} aria-hidden="true">
                {date?.toLocaleDateString(undefined, { weekday: 'narrow' })}
              </span>
              <span className={styles.dot} aria-hidden="true">
                {state === 'done' && <Icon name="check" size={12} />}
              </span>
              <span className="visually-hidden">{`${long}: ${label}`}</span>
            </li>
          );
        })}
      </ol>
      <div className={styles.status}>
        <div className={styles.meta}>
          {done ? (
            <span className={styles.done}>
              <Icon name="check" size={16} /> Completed
            </span>
          ) : (
            <span>
              Attempts <strong>{record?.attempts ?? 0}</strong>
            </span>
          )}
          {record?.best != null && (
            <span>
              Today’s best <strong>{formatScore(record.best, game.score.format)}</strong>
            </span>
          )}
        </div>
        <ButtonLink to={`/games/${game.id}?daily=1`} variant="primary" icon="play">
          {done ? 'Play again' : record ? 'Try again' : 'Play daily'}
        </ButtonLink>
      </div>
      <p className={styles.reset}>New challenge in {resetIn} · +100 XP on completion</p>
    </section>
  );
}
