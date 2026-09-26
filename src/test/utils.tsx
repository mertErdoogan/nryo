import { act } from '@testing-library/react';
import { platform } from '../platform';

/** Fresh platform state and URL for each component test. */
export function resetApp(path = '/'): void {
  localStorage.clear();
  act(() => {
    platform.reloadAll();
    window.history.replaceState({ key: 'initial' }, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}
