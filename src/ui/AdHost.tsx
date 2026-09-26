import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { GAMES } from '../games/catalog';
import { houseAds } from '../platform/ads';
import { platform } from '../platform';
import { Button } from './Button';
import { Icon } from './Icon';
import styles from './AdHost.module.css';

const HOUSE_AD_SECONDS = 5;

/**
 * Renders the built-in "house" rewarded ad: a five-second sponsored card for
 * another game in the arcade. Used when no ad network is configured, or as a
 * fallback when the network has no ad, so continues and bonuses always work.
 */
export function AdHost() {
  const request = useSyncExternalStore(houseAds.subscribe, houseAds.get, houseAds.get);
  useEffect(() => houseAds.attachHost(), []);
  if (!request) return null;
  return <HouseAd key={request.id} label={request.label} />;
}

function HouseAd({ label }: { label: string }) {
  const [left, setLeft] = useState(HOUSE_AD_SECONDS);
  const [confirmClose, setConfirmClose] = useState(false);
  const claimRef = useRef<HTMLButtonElement>(null);
  const game = useMemo(() => {
    const stats = platform.stats.get();
    const unplayed = GAMES.filter((g) => !stats[g.id]?.plays && !window.location.pathname.endsWith(g.id));
    const pool = unplayed.length > 0 ? unplayed : GAMES;
    return pool[Math.floor(Math.random() * pool.length)]!;
  }, []);
  const [favorite, setFavorite] = useState(() => platform.favorites.has(game.id));

  useEffect(() => {
    if (left <= 0) {
      claimRef.current?.focus();
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const done = left <= 0;
  const close = () => {
    if (done) houseAds.finish('rewarded');
    else if (confirmClose) houseAds.finish('dismissed');
    else setConfirmClose(true);
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Sponsored"
      data-testid="house-ad"
    >
      <div className={styles.card}>
        <div className={styles.top}>
          <span className={styles.badge}>Ad · Sponsored by Nryo Arcade</span>
          <button type="button" className={styles.close} onClick={close} aria-label="Close ad">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div
          className={styles.art}
          style={{ background: `linear-gradient(135deg, ${game.theme.from}, ${game.theme.to})` }}
        >
          {game.thumbnail && <img src={game.thumbnail} alt="" />}
        </div>
        <p className={styles.kicker}>Next up for you</p>
        <h2 className={styles.title}>{game.title}</h2>
        <p className={styles.tagline}>{game.tagline}</p>
        <Button
          size="sm"
          variant="ghost"
          icon="heart"
          onClick={() => setFavorite(platform.toggleFavorite(game.id))}
        >
          {favorite ? 'Saved to favorites' : 'Save for later'}
        </Button>
        {confirmClose && !done ? (
          <div className={styles.confirm}>
            <p>Close now and you won’t get: {label}</p>
            <div className={styles.row}>
              <Button variant="danger" size="sm" onClick={() => houseAds.finish('dismissed')}>
                Close anyway
              </Button>
              <Button size="sm" variant="primary" onClick={() => setConfirmClose(false)}>
                Keep watching
              </Button>
            </div>
          </div>
        ) : (
          <Button
            ref={claimRef}
            variant="primary"
            size="lg"
            block
            icon={done ? 'check' : undefined}
            disabled={!done}
            onClick={() => houseAds.finish('rewarded')}
            data-testid="house-ad-claim"
          >
            {done ? `Claim: ${label}` : `Reward in ${left}…`}
          </Button>
        )}
        <div className={styles.progress} aria-hidden="true">
          <div style={{ width: `${((HOUSE_AD_SECONDS - left) / HOUSE_AD_SECONDS) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
