import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { GAMES, getGame } from '../games/catalog';
import { Link } from '../app/router';
import { setUi } from '../app/ui-state';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  useAchievements,
  useDaily,
  useLevel,
  usePlayer,
  useStats,
  useTodayKey,
  useWallet,
} from '../hooks/usePlatform';
import { formatNumber, formatRelativeTime, formatScore } from '../lib/format';
import { sanitizeName } from '../lib/sanitize';
import { platform } from '../platform';
import { ACHIEVEMENTS } from '../platform/achievements';
import { ACCENTS, AVATARS, getAvatar } from '../platform/cosmetics';
import { liveStreak } from '../platform/services/daily';
import type { GameEntry } from '../platform/types';
import { profileMeta } from '../seo';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Medal } from '../ui/Medal';
import { ProgressBar } from '../ui/ProgressBar';
import { EmptyState, Section } from '../ui/Section';
import { CoinAmount } from '../ui/Coins';

function WalletStats() {
  const wallet = useWallet();
  const tiles: [string, ReactNode][] = [
    ['Balance', <CoinAmount key="b" value={wallet.coins} size={20} />],
    ['Coins earned', <CoinAmount key="e" value={wallet.earned} size={20} />],
    ['Items bought', formatNumber(wallet.purchases)],
    ['Continues used', formatNumber(wallet.revives)],
    ['Daily reward streak', `${wallet.claimStreak} day${wallet.claimStreak === 1 ? '' : 's'}`],
  ];
  return (
    <div className={styles.stats}>
      {tiles.map(([label, value]) => (
        <div key={label} className={styles.stat}>
          <span className={styles.statValue}>{value}</span>
          <span className={styles.statLabel}>{label}</span>
        </div>
      ))}
    </div>
  );
}
import styles from './ProfilePage.module.css';

const ACHIEVEMENTS_PREVIEW = 9;

function NameEditor() {
  const player = usePlayer();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(player.nickname);
  const save = () => {
    const name = sanitizeName(draft);
    platform.player.set((p) => ({ ...p, nickname: name }));
    setEditing(false);
  };
  if (editing) {
    return (
      <form
        className={styles.nameRow}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          className={styles.nameInput}
          value={draft}
          maxLength={16}
          autoFocus
          aria-label="Display name"
          placeholder="Your arcade name"
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" variant="primary" size="sm" icon="check">
          Save
        </Button>
        <Button size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </form>
    );
  }
  return (
    <div className={styles.nameRow}>
      <h1 className={styles.name}>{player.nickname || 'Anonymous Player'}</h1>
      <Button
        variant="ghost"
        size="sm"
        icon="pencil"
        label="Edit display name"
        onClick={() => {
          setDraft(player.nickname);
          setEditing(true);
        }}
      />
    </div>
  );
}

