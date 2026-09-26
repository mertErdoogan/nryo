import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { platform } from '../platform';
import type { GameEntry, GameProps } from '../platform/types';
import { makeMeta } from '../test/fixtures';
import { resetApp } from '../test/utils';
import { GameShell } from './GameShell';

function FinishGame({ api, paused }: GameProps<{ n: number }>) {
  useEffect(() => api.setScore(api.resume?.n ?? 0), [api]);
  return (
    <div>
      <span data-testid="paused">{String(paused)}</span>
      <span data-testid="resumed">{api.resume ? `resumed ${api.resume.n}` : 'fresh'}</span>
      <button type="button" onClick={() => api.save({ n: 7 }, { label: 'Level 7', progress: 0.5 })}>
        save
      </button>
      <button
        type="button"
        onClick={() => api.gameOver({ score: 42, won: true, stats: [{ label: 'Combo', value: 'x3' }] })}
      >
        finish
      </button>
    </div>
  );
}

function CrashGame(): never {
  throw new Error('boom');
}

const entry = (
  id: string,
  Component: GameEntry['load'] extends () => Promise<infer M>
    ? M extends { Component: infer C }
      ? C
      : never
    : never,
  resumable = false,
): GameEntry => ({
  ...makeMeta({ id, title: `Game ${id}`, resumable, medals: { bronze: 10, silver: 30, gold: 50 } }),
  thumbnail: '',
  load: async () => ({
    Component,
    save: {
      version: 1,
      is: (d: unknown): d is { n: number } => typeof (d as { n?: unknown })?.n === 'number',
    },
  }),
});

describe('GameShell', () => {
  beforeEach(() => resetApp('/games/shell-test'));
  afterEach(() => vi.restoreAllMocks());

  it('runs the lifecycle: ready → playing → paused → results → play again', async () => {
    const game = entry('shell-test', FinishGame as never);
    render(<GameShell game={game} />);
    const play = await screen.findByTestId('play-button');
    await waitFor(() => expect(play).toBeEnabled());
    await userEvent.click(play);
    expect(await screen.findByTestId('resumed')).toHaveTextContent('fresh');

    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByTestId('pause-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('paused')).toHaveTextContent('true');
    await userEvent.click(
      within(screen.getByTestId('pause-overlay')).getByRole('button', { name: 'Resume' }),
    );
    expect(screen.getByTestId('paused')).toHaveTextContent('false');

    await userEvent.click(screen.getByRole('button', { name: 'finish' }));
    const results = await screen.findByTestId('results-overlay', {}, { timeout: 3000 });
    expect(results).toHaveTextContent('Victory!');
    expect(screen.getByTestId('result-best')).toHaveTextContent('42');
    expect(results).toHaveTextContent('Combo');
    expect(results).toHaveTextContent('Silver medal unlocked!');
    expect(results).toHaveTextContent('Next: Gold at 50');

    const stats = platform.stats.get()['shell-test']!;
    expect(stats).toMatchObject({ plays: 1, best: 42, wins: 1, medal: 2 });

    await userEvent.click(screen.getByTestId('play-again'));
    await waitFor(() => expect(screen.queryByTestId('results-overlay')).not.toBeInTheDocument());
    expect(screen.getByTestId('resumed')).toHaveTextContent('fresh');
  });

  it('continues an unfinished round from its save', async () => {
    const game = entry('shell-resume', FinishGame as never, true);
    act(() => {
      platform.saves.write('shell-resume', 1, { n: 5 }, { label: 'Level 5', progress: 0.5 });
    });
    render(<GameShell game={game} />);
    const cont = await screen.findByRole('button', { name: 'Continue' });
    await waitFor(() => expect(cont).toBeEnabled());
    expect(screen.getByText('Saved: Level 5')).toBeInTheDocument();
    await userEvent.click(cont);
    expect(await screen.findByTestId('resumed')).toHaveTextContent('resumed 5');
    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(platform.saves.summary('shell-resume')?.summary.label).toBe('Level 7');
    await userEvent.click(screen.getByRole('button', { name: 'finish' }));
    await screen.findByTestId('results-overlay', {}, { timeout: 3000 });
    expect(platform.saves.has('shell-resume')).toBe(false);
  });

  it('isolates a crashing game and offers recovery', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const game = entry('shell-crash', CrashGame as never);
    render(<GameShell game={game} />);
    const play = await screen.findByTestId('play-button');
    await waitFor(() => expect(play).toBeEnabled());
    await userEvent.click(play);
    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart Game' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return Home' })).toBeInTheDocument();
    // The rest of the shell (HUD) is still alive.
    expect(screen.getByRole('button', { name: 'Exit game' })).toBeInTheDocument();
  });
});
