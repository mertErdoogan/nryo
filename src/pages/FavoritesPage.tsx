import { useMemo } from 'react';
import { GAMES, getGame } from '../games/catalog';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useFavorites, useStats } from '../hooks/usePlatform';
import { rankPopular } from '../platform/discovery';
import { favoritesMeta } from '../seo';
import { GameGrid } from '../ui/GameList';
import { EmptyState, Section } from '../ui/Section';
import type { GameEntry } from '../platform/types';

export function FavoritesPage() {
  useDocumentMeta(favoritesMeta());
  const favorites = useFavorites();
  const stats = useStats();
  const games = useMemo(
    () => favorites.map((f) => getGame(f.id)).filter((g): g is GameEntry => !!g),
    [favorites],
  );
  const suggestions = useMemo(() => rankPopular(GAMES, stats).slice(0, 4), [stats]);

  return (
    <div className="container">
      <Section
        id="favorites"
        headingLevel="h1"
        title="Favorites"
        emoji="❤️"
        subtitle={games.length > 0 ? `${games.length} saved on this device` : 'Your go-to games, one tap away.'}
      >
        {games.length > 0 ? (
          <GameGrid games={games} dense />
        ) : (
          <EmptyState icon="💜" title="No favorites yet">
            Tap the heart on any game to pin it here. Favorites are saved in this browser — no account needed.
          </EmptyState>
        )}
      </Section>
      {games.length < 4 && (
        <Section id="favorite-ideas" title="Popular picks to try" emoji="🔥">
          <GameGrid games={suggestions} />
        </Section>
      )}
    </div>
  );
}
