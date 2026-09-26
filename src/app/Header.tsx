import { useEffect } from 'react';
import { useFavorites, useLevel, usePlayer } from '../hooks/usePlatform';
import { getAvatar } from '../platform/cosmetics';
import { Icon, type IconName } from '../ui/Icon';
import { isActivePath, Link, useLocation } from './router';
import { Logo } from './Logo';
import { setUi } from './ui-state';
import styles from './Header.module.css';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/games', label: 'Games', icon: 'grid' },
  { to: '/categories', label: 'Categories', icon: 'layers' },
  { to: '/favorites', label: 'Favorites', icon: 'heart' },
];

function LevelChip() {
  const player = usePlayer();
  const level = useLevel();
  const avatar = getAvatar(player.avatar);
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <Link to="/profile" className={styles.levelChip} aria-label={`Your profile, level ${level.level}`}>
      <span className={styles.levelRing}>
        <svg viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="3" />
          <circle
            cx="17"
            cy="17"
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - level.ratio)}
            style={{ transition: 'stroke-dashoffset var(--dur-slow) var(--ease-out)' }}
          />
        </svg>
        <span aria-hidden="true">{avatar.glyph}</span>
      </span>
      <span className={styles.levelText}>
        <span className={styles.levelLabel}>Level</span>
        <span className={styles.levelValue}>{level.level}</span>
      </span>
    </Link>
  );
}

export function Header() {
  const { pathname } = useLocation();
  const favorites = useFavorites();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setUi({ searchOpen: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.logoLink} aria-label="Nryo Arcade home">
          <Logo />
        </Link>
        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={styles.navLink}
              aria-current={isActivePath(pathname, item.to) ? 'page' : undefined}
            >
              <Icon name={item.icon} size={16} filled={item.icon === 'heart' ? false : undefined} />
              {item.label}
              {item.to === '/favorites' && favorites.length > 0 && (
                <span className={styles.count} aria-label={`${favorites.length} favorites`}>
                  {favorites.length}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className={styles.spacer} />
        <button type="button" className={styles.search} onClick={() => setUi({ searchOpen: true })}>
          <Icon name="search" size={16} />
          Search games…
          <kbd className={styles.kbd}>/</kbd>
        </button>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.mobileOnly}`}
          aria-label="Search games"
          onClick={() => setUi({ searchOpen: true })}
        >
          <Icon name="search" />
        </button>
        <LevelChip />
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Settings"
          onClick={() => setUi({ settingsOpen: true })}
        >
          <Icon name="settings" />
        </button>
      </div>
    </header>
  );
}

const MOBILE_NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/games', label: 'Games', icon: 'grid' },
  { to: '/categories', label: 'Categories', icon: 'layers' },
  { to: '/favorites', label: 'Favorites', icon: 'heart' },
  { to: '/profile', label: 'Profile', icon: 'trophy' },
];

export function MobileNav() {
  const { pathname } = useLocation();
  const favorites = useFavorites();
  return (
    <nav className={styles.mobileNav} aria-label="Main">
      {MOBILE_NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={styles.mobileLink}
          aria-current={isActivePath(pathname, item.to) ? 'page' : undefined}
        >
          <Icon name={item.icon} size={22} filled={false} />
          {item.label}
          {item.to === '/favorites' && favorites.length > 0 && (
            <span className={styles.mobileBadge} aria-hidden="true">
              {favorites.length}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
