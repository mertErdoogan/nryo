import styles from './Header.module.css';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#logo-g)" />
      <path d="M24 20.5v23a2 2 0 0 0 3 1.7l19-11.5a2 2 0 0 0 0-3.4l-19-11.5a2 2 0 0 0-3 1.7z" fill="#fff" />
      <circle cx="47" cy="17" r="5" fill="#fff" opacity="0.9" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className={styles.logo}>
      <LogoMark />
      <span className={styles.wordmark}>
        nryo<span className={styles.wordmarkSub}>arcade</span>
      </span>
    </span>
  );
}
