import { expect, test } from '@playwright/test';

const ROUTES = [
  '/',
  '/games',
  '/categories',
  '/favorites',
  '/profile',
  '/games/neon-snake',
  '/games/sudoku',
  '/games/five-letters',
  '/nope',
];
const WIDTHS = [360, 414, 768, 1024, 1440];

test.describe('layout', () => {
  test.skip(({ isMobile }) => isMobile, 'viewport sweep runs once on desktop');

  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const route of ROUTES) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${route} overflows at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test('mobile shows the bottom navigation and the game fills the screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main' }).last()).toBeVisible();
  await page.goto('/games/neon-snake');
  const stage = page.getByTestId('game-stage');
  const box = (await stage.boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(box.width).toBeGreaterThan(vw * 0.9);
});
