import { useEffect, useMemo, useRef, useState } from 'react';
import { GAMES } from '../games/catalog';
import { Link } from '../app/router';
import { useLoadouts, usePlayer, useStats, useWallet } from '../hooks/usePlatform';
import { rewardedAvailable, showRewarded } from '../platform/ads';
import { resolveLoadout } from '../platform/services/loadouts';
import { affordableCount, cheapestItem } from '../platform/shop';
import { CoinAmount } from '../ui/Coins';
import { formatScore } from '../lib/format';
import { platform } from '../platform';
import { recommend } from '../platform/discovery';
import { getLeaderboard, nextRival } from '../platform/rivals';
import { MEDAL_NAMES, medalProgress, nextMedal } from '../platform/scoring';
import { levelProgress } from '../platform/services/levels';
import type { GameEntry, RoundOutcome } from '../platform/types';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Medal } from '../ui/Medal';
import { ProgressBar } from '../ui/ProgressBar';
import styles from './Shell.module.css';

function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce =
      document.documentElement.dataset.motion === 'reduce' ||
      (document.documentElement.dataset.motion !== 'full' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    if (reduce || target === 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

interface ResultsOverlayProps {
  game: GameEntry;
  outcome: RoundOutcome;
  onPlayAgain: () => void;
  onExit: () => void;
  onShop?: () => void;
}

/** Coins earned this round, with the optional "watch an ad to double" offer. */
function CoinReward({ outcome, gameId }: { outcome: RoundOutcome; gameId: string }) {
  const [doubled, setDoubled] = useState(false);
  const [busy, setBusy] = useState(false);
  const total = outcome.coins.total;
  const canDouble = total > 0 && !doubled && rewardedAvailable();
  const double = async () => {
    setBusy(true);
    const result = await showRewarded('double-coins', `+${total} coins`);
    setBusy(false);
    if (result === 'rewarded') {
      platform.wallet.earn(total);
      platform.analytics.track('coins_doubled', { gameId, coins: total });
      setDoubled(true);
    }
  };
  return (
    <div className={`${styles.card} ${styles.cardWide} ${styles.coinCard}`}>
      <span className={styles.cardLabel}>Coins earned</span>
      <span className={styles.cardValue}>
        <CoinAmount value={doubled ? total * 2 : total} sign size={22} className={styles.coinTotal} />
        {doubled && <span className={styles.cardNote}>· doubled!</span>}
      </span>
      <span className={styles.coinLines}>
        {outcome.coins.lines.map((l) => (
          <span key={l.label}>
            {l.label} +{l.coins}
          </span>
        ))}
      </span>
      {canDouble && (
        <div className={styles.coinActions}>
          <Button
            size="sm"
            variant="primary"
            icon="play"
            disabled={busy}
            onClick={() => void double()}
            data-testid="double-coins"
          >
            Watch ad · double to {total * 2}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ResultsOverlay({ game, outcome, onPlayAgain, onExit, onShop }: ResultsOverlayProps) {
  const wallet = useWallet();
  const loadouts = useLoadouts();
  const loadout = resolveLoadout(loadouts[game.id], game.shop);
  const affordable = affordableCount(game.shop, loadout, wallet.coins);
  const nextPrice = cheapestItem(game.shop, loadout);
  const again = useRef<HTMLButtonElement>(null);
  const player = usePlayer();
  const stats = useStats();
  const shown = useCountUp(outcome.score);
  const fmt = (v: number) => formatScore(v, game.score.format);
  const precise = game.score.format === 'ms' || game.score.format === 'time';

  useEffect(() => {
    // Delay focus a little so a key still held from gameplay can't instantly restart.
    const t = setTimeout(() => again.current?.focus({ preventScroll: true }), 350);
    return () => clearTimeout(t);
  }, []);

  const recs = useMemo(() => recommend(game, GAMES, stats, 3), [game, stats]);
  const name = player.nickname || 'You';
  const board = useMemo(() => getLeaderboard(game, outcome.best, name), [game, outcome.best, name]);
  const rank = board.findIndex((e) => e.isPlayer) + 1;
  const rival = nextRival(board);
  const passed = useMemo(() => {
    if (!outcome.isNewBest || outcome.previousBest === null) return 0;
    const before = getLeaderboard(game, outcome.previousBest, name).findIndex((e) => e.isPlayer);
    return Math.max(0, before - (rank - 1));
  }, [game, outcome, name, rank]);

  const next = nextMedal(outcome.best, game);
  const level = levelProgress(player.xp);
  const leveledUp = outcome.levelAfter > outcome.levelBefore;

  let kicker = outcome.won ? 'Victory!' : 'Game over';
  if (outcome.daily?.firstCompletion) kicker = 'Daily challenge complete!';
  else if (outcome.isNewBest) kicker = 'New personal best!';
  else if (outcome.previousBest === null) kicker = outcome.won ? 'Victory!' : 'First score on the board!';

  return (
    <div
      className={styles.overlay}
      data-game-overlay
      data-testid="results-overlay"
      role="dialog"
      aria-label="Results"
    >
      <div className={`${styles.panel} ${styles.results}`}>
        <p
          className={styles.resultKicker}
          data-best={outcome.isNewBest || outcome.daily?.firstCompletion === true}
        >
          {kicker}
        </p>
        <div className={styles.scoreHero}>
          <span
            className={styles.scoreBig}
            data-testid="result-score"
            aria-label={`Your score: ${fmt(outcome.score)}`}
          >
            {precise ? fmt(outcome.score) : fmt(Math.round(shown))}
          </span>
          <span className={styles.scoreSub}>{game.score.label}</span>
        </div>
        {outcome.isNewBest && (
          <span className={styles.newBest}>
            <Icon name="star" size={16} /> New best
            {outcome.previousBest !== null && ` · was ${fmt(outcome.previousBest)}`}
          </span>
        )}
        {outcome.stats.length > 0 && (
          <div className={styles.statLines}>
            {outcome.stats.map((s) => (
              <span key={s.label} className={styles.pill}>
                {s.label} <strong>{s.value}</strong>
              </span>
            ))}
          </div>
        )}

        <div className={styles.cards}>
          <CoinReward outcome={outcome} gameId={game.id} />
          <div className={styles.card}>
            <span className={styles.cardLabel}>Your score</span>
            <span className={styles.cardValue}>{fmt(outcome.score)}</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Best score</span>
            <span className={styles.cardValue} data-testid="result-best">
              <Medal tier={stats[game.id]?.medal ?? 0} size={18} />
              {fmt(outcome.best)}
            </span>
          </div>
          <div className={`${styles.card} ${styles.cardWide}`}>
            <span className={styles.cardLabel}>
              {outcome.newMedal > 0 ? `${MEDAL_NAMES[outcome.newMedal]} medal unlocked!` : 'Medal progress'}
            </span>
            <ProgressBar value={medalProgress(outcome.best, game)} label="Progress toward gold" />
            <span className={styles.cardNote}>
              {next
                ? `Next: ${MEDAL_NAMES[next.tier]} at ${fmt(next.threshold)}`
                : 'Gold secured — you’ve mastered this one.'}
            </span>
          </div>
          {outcome.daily && (
            <div className={`${styles.card} ${styles.cardWide}`}>
              <span className={styles.cardLabel}>Daily challenge</span>
              <span className={styles.cardValue}>
                {outcome.daily.completed ? (
                  <>
                    <Icon name="check" size={18} /> Target {fmt(outcome.daily.target)} reached · 🔥{' '}
                    {outcome.daily.streak} day streak
                  </>
                ) : (
                  <>Target {fmt(outcome.daily.target)} — keep trying!</>
                )}
              </span>
            </div>
          )}
          <div className={`${styles.card} ${styles.cardWide}`}>
            <span className={styles.cardLabel}>Arcade bots leaderboard</span>
            <span className={styles.cardValue}>
              #{rank} of {board.length}
              {passed > 0 && (
                <span className={styles.cardNote}>
                  · passed {passed} bot{passed > 1 ? 's' : ''}
                </span>
              )}
            </span>
            <span className={styles.cardNote}>
              {rival
                ? `Next up: ${rival.name} (bot) at ${fmt(rival.score)}`
                : 'You’re at the top of the board!'}
            </span>
          </div>
          <div className={`${styles.card} ${styles.cardWide}`}>
            <span className={styles.cardLabel}>+{outcome.xpTotal} XP</span>
            <div className={styles.xpList}>
              {outcome.xp.map((line) => (
                <div key={line.label} className={styles.xpLine}>
                  <span>{line.label}</span>
                  <span>+{line.xp}</span>
                </div>
              ))}
            </div>
            <ProgressBar value={level.ratio} label="Level progress" size="thin" />
            <span className={styles.cardNote}>
              {leveledUp ? (
                <span className={styles.levelUp}>Level up! You’re now level {outcome.levelAfter}.</span>
              ) : (
                `Level ${level.level} · ${level.needed - level.current} XP to next`
              )}
            </span>
          </div>
        </div>

        {outcome.achievements.length > 0 && (
          <div className={styles.achievements} aria-label="Achievements unlocked">
            {outcome.achievements.map((a) => (
              <span key={a.id} className={styles.achievement}>
                {a.icon} {a.title}
              </span>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <Button
            ref={again}
            variant="primary"
            size="lg"
            icon="restart"
            onClick={onPlayAgain}
            data-testid="play-again"
          >
            Play Again
          </Button>
          {onShop && game.shop && (
            <Button size="lg" onClick={onShop} data-testid="results-shop">
              <span aria-hidden="true">{game.shop.icon}</span> {game.shop.title}
              {affordable > 0 && <span className={styles.shopBadge}>{affordable}</span>}
            </Button>
          )}
          <Button size="lg" icon="home" onClick={onExit}>
            Exit
          </Button>
        </div>
        {onShop && game.shop && (
          <p className={styles.hint}>
            {affordable > 0
              ? `You can afford ${affordable} upgrade${affordable > 1 ? 's' : ''} — get stronger before the next run!`
              : nextPrice !== null
                ? `Next upgrade at ${nextPrice} coins · you have ${wallet.coins}`
                : 'Everything unlocked — you own it all!'}
          </p>
        )}

        <p className={styles.sectionLabel}>Try another game</p>
        <div className={styles.recs}>
          {recs.map((g) => (
            <Link
              key={g.id}
              to={`/games/${g.id}`}
              className={styles.rec}
              onClick={() => platform.analytics.track('recommendation_clicked', { from: game.id, to: g.id })}
            >
              <span
                className={styles.recThumb}
                style={{ background: `linear-gradient(135deg, ${g.theme.from}, ${g.theme.to})` }}
              >
                {g.thumbnail && <img src={g.thumbnail} alt="" loading="lazy" />}
              </span>
              <span className={styles.recTitle}>{g.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
