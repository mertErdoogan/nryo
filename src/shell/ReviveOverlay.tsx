import { useEffect, useRef, useState } from 'react';
import { useWallet } from '../hooks/usePlatform';
import { formatScore } from '../lib/format';
import { rewardedAvailable, showRewarded } from '../platform/ads';
import { platform } from '../platform';
import { reviveCost } from '../platform/economy';
import type { GameEntry } from '../platform/types';
import { Button } from '../ui/Button';
import { CoinAmount, CoinIcon } from '../ui/Coins';
import styles from './Shell.module.css';

const DECIDE_SECONDS = 8;

interface ReviveOverlayProps {
  game: GameEntry;
  score: number;
  best: number | null;
  revivesUsed: number;
  maxRevives: number;
  onDecide(ok: boolean): void;
}

/**
 * "Continue?" offer after a loss: watch a rewarded ad or pay coins to carry on
 * from the same spot. A countdown keeps it quick; declining is always one tap.
 */
export function ReviveOverlay({ game, score, best, revivesUsed, maxRevives, onDecide }: ReviveOverlayProps) {
  const wallet = useWallet();
  const cost = reviveCost(revivesUsed);
  const canAd = rewardedAvailable();
  const canPay = wallet.coins >= cost;
  const [left, setLeft] = useState(DECIDE_SECONDS);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const decided = useRef(false);

  const decide = (ok: boolean) => {
    if (decided.current) return;
    decided.current = true;
    onDecide(ok);
  };

  useEffect(() => {
    const t = setTimeout(() => primary.current?.focus({ preventScroll: true }), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (busy) return;
    if (left <= 0) {
      decide(false);
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const watch = async () => {
    setBusy(true);
    setNote(null);
    const outcome = await showRewarded('revive', 'Continue your run');
    setBusy(false);
    if (outcome === 'rewarded') decide(true);
    else {
      setLeft(DECIDE_SECONDS);
      setNote(
        outcome === 'unavailable' ? 'No ad available right now.' : 'The ad was closed early — no continue.',
      );
    }
  };

  const pay = () => {
    if (platform.wallet.spend(cost)) decide(true);
  };

  const low = game.score.lowerIsBetter === true;
  const gap = best !== null && !low ? best - score : null;
  const fmt = (v: number) => formatScore(v, game.score.format);

  return (
    <div
      className={styles.overlay}
      data-game-overlay
      data-testid="revive-overlay"
      role="dialog"
      aria-label="Continue?"
    >
      <div className={styles.panel}>
        <div
          className={styles.reviveRing}
          style={{ ['--p' as string]: left / DECIDE_SECONDS }}
          aria-hidden="true"
        >
          <span>{busy ? '…' : left}</span>
        </div>
        <h2 className={styles.overlayTitle}>Continue?</h2>
        <p className={styles.muted}>
          Keep your {fmt(score)} {game.score.label.toLowerCase()} and pick up right where you fell.
          {gap !== null && gap > 0 && (
            <>
              {' '}
              Only <strong>{fmt(gap)}</strong> to beat your best!
            </>
          )}
        </p>
        <div className={styles.actions} style={{ flexDirection: 'column', width: '100%' }}>
          {canAd && (
            <Button
              ref={primary}
              variant="primary"
              size="lg"
              icon="play"
              block
              disabled={busy}
              onClick={() => void watch()}
              data-testid="revive-ad"
            >
              Watch an ad to continue
            </Button>
          )}
          <Button
            ref={canAd ? undefined : primary}
            size="lg"
            block
            disabled={busy || !canPay}
            onClick={pay}
            data-testid="revive-coins"
          >
            <CoinIcon size={20} /> Continue for {cost} coins
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => decide(false)} data-testid="revive-decline">
            No thanks
          </Button>
        </div>
        {note && <p className={styles.hint}>{note}</p>}
        <p className={styles.hint}>
          You have <CoinAmount value={wallet.coins} size={13} /> · continue {revivesUsed + 1} of {maxRevives}
        </p>
      </div>
    </div>
  );
}
