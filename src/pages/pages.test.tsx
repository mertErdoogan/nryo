import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { GAMES } from '../games/catalog';
import { platform } from '../platform';
import { resetApp } from '../test/utils';
import { FavoritesPage } from './FavoritesPage';
import { HomePage } from './HomePage';

describe('FavoritesPage', () => {
  beforeEach(() => resetApp('/favorites'));

  it('shows an empty state, then favorited games', () => {
    render(<FavoritesPage />);
    expect(screen.getByText('No favorites yet')).toBeInTheDocument();
    act(() => {
      platform.toggleFavorite('sudoku');
    });
    expect(screen.queryByText('No favorites yet')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Sudoku' }).length).toBeGreaterThan(0);
  });
});

describe('HomePage', () => {
  beforeEach(() => resetApp());

  it('offers discovery sections for first-time visitors', () => {
    render(<HomePage />);
    expect(screen.queryByRole('heading', { name: /continue playing/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /play now/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /popular games/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /play daily/i })).toHaveAttribute(
      'href',
      expect.stringMatching(/\?daily=1$/),
    );
  });

  it('shows unfinished games with a Continue button and recently played games', () => {
    const merge = GAMES.find((g) => g.id === 'merge-2048')!;
    act(() => {
      platform.saves.write(
        'merge-2048',
        1,
        { tiles: [], score: 88, moves: 3, won: false },
        { label: 'Score 88 · best tile 16', progress: 0.3 },
      );
      platform.recordRound({
        meta: GAMES.find((g) => g.id === 'stack-tower')!,
        result: { score: 12 },
        mode: 'normal',
        durationMs: 10_000,
        daily: null,
      });
    });
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /continue playing/i })).toBeInTheDocument();
    const cont = screen.getByRole('link', { name: `Continue ${merge.title}` });
    expect(cont).toHaveAttribute('href', '/games/merge-2048?continue=1');
    expect(screen.getByText('Score 88 · best tile 16')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Play Stack Tower again' })).toBeInTheDocument();
  });
});
