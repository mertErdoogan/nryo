import type { ReactNode } from 'react';
import { Link } from '../app/router';
import styles from './Chip.module.css';

interface ChipProps {
  children: ReactNode;
  active?: boolean;
  count?: number;
  to?: string;
  onClick?: () => void;
  className?: string;
}

export function Chip({ children, active, count, to, onClick, className }: ChipProps) {
  const cls = [styles.chip, active && styles.active, className].filter(Boolean).join(' ');
  const body = (
    <>
      {children}
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls} aria-current={active ? 'page' : undefined} onClick={onClick}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} aria-pressed={active} onClick={onClick}>
      {body}
    </button>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'new' | 'hot' | 'daily' | 'accent' }) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}