export default function ProfilePage() {
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  useDocumentMeta(profileMeta());
  const player = usePlayer();
  const level = useLevel();
  const stats = useStats();
  const unlocked = useAchievements();
  const daily = useDaily();
  const today = useTodayKey();
  const snapshot = useMemo(() => platform.snapshot(), [player, stats, unlocked, daily]); // eslint-disable-line react-hooks/exhaustive-deps
  const avatar = getAvatar(player.avatar);
  const cosmeticState = { level: level.level, achievements: unlocked };

  const played = useMemo(
    () =>
      Object.entries(stats)
        .map(([id, s]) => ({ game: getGame(id), s }))
        .filter((x): x is { game: GameEntry; s: (typeof stats)[string] } => !!x.game && x.s.plays > 0)
        .sort((a, b) => b.s.lastPlayedAt - a.s.lastPlayedAt),
    [stats],
  );
  const medals = { 1: 0, 2: 0, 3: 0 };
  for (const s of Object.values(stats)) if (s.medal > 0) medals[s.medal as 1 | 2 | 3]++;
  const totalMs = Object.values(stats).reduce((sum, s) => sum + s.timePlayedMs, 0);
  const minutes = Math.round(totalMs / 60_000);

  // Unlocked first (newest first), then the ones closest to completion.
  const ratio = (a: (typeof ACHIEVEMENTS)[number]) => {
    const [cur, goal] = a.progress?.(snapshot) ?? [0, 1];
    return goal > 0 ? cur / goal : 0;
  };
  const achievements = [...ACHIEVEMENTS].sort((a, b) => {
    const ua = unlocked[a.id];
    const ub = unlocked[b.id];
    if (ua !== undefined && ub !== undefined) return ub - ua;
    if (ua !== undefined || ub !== undefined) return ua !== undefined ? -1 : 1;
    return ratio(b) - ratio(a);
  });
  const visibleAchievements = showAllAchievements
    ? achievements
    : achievements.slice(0, ACHIEVEMENTS_PREVIEW);

  return (
    <div className={`container ${styles.page}`}>
      <section className={styles.card} aria-label="Player">
        <div className={styles.avatar} aria-hidden="true">
          {avatar.glyph}
        </div>
        <div className={styles.identity}>
          <NameEditor />
          <div className={styles.levelLine}>
            <span>
              <strong>Level {level.level}</strong> · {formatNumber(player.xp)} XP total
            </span>
            <span>
              {level.needed - level.current} XP to level {level.level + 1}
            </span>
          </div>
          <ProgressBar value={level.ratio} label="Experience toward next level" size="thick" />
          <p className={styles.anon}>
            Anonymous local profile — nothing leaves this browser.{' '}
            <button
              type="button"
              onClick={() => setUi({ settingsOpen: true })}
              style={{ textDecoration: 'underline' }}
            >
              Back up or move progress
            </button>
          </p>
        </div>
      </section>

      <Section id="stats" title="Stats" emoji="📊">
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{formatNumber(player.rounds)}</span>
            <span className={styles.statLabel}>Rounds played</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {played.length}/{GAMES.length}
            </span>
            <span className={styles.statLabel}>Games discovered</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{formatNumber(player.totalPoints)}</span>
            <span className={styles.statLabel}>Total points</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{formatNumber(player.wins)}</span>
            <span className={styles.statLabel}>Wins</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`}
            </span>
            <span className={styles.statLabel}>Time played</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              🔥 {liveStreak(daily, today)}{' '}
              <small style={{ fontSize: 14, color: 'var(--text-dim)' }}>best {daily.bestStreak}</small>
            </span>
            <span className={styles.statLabel}>Daily streak</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${styles.medals}`}>
              <span>
                <Medal tier={3} size={22} />
                {medals[3]}
              </span>
              <span>
                <Medal tier={2} size={22} />
                {medals[2]}
              </span>
              <span>
                <Medal tier={1} size={22} />
                {medals[1]}
              </span>
            </span>
            <span className={styles.statLabel}>Medals</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {Object.keys(unlocked).length}/{ACHIEVEMENTS.length}
            </span>
            <span className={styles.statLabel}>Achievements</span>
          </div>
        </div>
      </Section>

      <Section
        id="wallet"
        title="Coins & shop"
        emoji="🪙"
        subtitle="Earn coins in every game, spend them on upgrades and skins."
      >
        <WalletStats />
      </Section>

      <Section id="records" title="Personal records" emoji="📈">
        {played.length === 0 ? (
          <EmptyState icon="🕹️" title="No records yet" action={<Link to="/games">Browse games →</Link>}>
            Finish a round in any game and your best score shows up here.
          </EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Game</th>
                  <th scope="col">Best</th>
                  <th scope="col">Medal</th>
                  <th scope="col" className={styles.hideSm}>
                    Plays
                  </th>
                  <th scope="col" className={styles.hideSm}>
                    Last played
                  </th>
                </tr>
              </thead>
              <tbody>
                {played.map(({ game, s }) => (
                  <tr key={game.id}>
                    <td>
                      <Link to={`/games/${game.id}`} className={styles.gameCell}>
                        <span
                          className={styles.mini}
                          style={{
                            background: `linear-gradient(135deg, ${game.theme.from}, ${game.theme.to})`,
                          }}
                        >
                          {game.thumbnail && <img src={game.thumbnail} alt="" loading="lazy" />}
                        </span>
                        {game.title}
                      </Link>
                    </td>
                    <td>{s.best !== null ? formatScore(s.best, game.score.format) : '—'}</td>
                    <td>
                      <Medal tier={s.medal} showEmpty size={20} />
                    </td>
                    <td className={styles.hideSm}>{s.plays}</td>
                    <td className={styles.hideSm}>{formatRelativeTime(s.lastPlayedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        id="achievements"
        title="Achievements"
        emoji="🏆"
        subtitle="Milestones that reward exploring and improving."
      >
        <div className={styles.achievements}>
          {visibleAchievements.map((a) => {
            const isUnlocked = unlocked[a.id] !== undefined;
            const [cur, goal] = a.progress?.(snapshot) ?? [isUnlocked ? 1 : 0, 1];
            return (
              <div key={a.id} className={styles.achievement} data-unlocked={isUnlocked}>
                <span className={styles.achIcon} aria-hidden="true">
                  {a.icon}
                </span>
                <div className={styles.achBody}>
                  <span className={styles.achTitle}>
                    {a.title}
                    <span className={styles.achXp}>
                      {isUnlocked ? formatRelativeTime(unlocked[a.id]!) : `+${a.xp} XP`}
                    </span>
                  </span>
                  <span className={styles.achDesc}>{a.description}</span>
                  {!isUnlocked && goal > 1 && (
                    <ProgressBar
                      value={cur / goal}
                      size="thin"
                      label={`${a.title}: ${Math.floor(cur)} of ${goal}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {achievements.length > ACHIEVEMENTS_PREVIEW && (
          <div className={styles.showAll}>
            <Button
              variant="ghost"
              icon={showAllAchievements ? 'shrink' : 'expand'}
              aria-expanded={showAllAchievements}
              onClick={() => setShowAllAchievements((v) => !v)}
            >
              {showAllAchievements ? 'Show fewer' : `Show all ${achievements.length} achievements`}
            </Button>
          </div>
        )}
      </Section>

      <Section
        id="avatars"
        title="Avatars"
        emoji="🎭"
        subtitle="Unlock more by leveling up and earning achievements."
      >
        <div className={styles.cosmetics}>
          {AVATARS.map((a) => {
            const open = a.unlock.isUnlocked(cosmeticState);
            return (
              <button
                key={a.id}
                type="button"
                className={styles.cosmetic}
                aria-pressed={player.avatar === a.id}
                disabled={!open}
                title={open ? a.name : a.unlock.label}
                onClick={() => platform.player.set((p) => ({ ...p, avatar: a.id }))}
              >
                {!open && <Icon name="lock" size={14} className={styles.lock} />}
                <span className={styles.glyph} aria-hidden="true">
                  {a.glyph}
                </span>
                {open ? a.name : a.unlock.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section id="themes" title="Arcade colors" emoji="🎨">
        <div className={styles.cosmetics}>
          {ACCENTS.map((a) => {
            const open = a.unlock.isUnlocked(cosmeticState);
            return (
              <button
                key={a.id}
                type="button"
                className={styles.cosmetic}
                aria-pressed={player.accent === a.id}
                disabled={!open}
                title={open ? a.name : a.unlock.label}
                onClick={() => platform.player.set((p) => ({ ...p, accent: a.id }))}
              >
                {!open && <Icon name="lock" size={14} className={styles.lock} />}
                <span
                  className={styles.swatch}
                  style={{ background: `linear-gradient(135deg, ${a.accent}, ${a.accent2})` }}
                />
                {open ? a.name : a.unlock.label}
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
