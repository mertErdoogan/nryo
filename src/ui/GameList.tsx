import { useMemo } from 'react';
import { useStats, useTodaysChallenge } from '../hooks/usePlatform';
import { GAMES } from '../games/catalog';
import { newestGames, rankPopular } from '../platform/discovery';
import type { GameEntry } from '../platform/types';
import { GameCard } from './GameCard';
import { CardGrid, Shelf, ShelfItem } from './Section';

/** Shared badge logic so "New"/"Hot"/"Daily" are consistent everywhere. */
export function useCardFlags() {
  const stats = useStats();
  const daily = useTodaysChallenge();
  return useMemo(() => {
    const newIds = new Set(newestGames(GAMES).map((g) => g.id));
    const hotIds = new Set(
      rankPopular(GAMES, {})
        .slice(0, 6)
        .map((g) => g.id),
    );
    return { stats, newIds, hotIds, dailyId: daily?.gameId ?? null };
  }, [stats, daily]);
}

export function GameGrid({ games, dense }: { games: readonly GameEntry[]; dense?: boolean }) {
  const { stats, newIds, hotIds, dailyId } = useCardFlags();
  return (
    <CardGrid dense={dense}>
      {games.map((g, i) => (
        <GameCard
          key={g.id}
          game={g}
          stats={stats[g.id]}
          isNew={newIds.has(g.id)}
          isHot={hotIds.has(g.id)}
          isDaily={dailyId === g.id}
          index={i}
        />
      ))}
    </CardGrid>
  );
}

export function GameShelf({ games, label }: { games: readonly GameEntry[]; label: string }) {
  const { stats, newIds, hotIds, dailyId } = useCardFlags();
  return (
    <Shelf label={label}>
      {games.map((g, i) => (
        <ShelfItem key={g.id}>
          <GameCard
            game={g}
            stats={stats[g.id]}
            isNew={newIds.has(g.id)}
            isHot={hotIds.has(g.id)}
            isDaily={dailyId === g.id}
            compact
            index={i}
          />
        </ShelfItem>
      ))}
    </Shelf>
  );
}
