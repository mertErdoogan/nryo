import { expect, test } from '@playwright/test';
import { GAME_IDS, watchErrors } from './helpers';

test('home page renders discovery sections without errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/Nryo Arcade/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const name of ['Play now', 'Categories', 'Popular games', 'New arrivals']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText('Daily challenge', { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('every game is listed in the catalog', async ({ page }) => {
  await page.goto('/games');
  await expect(page.getByRole('heading', { name: 'All games' })).toBeVisible();
  await expect(page.getByText(`${GAME_IDS.length} games`)).toBeVisible();
  for (const id of GAME_IDS) {
    await expect(page.locator(`a[href="/games/${id}"]`).first()).toBeAttached();
  }
});

test('search finds games by title and tag', async ({ page }) => {
  await page.goto('/games?q=sudoku');
  await expect(page.locator('a[href="/games/sudoku"]').first()).toBeVisible();
  await expect(page.locator('a[href="/games/road-rush"]')).toHaveCount(0);

  await page.goto('/games?q=racing');
  await expect(page.locator('a[href="/games/road-rush"]').first()).toBeVisible();
});

test('search palette opens from the header and navigates to a game', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search games' }).first().click();
  const input = page.getByRole('searchbox', { name: 'Search games' });
  await input.fill('minesw');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/games\/mine-sweeper$/);
  await expect(page.getByRole('heading', { name: 'Mine Sweeper', level: 1 })).toBeVisible();
  test.info().annotations.push({ type: 'viewport', description: isMobile ? 'mobile' : 'desktop' });
});

test('category page filters the catalog', async ({ page }) => {
  await page.goto('/categories');
  await page.getByRole('link', { name: /Word/ }).first().click();
  await expect(page).toHaveURL(/category=word/);
  await expect(page.locator('a[href="/games/five-letters"]').first()).toBeVisible();
  await expect(page.locator('a[href="/games/road-rush"]')).toHaveCount(0);
});

test('unknown routes show a friendly 404', async ({ page }) => {
  await page.goto('/definitely-not-here');
  await expect(page.getByRole('heading', { name: /doesn’t exist/ })).toBeVisible();
  await page.goto('/games/not-a-game');
  await expect(page.getByRole('heading', { name: /doesn’t exist/ })).toBeVisible();
});

test('game pages ship route-specific metadata', async ({ page }) => {
  await page.goto('/games/neon-snake');
  await expect(page).toHaveTitle(/Neon Snake/);
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description?.length).toBeGreaterThan(40);
  expect(await page.locator('script[type="application/ld+json"]').count()).toBeGreaterThan(0);
});
