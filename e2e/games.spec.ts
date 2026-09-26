import { expect, test, type Page } from '@playwright/test';
import { GAME_IDS, startGame, watchErrors } from './helpers';

/** Games that ask for a difficulty/opponent before the first move. */
const PICKERS: Record<string, RegExp> = {
  'mine-sweeper': /^Easy/,
  sudoku: /^Easy/,
  'four-in-a-row': /^Rookie/,
  reversi: /^Novice/,
};

/** Throws a burst of plausible input at a game: keys, taps, drags. */
async function mash(page: Page, isMobile: boolean) {
  const stage = page.getByTestId('game-stage');
  const box = (await stage.boundingBox())!;
  const keys = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Space',
    'KeyA',
    'KeyD',
    'KeyW',
    'KeyS',
    'Enter',
  ];
  for (let i = 0; i < 14; i++) {
    const x = box.x + box.width * (0.15 + ((i * 37) % 70) / 100);
    const y = box.y + box.height * (0.2 + ((i * 53) % 65) / 100);
    if (i % 3 === 0) {
      await page.keyboard.press(keys[i % keys.length]!);
    } else if (isMobile && i % 3 === 1) {
      await page.touchscreen.tap(x, y);
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 30, y - 20, { steps: 3 });
      await page.mouse.up();
    }
    await page.waitForTimeout(90);
  }
}

for (const id of GAME_IDS) {
  test(`${id}: loads, plays, pauses and restarts cleanly`, async ({ page, isMobile }) => {
    const errors = watchErrors(page);
    await startGame(page, id);

    const picker = PICKERS[id];
    if (picker) await page.getByRole('button', { name: picker }).first().click();

    await mash(page, isMobile);
    await expect(page.getByText('Something went wrong.')).toHaveCount(0);

    // Pause/resume round-trip — unless the round already ended (a fast loss is fine).
    const pauseOverlay = page.getByTestId('pause-overlay');
    const results = page.getByTestId('results-overlay');
    const pause = page.getByRole('button', { name: 'Pause' });
    if (
      (await page.getByTestId('game-stage').getAttribute('data-phase')) === 'playing' &&
      (await pause.isVisible())
    ) {
      await pause.click();
      await expect(pauseOverlay.or(results)).toBeVisible();
      if (await pauseOverlay.isVisible()) {
        await pauseOverlay.getByRole('button', { name: 'Resume' }).click();
        await expect(pauseOverlay).toBeHidden();
      }
    }

    await expect(page.getByText('Something went wrong.')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
