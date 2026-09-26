import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

const GAMES_DIR = join(import.meta.dirname, '..', 'src', 'games');

/** Every game folder (the same discovery rule the app uses: `src/games/<id>/meta.ts`). */
export const GAME_IDS = readdirSync(GAMES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(join(GAMES_DIR, d.name, 'meta.ts')))
  .map((d) => d.name)
  .sort();

/** Collects uncaught page errors and console errors so specs can assert a clean run. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Opens a game page and presses Play once the module has loaded. */
export async function startGame(page: Page, id: string, query = '') {
  await page.goto(`/games/${id}${query}`);
  const play = page.getByTestId('play-button');
  await expect(play).toBeEnabled();
  await play.click();
  await expect(page.getByTestId('ready-overlay')).toBeHidden();
  await expect(page.getByTestId('game-stage')).toHaveAttribute('data-phase', 'playing');
}

/** Plays a full round of Reflex Test (5 reactions) through to the results screen. */
export async function playReflexRound(page: Page) {
  await startGame(page, 'reflex-test');
  const panel = page.getByTestId('reflex-panel');
  for (let round = 0; round < 5; round++) {
    await expect(panel).toHaveAttribute('data-state', /ready|result/);
    await panel.click();
    await expect(panel).toHaveAttribute('data-state', 'go', { timeout: 6_000 });
    await panel.click();
  }
  await expect(page.getByTestId('results-overlay')).toBeVisible({ timeout: 5_000 });
}

export const digits = (text: string | null) => (text ?? '').replace(/[^\d]/g, '');
