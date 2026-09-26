import { useEffect, useRef } from 'react';
import { isCoarsePointer } from '../engine/input';
import { formatScore } from '../lib/format';
import { getCategory } from '../platform/categories';
import { MEDAL_NAMES, nextMedal } from '../platform/scoring';
import { useLoadouts, useWallet } from '../hooks/usePlatform';
import { resolveLoadout } from '../platform/services/loadouts';
import { affordableCount } from '../platform/shop';
import { CoinAmount } from '../ui/Coins';
import type { GameEntry, GameStats } from '../platform/types';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Medal } from '../ui/Medal';
import styles from './Shell.module.css';

interface ReadyOverlayProps {
  game: GameEntry;
  stats: GameStats | undefined;
  loading: boolean;
  loadError: boolean;
  canContinue: boolean;
  continueLabel: string | null;
  daily: { target: number } | null;
  onPlay: () => void;
  onContinue: () => void;
  onRetryLoad: () => void;
  onShop?: () => void;
}

function ShopButton({ game, onShop }: { game: GameEntry; onShop: () => void }) {
  const wallet = useWallet();
  const loadouts = useLoadouts();
  const shop = game.shop!;
  const affordable = affordableCount(shop, resolveLoadout(loadouts[game.id], shop), wallet.coins);
  return (
    <div className={styles.actions}>
      <Button onClick={onShop} data-testid="open-shop">
        <span aria-hidden="true">{shop.icon}</span> {shop.title}
        {affordable > 0 && (
          <span className={styles.shopBadge} aria-label={`${affordable} affordable`}>
            {affordable}
          </span>
        )}
      </Button>
      <span className={styles.pill}>
        <CoinAmount value={wallet.coins} />
      </span>
    </div>
  );
}

export function ReadyOverlay(props: ReadyOverlayProps) {
  const { game, stats, loading, daily } = props;
  const primaryRef = useRef<HTMLButtonElement>(null);
  const touch = isCoarsePointer();
  const best = stats?.best ?? null;
  const next = nextMedal(best, game);
  const category = getCategory(game.categories[0]!);

  useEffect(() => {
    if (!loading) primaryRef.current?.focus({ preventScroll: true });
  }, [loading]);

  return (
    <div className={`${styles.overlay} ${styles.overlayReady}`} data-game-overlay data-testid="ready-overlay">
      <div className={styles.panel}>
        <div className={styles.readyArt}>{game.thumbnail && <img src={game.thumbnail} alt="" />}</div>
        <h1 className={styles.overlayTitle}>{game.title}</h1>
        <div className={styles.metaRow}>
          <span className={styles.pill}>
            {category?.emoji} {category?.label}
          </span>
          <span className={styles.pill}>
            <Icon name="clock" size={14} /> {game.sessionLength}
          </span>
          {best !== null && (
            <span className={styles.pill}>
              <Medal tier={stats?.medal ?? 0} size={16} /> Best{' '}
              <strong>{formatScore(best, game.score.format)}</strong>
            </span>
          )}
        </div>
        {daily && (
          <div className={styles.dailyBanner}>
            <Icon name="calendar" size={18} />
            <span>
              <strong>Daily challenge:</strong> {game.score.lowerIsBetter ? 'get' : 'reach'}{' '}
              <strong>{formatScore(daily.target, game.score.format)}</strong>
              {game.score.lowerIsBetter ? ' or better' : ''}. Same level for everyone today.
            </span>
          </div>
        )}
        <ul className={styles.howTo} aria-label="How to play">
          {game.howToPlay.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className={styles.controlsLine}>
          <Icon name={touch ? 'target' : 'gamepad'} size={16} />
          {touch ? game.controls.touch : game.controls.desktop}
        </p>
        {next && (
          <p className={styles.hint}>
            Next medal: {MEDAL_NAMES[next.tier]} at {formatScore(next.threshold, game.score.format)}
          </p>
        )}
        {props.loadError ? (
          <div className={styles.actions}>
            <p className={styles.muted}>Couldn’t load the game. Check your connection.</p>
            <Button variant="primary" icon="restart" onClick={props.onRetryLoad}>
              Try again
            </Button>
          </div>
        ) : (
          <div className={styles.actions}>
            {props.canContinue ? (
              <>
                <Button
                  ref={primaryRef}
                  variant="primary"
                  size="lg"
                  icon="play"
                  onClick={props.onContinue}
                  disabled={loading}
                >
                  Continue
                </Button>
                <Button size="lg" icon="restart" onClick={props.onPlay} disabled={loading}>
                  New game
                </Button>
              </>
            ) : (
              <Button
                ref={primaryRef}
                variant="primary"
                size="lg"
                icon={loading ? undefined : 'play'}
                onClick={props.onPlay}
                disabled={loading}
                data-testid="play-button"
              >
                {loading ? (
                  <span className={styles.loadingDots} aria-label="Loading">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : daily ? (
                  'Play daily'
                ) : (
                  'Play'
                )}
              </Button>
            )}
          </div>
        )}
        {props.onShop && game.shop && !props.loadError && <ShopButton game={game} onShop={props.onShop} />}
        {props.canContinue && props.continueLabel && (
          <p className={styles.hint}>Saved: {props.continueLabel}</p>
        )}
        {!touch && !props.loadError && (
          <p className={styles.hint}>
            Press <kbd className={styles.kbd}>Enter</kbd> to start · <kbd className={styles.kbd}>Esc</kbd> to
            pause
          </p>
        )}
      </div>
    </div>
  );
}
