import { useSyncExternalStore } from 'react';

interface UiState {
  searchOpen: boolean;
  settingsOpen: boolean;
}

let state: UiState = { searchOpen: false, settingsOpen: false };
const listeners = new Set<() => void>();

export function setUi(patch: Partial<UiState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useUi(): UiState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
