import type { CSSProperties, ReactNode } from 'react';
import styles from './ui.module.css';

/** Full-size container for DOM-based games inside the shell stage. */
export function DomStage({
  children,
  center,
  className,
  style,
}: {
  children: ReactNode;
  center?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={[styles.stage, center && styles.center, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}

export function StatBar({ children }: { children: ReactNode }) {
  return <div className={styles.statBar}>{children}</div>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'warn' | 'good' }) {
  return (
    <span className={styles.stat} data-tone={tone}>
      {label} <strong>{value}</strong>
    </span>
  );
}

export function TimerBar({ ratio, label }: { ratio: number; label: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      className={styles.timer}
      data-low={ratio < 0.2}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className={styles.timerFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Short-lived centred announcement ("Level 2", "Combo!"). Re-keyed to replay. */
export function Banner({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className={styles.banner} aria-live="polite">
      <div className={styles.bannerText}>
        {text}
        {sub && <span className={styles.bannerSub}>{sub}</span>}
      </div>
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className={styles.hint}>{children}</p>;
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <div className={styles.actionRow}>{children}</div>;
}

export function GameButton({
  children,
  onClick,
  disabled,
  pressed,
  label,
  tone,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  label?: string;
  tone?: 'primary' | 'danger';
}) {
  return (
    <button
      type="button"
      className={styles.gameButton}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      data-tone={tone}
    >
      {children}
    </button>
  );
}
