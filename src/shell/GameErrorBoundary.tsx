import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { platform } from '../platform';
import { Button } from '../ui/Button';
import styles from './Shell.module.css';

interface Props {
  gameId: string;
  children: ReactNode;
  onRestart: () => void;
  onExit: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Isolates each game: if a game throws, only the stage shows a recovery
 * screen — the header, navigation and the rest of the platform keep working.
 */
export class GameErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    platform.analytics.track('game_crashed', { gameId: this.props.gameId, message: error.message.slice(0, 120) });
    console.error(`Game "${this.props.gameId}" crashed`, error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.overlay} role="alert" data-game-overlay>
        <div className={styles.panel}>
          <p className={styles.bigEmoji} aria-hidden="true">
            🛠️
          </p>
          <h2 className={styles.overlayTitle}>Something went wrong.</h2>
          <p className={styles.muted}>The game hit an unexpected error. The rest of the arcade is fine.</p>
          <div className={styles.actions}>
            <Button
              variant="primary"
              icon="restart"
              onClick={() => {
                this.setState({ error: null });
                this.props.onRestart();
              }}
            >
              Restart Game
            </Button>
            <Button icon="home" onClick={this.props.onExit}>
              Return Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
