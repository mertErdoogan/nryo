import { useState } from 'react';
import { useTodayKey, useWallet } from '../hooks/usePlatform';
import { rewardedAvailable, showRewarded } from '../platform/ads';
import { platform } from '../platform';
import { ECONOMY } from '../platform/economy';
import { Button } from '../ui/Button';
import { CoinAmount, CoinIcon } from '../ui/Coins';
import styles from './DailyRewardCard.module.css';

/** Daily login reward with a 7-day streak track; an optional ad doubles today's coins. */
export function DailyRewardCard() {
  useWallet(); // re-render on balance changes
  const today = useTodayKey();
  const status = platform.wallet.dailyStatus(today);
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState<number | null>(null);
  const days = ECONOMY.dailyRewards;
  const cycleDay = ((status.day - 1) % days.length) + 1;

  const claim = async (withAd: boolean) => {
    let multiplier = 1;
    if (withAd) {
      setBusy(true);
      const outcome = await showRewarded('daily-reward', `${status.amount * 2} coins`);
      setBusy(false);
      if (outcome !== 'rewarded') return;
      multiplier = 2;
    }
    const got = platform.wallet.claimDaily(today, multiplier);
    if (got > 0) {
      platform.analytics.track('daily_reward_claimed', { day: status.day, coins: got, doubled: withAd });
      setClaimed(got);
    }
  };

  return (
    <section className={styles.card} aria-labelledby="daily-reward-title" id="daily-reward">
      <div className={styles.head}>
        <h2 id="daily-reward-title" className={styles.title}>
          <CoinIcon size={22} /> Daily reward
        </h2>
        <span className={styles.sub}>
          {status.available
            ? `Day ${status.day} — come back every day for bigger rewards`
            : claimed !== null
              ? `+${claimed} coins added. See you tomorrow!`
              : 'Claimed today. Come back tomorrow to keep your streak!'}
        </span>
      </div>
      <ol className={styles.track}>
        {days.map((amount, i) => {
          const day = i + 1;
          const state =
            day < cycleDay || (day === cycleDay && !status.available)
              ? 'done'
              : day === cycleDay
                ? 'today'
                : 'later';
          return (
            <li key={day} className={styles.day} data-state={state}>
              <span className={styles.dayLabel}>Day {day}</span>
              <CoinAmount value={amount} size={14} />
            </li>
          );
        })}
      </ol>
      {status.available && (
        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={() => void claim(false)}
            disabled={busy}
            data-testid="claim-daily"
          >
            Claim {status.amount}
          </Button>
          {rewardedAvailable() && (
            <Button icon="play" onClick={() => void claim(true)} disabled={busy}>
              Watch ad · claim {status.amount * 2}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
