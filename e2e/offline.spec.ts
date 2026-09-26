import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('the app and previously opened games work offline', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'service worker behaviour is viewport independent');
  await page.goto('/');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  // Let the precache finish, then take the network away.
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).length), { timeout: 15_000 })
    .toBeGreaterThan(0);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);

  await page.goto('/games/neon-snake');
  await expect(page.getByRole('heading', { name: 'Neon Snake', level: 1 })).toBeVisible();
  await page.getByTestId('play-button').click();
  await expect(page.getByTestId('game-stage')).toHaveAttribute('data-phase', 'playing');

  await page.goto('/games');
  await expect(page.getByRole('heading', { name: 'All games' })).toBeVisible();
  await context.setOffline(false);
});
