import { useCallback, useEffect, useState } from 'react';
import type { GameEntry, GameModule } from '../platform/types';

export type ModuleState =
  | { status: 'loading' }
  | { status: 'ready'; module: GameModule }
  | { status: 'error'; error: unknown };

const cache = new Map<string, GameModule>();

/** Lazily loads a game's code (its own chunk) with retry support. */
export function useGameModule(game: GameEntry): ModuleState & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ModuleState>(() => {
    const cached = cache.get(game.id);
    return cached ? { status: 'ready', module: cached } : { status: 'loading' };
  });

  useEffect(() => {
    if (cache.has(game.id)) {
      setState({ status: 'ready', module: cache.get(game.id)! });
      return;
    }
    let alive = true;
    setState({ status: 'loading' });
    game
      .load()
      .then((module) => {
        cache.set(game.id, module);
        if (alive) setState({ status: 'ready', module });
      })
      .catch((error: unknown) => {
        if (alive) setState({ status: 'error', error });
      });
    return () => {
      alive = false;
    };
  }, [game, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}

/** Warm the chunk early (hover/focus on a card). */
export function prefetchGame(game: GameEntry): void {
  if (cache.has(game.id)) return;
  game
    .load()
    .then((m) => cache.set(game.id, m))
    .catch(() => {
      /* will retry when actually opened */
    });
}
