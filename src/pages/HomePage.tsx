import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { GAMES, getGame } from '../games/catalog';
import { navigate, Link } from '../app/router';
import { ContinueCard } from '../components/ContinueCard';
import { DailyChallengeCard } from '../components/DailyChallengeCard';
import { DailyRewardCard } from '../components/DailyRewardCard';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  useAchievements,
  useLevel,
  usePlayer,
  useRecent,
  useSaves,
  useStats,
  useTodayKey,
} from '../hooks/usePlatform';
import { CATEGORIES } from '../platform/categories';
import { getAvatar } from '../platform/cosmetics';
import { featuredForDay, newestGames, rankPopular, recommendForPlayer } from '../platform/discovery';
import { ACHIEVEMENTS } from '../platform/achievements';
import { homeMeta } from '../seo';
import { AdSlot } from '../ui/AdSlot';
import { Button, ButtonLink } from '../ui/Button';
import { GameGrid, GameShelf } from '../ui/GameList';
import { Icon } from '../ui/Icon';
import { ProgressBar } from '../ui/ProgressBar';
import { Section } from '../ui/Section';
import styles from './HomePage.module.css';

function greeting(name: string, returning: boolean): string {
  const hour = new Date().getHours();
  const part =
    hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  if (!returning) return 'Welcome to the arcade';
  return name ? `${part}, ${name}` : `${part} — welcome back`;
}

function ContinuePlaying() {
  const saves = useSaves();
  const recent = useRecent();
  const stats = useStats();

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; at: number }[] = [];
    for (const s of saves) {
      if (getGame(s.gameId) && !seen.has(s.gameId)) {
        seen.add(s.gameId);
        out.push({ id: s.gameId, at: s.updatedAt });
      }
    }
    for (const r of recent) {
      if (getGame(r.id) && !seen.has(r.id)) {
        seen.add(r.id);
        out.push(r);
      }
    }
    return out.slice(0, 6);
  }, [saves, recent]);

  if (items.length === 0) return null;
  return (
    <Section
      id="continue"
      title="Continue playing"
      emoji="⏯️"
      subtitle="Pick up right where you left off."
      action={recent.length > 6 ? { label: 'Your progress', to: '/profile' } : undefined}
    >
      <div className={styles.continueGrid}>
        {items.map((item, i) => {
          const game = getGame(item.id)!;
          const save = saves.find((s) => s.gameId === item.id);
          return (
            <ContinueCard
              key={item.id}
              game={game}
              save={save}
              stats={stats[item.id]}
              lastPlayedAt={stats[item.id]?.lastPlayedAt ?? item.at}
              index={i}
            />
          );
        })}
      </div>
    </Section>
  );
}

function ProgressStrip() {
  const player = usePlayer();
  const level = useLevel();
  const stats = useStats();
  const achievements = useAchievements();
  const avatar = getAvatar(player.avatar);
  const discovered = Object.values(stats).filter((s) => s.plays > 0).length;
  const golds = Object.values(stats).filter((s) => s.medal === 3).length;
  return (
    <section className={styles.progress} aria-label="Your progress">
      <div className={styles.avatar} aria-hidden="true">
        {avatar.glyph}
      </div>
      <div className={styles.progressInfo}>
        <div className={styles.progressHead}>
          <span>Level {level.level}</span>
          <span>
            {level.current} / {level.needed} XP
          </span>
        </div>
        <ProgressBar value={level.ratio} label="Experience toward next level" />
        <div className={styles.progressStats}>
          <span>
            <strong>{discovered}</strong>/{GAMES.length} games discovered
          </span>
          <span>
            <strong>{golds}</strong> gold medals
          </span>
          <span>
            <strong>{Object.keys(achievements).length}</strong>/{ACHIEVEMENTS.length} achievements
          </span>
        </div>
      </div>
      <ButtonLink to="/profile" icon="trophy">
        View progress
      </ButtonLink>
    </section>
  );
}

