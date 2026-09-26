import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../hooks/usePlatform';
import { formatScore } from '../lib/format';
import { platform } from '../platform';
import type { GameEntry, MedalTier, PlayMode } from '../platform/types';
import { Button } from '../ui/Button';
import { FavoriteButton } from '../ui/FavoriteButton';
import { Medal } from '../ui/Medal';
import type { ValueStore } from './value-store';
import { useValue } from './value-store';
import styles from './Shell.module.css';

interface HudProps {
  game: GameEntry;
  mode: PlayMode;
  target: number | null;
  score: ValueStore<number>;
  best: number | null;
  medal: MedalTier;
  canPause: boolean;
  paused: boolean;
  canRestart: boolean;
  onExit: () => void;
  onPauseToggle: () => void;
  onRestart: () => void;
}

function LiveScore({ store, game }: { store: ValueStore<number>; game: GameEntry }) {
  const value = useValue(store);
  const [bump, setBump] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value !== prev.current && value !== 0) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 250);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return (
    <span className={styles.scoreValue} data-bump={bump} data-testid="hud-score">
      {formatScore(value, game.score.format)}
    </span>
  );
}

export function Hud(props: HudProps) {
  const { game, mode, target, score, best, medal } = props;
  const settings = useSettings();
  return (
    <header className={styles.hud}>
      <Button variant="ghost" icon="back" label="Exit game" onClick={props.onExit} />
      <div className={styles.hudTitle}>
        <span className={styles.hudName}>{game.title}</span>
        <span className={styles.hudMode} data-daily={mode === 'daily'}>
          {mode === 'daily' && target !== null
            ? `Daily · target ${formatScore(target, game.score.format)}`
            : game.score.label}
        </span>
      </div>
      <div className={styles.scoreBox} aria-live="off">
        <span className={styles.scoreLabel}>Score</span>
        <LiveScore store={score} game={game} />
      </div>
      <div className={styles.hudDivider} aria-hidden="true" />
      <div className={styles.scoreBox}>
        <span className={styles.scoreLabel}>Best</span>
        <span className={styles.bestValue} data-testid="hud-best">
          {medal > 0 && <Medal tier={medal} size={14} />}
          {best === null ? '—' : formatScore(best, game.score.format)}
        </span>
      </div>
      {props.canPause && (
        <Button
          variant="ghost"
          icon={props.paused ? 'play' : 'pause'}
          label={props.paused ? 'Resume' : 'Pause'}
          onClick={props.onPauseToggle}
        />
      )}
      {props.canRestart && <Button variant="ghost" icon="restart" label="Restart" onClick={props.onRestart} />}
      <Button
        variant="ghost"
        icon={settings.sound ? 'volume' : 'mute'}
        label={settings.sound ? 'Mute sound' : 'Unmute sound'}
        className={styles.hideNarrow}
        onClick={() => platform.settings.set((s) => ({ ...s, sound: !s.sound }))}
      />
      <span className={styles.hideNarrow}>
        <FavoriteButton gameId={game.id} title={game.title} plain size={18} />
      </span>
    </header>
  );
}
