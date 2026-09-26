import { expect, test } from '@playwright/test';

test('the daily challenge links to a seeded run with a visible target', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('section[aria-labelledby="daily-title"]');
  await expect(card).toBeVisible();
  const title = (await card.locator('#daily-title').textContent())!.trim();
  await card.getByRole('link', { name: /play daily/i }).click();
  await expect(page).toHaveURL(/\?daily=1$/);
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  await expect(page.getByText('Daily challenge:')).toBeVisible();
  await expect(page.getByTestId('play-button')).toHaveText('Play daily');
});
