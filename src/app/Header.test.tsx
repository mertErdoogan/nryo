import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { platform } from '../platform';
import { resetApp } from '../test/utils';
import { App } from './App';

describe('navigation', () => {
  beforeEach(() => resetApp());

  it('navigates between main sections with client-side routing', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /pick a game/i })).toBeInTheDocument();
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0]!;
    await userEvent.click(nav.querySelector('a[href="/games"]')!);
    expect(window.location.pathname).toBe('/games');
    expect(await screen.findByRole('heading', { level: 1, name: /all games/i })).toBeInTheDocument();
    await userEvent.click(nav.querySelector('a[href="/categories"]')!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Categories' })).toBeInTheDocument();
    expect(nav.querySelector('a[href="/categories"]')).toHaveAttribute('aria-current', 'page');
  });

  it('shows the favorites count badge', async () => {
    render(<App />);
    act(() => {
      platform.toggleFavorite('stack-tower');
      platform.toggleFavorite('sky-hopper');
    });
    expect((await screen.findAllByLabelText('2 favorites')).length).toBeGreaterThan(0);
  });

  it('filters games from the search box', async () => {
    resetApp('/games');
    render(<App />);
    await userEvent.type(await screen.findByPlaceholderText(/search: race/i), 'race');
    expect(await screen.findByRole('link', { name: 'Road Rush' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sudoku' })).not.toBeInTheDocument();
  });
});