export function HomePage() {
  useDocumentMeta(homeMeta());
  const player = usePlayer();
  const stats = useStats();
  const recent = useRecent();
  const today = useTodayKey();
  const returning = player.rounds > 0;

  const featured = useMemo(() => featuredForDay(GAMES, today, 8), [today]);
  const popular = useMemo(() => rankPopular(GAMES, stats).slice(0, 8), [stats]);
  const forYou = useMemo(() => recommendForPlayer(GAMES, stats, recent, 8), [stats, recent]);
  const fresh = useMemo(() => newestGames(GAMES, 8), []);
  const brainy = useMemo(
    () =>
      GAMES.filter((g) => g.categories.some((c) => c === 'brain' || c === 'word' || c === 'puzzle')).slice(
        0,
        10,
      ),
    [],
  );
  const fast = useMemo(
    () =>
      GAMES.filter((g) => g.categories.some((c) => c === 'racing' || c === 'action' || c === 'versus')).slice(
        0,
        10,
      ),
    [],
  );

  const playRandom = () => {
    const pool = GAMES.filter((g) => (stats[g.id]?.plays ?? 0) === 0);
    const list = pool.length > 0 ? pool : GAMES;
    const pick = list[Math.floor(Math.random() * list.length)]!;
    navigate(`/games/${pick.id}?autostart=1`);
  };

  return (
    <div className="container">
      <div className={styles.hero}>
        <div className={styles.intro}>
          <p className={styles.greeting}>{greeting(player.nickname, returning)}</p>
          <h1 className={styles.headline}>
            Pick a game. <em>Play in seconds.</em>
          </h1>
          <p className={styles.lede}>
            {GAMES.length} handcrafted browser games — arcade, puzzles, words, racing and strategy. Short
            rounds, real progress, zero sign-up.
          </p>
          <div className={styles.ctas}>
            <Button variant="primary" size="lg" icon="shuffle" onClick={playRandom}>
              {returning ? 'Surprise me' : 'Play a random game'}
            </Button>
            <ButtonLink to="/games" size="lg" icon="grid">
              Browse games
            </ButtonLink>
          </div>
          <div className={styles.pills}>
            <span>
              <Icon name="check" size={16} /> No account
            </span>
            <span>
              <Icon name="check" size={16} /> Progress saved on this device
            </span>
            <span>
              <Icon name="check" size={16} /> Works offline
            </span>
          </div>
        </div>
        <DailyChallengeCard />
      </div>

      <DailyRewardCard />

      <ContinuePlaying />

      <Section id="play-now" title="Play now" emoji="⚡" subtitle="Fresh picks every day — one tap to play.">
        <GameShelf games={featured} label="Play now" />
      </Section>

      <Section
        id="categories"
        title="Categories"
        emoji="🗂️"
        action={{ label: 'All categories', to: '/categories' }}
      >
        <div className={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              to={`/games?category=${c.id}`}
              className={styles.categoryTile}
              style={{ '--cat': c.color } as CSSProperties}
            >
              <span className={styles.categoryEmoji} aria-hidden="true">
                {c.emoji}
              </span>
              <span className={styles.categoryName}>{c.label}</span>
              <span className={styles.categoryCount}>
                {GAMES.filter((g) => g.categories.includes(c.id)).length} games
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {returning && (
        <Section id="for-you" title="Recommended for you" emoji="🎯" subtitle="Based on what you play most.">
          <GameShelf games={forYou} label="Recommended for you" />
        </Section>
      )}

      <Section
        id="popular"
        title="Popular games"
        emoji="🔥"
        action={{ label: 'See all', to: '/games?sort=popular' }}
      >
        <GameGrid games={popular} />
      </Section>

      <AdSlot placement="home-banner" />

      <Section
        id="new"
        title="New arrivals"
        emoji="✨"
        action={{ label: 'See all', to: '/games?filter=new' }}
      >
        <GameShelf games={fresh} label="New arrivals" />
      </Section>

      <Section
        id="brain"
        title="Train your brain"
        emoji="🧠"
        action={{ label: 'More', to: '/games?category=brain' }}
      >
        <GameShelf games={brainy} label="Brain games" />
      </Section>

      <Section
        id="adrenaline"
        title="Adrenaline rush"
        emoji="🏁"
        action={{ label: 'More', to: '/games?category=action' }}
      >
        <GameShelf games={fast} label="Racing and action games" />
      </Section>

      <ProgressStrip />
    </div>
  );
}
