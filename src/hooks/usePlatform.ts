import { useMemo } from 'react';
import { platform } from '../platform';
import { levelProgress } from '../platform/services/levels';
import { useStore } from './useStore';
import { useTodayKey } from './useToday';

export const usePlayer = () => useStore(platform.player);
export const useSettings = () => useStore(platform.settings);
export const useStats = () => useStore(platform.stats);
export const useFavorites = () => useStore(platform.favorites);
export const useRecent = () => useStore(platform.recent);
export const useDaily = () => useStore(platform.daily);
export const useAchievements = () => useStore(platform.achievements);
export const useSaves = () => useStore(platform.saves);

export function useIsFavorite(id: string): boolean {
  const favorites = useFavorites();
  return favorites.some((f) => f.id === id);
}

export function useLevel() {
  const player = usePlayer();
  return useMemo(() => levelProgress(player.xp), [player.xp]);
}

export function useTodaysChallenge() {
  const today = useTodayKey();
  return useMemo(() => platform.todaysChallenge(today), [today]);
}

export { useTodayKey };
