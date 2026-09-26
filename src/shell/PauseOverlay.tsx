import { useEffect, useRef } from 'react';
import { isCoarsePointer } from '../engine/input';
import { useIsFavorite, useSettings } from '../hooks/usePlatform';
import { platform } from '../platform';
import type { GameEntry } from '../platform/types';
import { Button } from '../ui/Button';
import styles from './Shell.module.css';

interface PauseOverlayProps {
  game: GameEntry;
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
  resumable: boolean;
}

export function PauseOverlay({ game, onResume, onRestart, onExit, resumable }: PauseOverlayProps) {
  const resumeRef = useRef<HTMLButtonElement>(null);
  const settings = useSettings();
  const favorite = useIsFavorite(game.id);
  useEffect(() => resumeRef.current?.focus({ preventScroll: true }), []);
  return (
    <div className={styles.overlay} data-game-overlay data-testid="pause-overlay">
      <div className={styles.panel}>
        <p className={styles.bigEmoji} aria-hidden="true">
          ⏸️
        </p>
        <h2 className={styles.overlayTitle}>Paused</h2>
        <p className={styles.muted}>
          {resumable
            ? 'Your progress is saved — you can leave and continue later.'
            : 'Take a breath. Ready when you are.'}
        </p>
        <div className={styles.actions}>
          <Button ref={resumeRef} variant="primary" size="lg" icon="play" onClick={onResume}>
            Resume
          </Button>
        </div>
        <div className={styles.actions}>
          <Button icon="restart" onClick={onRestart}>
            Restart
          </Button>
          <Button icon="home" onClick={onExit}>
            Exit
          </Button>
        </div>
        <div className={styles.actions}>
          <Button
            variant="ghost"
            size="sm"
            icon={settings.sound ? 'volume' : 'mute'}
            onClick={() => platform.settings.set((s) => ({ ...s, sound: !s.sound }))}
          >
            Sound {settings.sound ? 'on' : 'off'}
          </Button>
          <Button variant="ghost" size="sm" icon="heart" onClick={() => platform.toggleFavorite(game.id)}>
            {favorite ? 'Favorited' : 'Favorite'}
          </Button>
        </div>
        <p className={styles.hint}>{isCoarsePointer() ? game.controls.touch : game.controls.desktop}</p>
      </div>
    </div>
  );
}
