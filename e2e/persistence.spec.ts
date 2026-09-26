import { expect, test } from '@playwright/test';
import { digits, playReflexRound, startGame, watchErrors } from './helpers';

test('a finished round saves the best score and survives a refresh', async ({ page }) => {
  const errors = watchErrors(page);
  await playReflexRound(page);
  const best = digits(await page.getByTestId('result-best').textContent());
  expect(Number(best)).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByTestId('hud-best')).toContainText(best);

  await page.goto('/profile');
  const records = page.locator('#records');
  await expect(records.getByRole('link', { name: /Reflex Test/ })).toBeVisible();

  // It also shows up under "Continue playing" as a recently played game.
  await page.goto('/');
  const continueSection = page.locator('section', { has: page.getByRole('heading', { name: 'Continue playing' }) });
  await expect(continueSection.getByRole('article', { name: 'Reflex Test' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('play again starts a fresh round', async ({ page }) => {
  await playReflexRound(page);
  await page.getByTestId('play-again').click();
  await expect(page.getByTestId('results-overlay')).toBeHidden();
  await expect(page.getByTestId('reflex-panel')).toHaveAttribute('data-state', 'ready');
});

test('favorites persist across reloads', async ({ page }) => {
  await page.goto('/games/sudoku');
  const add = page.getByRole('button', { name: 'Add Sudoku to favorites' }).first();
  await add.click();
  await expect(page.getByRole('button', { name: 'Remove Sudoku from favorites' }).first()).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove Sudoku from favorites' }).first()).toBeVisible();

  await page.goto('/favorites');
  await expect(page.locator('a[href="/games/sudoku"]').first()).toBeVisible();

  await page.getByRole('button', { name: 'Remove Sudoku from favorites' }).first().click();
  await page.reload();
  await expect(page.locator('a[href="/games/sudoku"]')).toHaveCount(0);
});

test('an unfinished 2048 game can be continued after a refresh', async ({ page }) => {
  await startGame(page, 'merge-2048');
  const board = page.getByTestId('game-stage');
  for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowLeft', 'ArrowDown']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(140);
  }
  const tilesBefore = await board.locator('[data-tile]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile')).sort().join(','));
  const scoreBefore = digits(await page.getByTestId('hud-score').textContent());

  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await page.goto('/');
  const card = page.getByRole('article', { name: '2048 Merge' });
  await expect(card).toBeVisible();
  await card.getByRole('link', { name: 'Continue 2048 Merge' }).click();

  await expect(page.getByTestId('game-stage')).toHaveAttribute('data-phase', 'playing');
  await expect(page.getByTestId('hud-score')).toHaveText(new RegExp(scoreBefore || '0'));
  const tilesAfter = await board.locator('[data-tile]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile')).sort().join(','));
  expect(tilesAfter).toBe(tilesBefore);
});

test('settings persist across reloads', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  const sound = dialog.getByRole('switch', { name: /sound effects/i });
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Settings' }).getByRole('switch', { name: /sound effects/i })).toHaveAttribute('aria-checked', 'false');
});

test('corrupted saved data is repaired instead of crashing the app', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('nryo:player', '{not json');
    localStorage.setItem('nryo:stats', JSON.stringify({ v: 1, d: { snake: { best: 'lots' } } }));
    localStorage.setItem('nryo:favorites', JSON.stringify({ v: 999, d: 42 }));
    localStorage.setItem('nryo:save:merge-2048', '"garbage"');
  });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/games/merge-2048');
  await expect(page.getByTestId('play-button')).toBeEnabled();
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Personal records' })).toBeVisible();
  expect(errors.filter((e) => e.startsWith('pageerror'))).toEqual([]);
});
