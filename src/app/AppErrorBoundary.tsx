import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/Section';
import { navigate } from './router';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

const RELOAD_FLAG = 'nryo:chunk-reload';

/** True when a lazy chunk failed to download (usually after a new deploy). */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically/i.test(
    message,
  );
}

/**
 * Last-resort boundary for whole pages. Games have their own boundary inside
 * the game shell, so a crashing game never reaches this one.
 */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      // A new version was deployed; reload once to pick up fresh chunks.
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
      return;
    }
    console.error('Page crashed', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <EmptyState
          icon="🛠️"
          title="Something went wrong."
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" icon="restart" onClick={() => window.location.reload()}>
                Reload
              </Button>
              <Button
                icon="home"
                onClick={() => {
                  this.setState({ error: null });
                  navigate('/');
                }}
              >
                Return Home
              </Button>
            </div>
          }
        >
          This page hit an unexpected error. Your progress is safe.
        </EmptyState>
      </div>
    );
  }
}
