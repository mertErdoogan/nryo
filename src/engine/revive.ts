import type { GameApi } from '../platform/types';

/**
 * Standard loss handling for games that support continues: asks the shell for
 * a continue (ad or coins) and then calls exactly one of the callbacks.
 * Repeated calls while an offer is open are ignored.
 */
export function createContinueGate(api: Pick<GameApi, 'requestRevive'>) {
  let open = false;
  return (onContinue: () => void, onEnd: () => void): void => {
    if (open) return;
    open = true;
    void api.requestRevive().then((ok) => {
      open = false;
      if (ok) onContinue();
      else onEnd();
    });
  };
}
