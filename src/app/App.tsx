import { lazy, Suspense, useEffect } from 'react';
import { useSettings, usePlayer } from '../hooks/usePlatform';
import { platform } from '../platform';
import { sound } from '../platform/audio';
import { getAccent } from '../platform/cosmetics';
import { HomePage } from '../pages/HomePage';
import { GamesPage } from '../pages/GamesPage';
import { CategoriesPage } from '../pages/CategoriesPage';
import { FavoritesPage } from '../pages/FavoritesPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ToastHost, showToast } from '../ui/Toasts';
import { AppErrorBoundary } from './AppErrorBoundary';
import { Header, MobileNav } from './Header';
import { Link, useRoute } from './router';
import { SearchPalette } from './SearchPalette';
import { SettingsDialog } from './SettingsDialog';
import styles from './App.module.css';

const PlayPage = lazy(() => import('../pages/PlayPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));

/** Apply persisted settings and cosmetics to the document. */
function useGlobalEffects() {
  const settings = useSettings();
  const player = usePlayer();

  useEffect(() => {
    sound.configure(settings.sound, settings.volume);
    document.documentElement.dataset.motion = settings.motion;
  }, [settings]);

  useEffect(() => {
    const accent = getAccent(player.accent);
    const root = document.documentElement.style;
    root.setProperty('--accent', accent.accent);
    root.setProperty('--accent-2', accent.accent2);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#090916');
  }, [player.accent]);

  useEffect(() => {
    // Audio can only start after a gesture; unlock on the first one.
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);

  useEffect(
    () =>
      platform.on((event) => {
        if (event.type === 'achievement') {
          sound.play('achievement');
          showToast({
            kind: 'achievement',
            icon: event.achievement.icon,
            kicker: `Achievement · +${event.achievement.xp} XP`,
            title: event.achievement.title,
            body: event.achievement.description,
          });
        } else {
          sound.play('levelup');
          showToast({
            kind: 'level',
            icon: '⬆️',
            kicker: 'Level up',
            title: `You reached level ${event.level}!`,
          });
        }
      }),
    [],
  );

  useEffect(() => {
    platform.analytics.track('app_opened', { returning: platform.player.get().rounds > 0 });
    // Warm up the game page chunk once the home screen is idle.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    idle(() => void import('../pages/PlayPage'));
  }, []);
}

function PageFallback() {
  return (
    <div className={styles.pageLoading} aria-busy="true" aria-label="Loading">
      <div className={styles.spinner} />
    </div>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <p>Nryo Arcade · Free games, no sign-up. Your progress stays in this browser.</p>
        <nav className={styles.footerLinks} aria-label="Footer">
          <Link to="/games">All games</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/profile">Progress</Link>
        </nav>
      </div>
    </footer>
  );
}

export function App() {
  useGlobalEffects();
  const route = useRoute();
  const immersive = route.name === 'play';

  let page;
  switch (route.name) {
    case 'home':
      page = <HomePage />;
      break;
    case 'games':
      page = <GamesPage />;
      break;
    case 'categories':
      page = <CategoriesPage />;
      break;
    case 'favorites':
      page = <FavoritesPage />;
      break;
    case 'profile':
      page = <ProfilePage />;
      break;
    case 'play':
      page = <PlayPage key={route.id} gameId={route.id} />;
      break;
    default:
      page = <NotFoundPage />;
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!immersive && <Header />}
      <main id="main" className={immersive ? styles.immersive : styles.main}>
        <AppErrorBoundary key={route.name === 'play' ? `play-${route.id}` : route.name}>
          <Suspense fallback={<PageFallback />}>{page}</Suspense>
        </AppErrorBoundary>
      </main>
      {!immersive && <Footer />}
      {!immersive && <MobileNav />}
      <SearchPalette />
      <SettingsDialog />
      <ToastHost />
    </>
  );
}
