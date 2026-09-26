import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number;
  label: string;
  size?: 'thin' | 'normal' | 'thick';
  color?: string;
  className?: string;
}

export function ProgressBar({ value, label, size = 'normal', color, className }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={[styles.track, size !== 'normal' && styles[size], className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      style={color ? ({ '--bar-color': color } as React.CSSProperties) : undefined}
    >
      <div className={styles.fill} style={{ width: `${pct}%` }} />
    </div>
  );
}
