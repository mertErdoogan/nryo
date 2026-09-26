import { useMemo } from 'react';
import { GAMES } from '../games/catalog';
import { usePlayer, useStats } from '../hooks/usePlatform';
import { formatScore } from '../lib/format';
import { getCategory } from '../platform/categories';
import { recommend } from '../platform/discovery';
import { getLeaderboard } from '../platform/rivals';
import { MEDAL_NAMES } from '../platform/scoring';
import type { GameEntry } from '../platform/types';
import { GameGrid } from '../ui/GameList';
import { Medal } from '../ui/Medal';
import { Section } from '../ui/Section';
import styles from './GameInfo.module.css';

const DIFFICULTY_LABEL = { easy: 'Easy to learn', medium: 'Moderate', hard: 'Challenging' } as const;

export function GameInfo({ game }: { game: GameEntry }) {
  const stats = useStats();
  const player = usePlayer();
  const mine = stats[game.id];
  const fmt = (v: number) => formatScore(v, game.score.format);
  const related = useMemo(() => recommend(game, GAMES, stats, 4), [game, stats]);
  const board = useMemo(
    () => getLeaderboard(game, mine?.best ?? null, player.nickname || 'You'),
    [game, mine?.best, player.nickname],
  );
  const cmp = game.score.lowerIsBetter ? '≤' : '≥';

  return (
    <div className={`container ${styles.info}`}>
      <div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="about-title">
          <h2 className={styles.title} id="about-title">
            About {game.title}
          </h2>
          <p className={styles.desc}>{game.description}</p>
          <div className={styles.tags}>
            {game.categories.map((c) => (
              <span key={c} className={styles.tag}>
                {getCategory(c)?.emoji} {getCategory(c)?.label}
              </span>
            ))}
            {game.tags.slice(0, 5).map((t) => (
              <span key={t} className={styles.tag}>
                #{t}
              </span>
            ))}
          </div>
          <div className={styles.facts}>
            <div className={styles.fact}>
              <span className={styles.factLabel}>Keyboard & mouse</span>
              <span className={styles.factValue}>{game.controls.desktop}</span>
            </div>
            <div className={styles.fact}>
              <span className={styles.factLabel}>Touch</span>
              <span className={styles.factValue}>{game.controls.touch}</span>
            </div>
            <div className={styles.fact}>
              <span className={styles.factLabel}>Round length</span>
              <span className={styles.factValue}>{game.sessionLength}</span>
            </div>
            <div className={styles.fact}>
              <span className={styles.factLabel}>Difficulty</span>
              <span className={styles.factValue}>{DIFFICULTY_LABEL[game.difficulty]}</span>
            </div>
            {mine && (
              <div className={styles.fact}>
                <span className={styles.factLabel}>Your rounds</span>
                <span className={styles.factValue}>{mine.plays}</span>
              </div>
            )}
          </div>
          <h3 className={styles.title}>Medals</h3>
          <div className={styles.medals}>
            {([3, 2, 1] as const).map((tier) => {
              const threshold = tier === 3 ? game.medals.gold : tier === 2 ? game.medals.silver : game.medals.bronze;
              const earned = (mine?.medal ?? 0) >= tier;
              return (
                <div key={tier} className={styles.medalRow} data-earned={earned}>
                  <Medal tier={tier} size={24} />
                  <span>
                    {MEDAL_NAMES[tier]} {cmp} {fmt(threshold)}
                  </span>
                  <span>{earned ? 'Earned ✓' : 'Locked'}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className={styles.panel} aria-labelledby="board-title">
          <h2 className={styles.title} id="board-title">
            Arcade bots leaderboard
          </h2>
          <ol className={styles.board}>
            {board.map((e, i) => (
              <li key={`${e.name}-${i}`} className={styles.row} data-player={e.isPlayer}>
                <span className={styles.rank}>{i + 1}</span>
                <span>
                  {e.name}
                  {!e.isPlayer && <span className={styles.bot}>BOT</span>}
                </span>
                <span>{fmt(e.score)}</span>
              </li>
            ))}
          </ol>
          <p className={styles.note}>
            Bots are local AI benchmarks to chase — no data leaves your browser. Your best score is saved on this device.
          </p>
        </section>
      </div>
      <Section id="related" title="More like this" emoji="🎮">
        <GameGrid games={related} />
      </Section>
    </div>
  );
}
