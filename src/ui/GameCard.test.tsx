import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { GAMES } from '../games/catalog';
import { platform } from '../platform';
import { resetApp } from '../test/utils';
import { GameCard } from './GameCard';

const game = GAMES.find((g) => g.id === 'stack-tower')!;

describe('GameCard', () => {
  beforeEach(() => resetApp());

  it('renders the game with a link to its page', () => {
    render(<GameCard game={game} isNew />);
    const link = screen.getByRole('link', { name: game.title });
    expect(link).toHaveAttribute('href', '/games/stack-tower');
    expect(screen.getByText(game.tagline)).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('toggles favorites without navigating', async () => {
    render(<GameCard game={game} />);
    const fav = screen.getByRole('button', { name: /add stack tower to favorites/i });
    expect(fav).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(fav);
    expect(platform.favorites.has('stack-tower')).toBe(true);
    expect(screen.getByRole('button', { name: /remove stack tower from favorites/i })).toHaveAttribute('aria-pressed', 'true');
    expect(window.location.pathname).toBe('/');
  });

  it('shows the personal best and medal when available', () => {
    render(
      <GameCard
        game={game}
        stats={{ plays: 3, best: 40, last: 12, totalScore: 60, wins: 0, medal: 2, firstPlayedAt: 0, lastPlayedAt: 0, timePlayedMs: 0 }}
      />,
    );
    const best = screen.getByTitle('Your best');
    expect(within(best).getByText('40')).toBeInTheDocument();
    expect(within(best).getByRole('img', { name: 'Silver medal' })).toBeInTheDocument();
  });
});
