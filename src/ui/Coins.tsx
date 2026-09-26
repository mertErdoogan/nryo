import { formatCompact } from '../lib/format';
import styles from './Coins.module.css';

/** The arcade's coin, drawn as SVG so it looks the same on every platform. */
export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <circle cx="12" cy="12" r="11" fill="#f59e0b" />
      <circle cx="12" cy="12" r="8.2" fill="#fbbf24" stroke="#fde68a" strokeWidth="1.2" />
      <path
        d="M12 7.2v9.6M9.4 9.4c.4-1 1.4-1.6 2.6-1.6 1.5 0 2.5.8 2.5 1.9 0 2.6-5.3 1.4-5.3 4.3 0 1.1 1.1 2 2.7 2 1.3 0 2.3-.6 2.7-1.6"
        fill="none"
        stroke="#92400e"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CoinAmount({
  value,
  size = 16,
  sign,
  className,
}: {
  value: number;
  size?: number;
  sign?: boolean;
  className?: string;
}) {
  return (
    <span className={[styles.amount, className].filter(Boolean).join(' ')}>
      <CoinIcon size={size} />
      {sign && value > 0 ? '+' : ''}
      {formatCompact(value)}
    </span>
  );
}
