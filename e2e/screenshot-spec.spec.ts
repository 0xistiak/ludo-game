import { test } from '@playwright/test';
import path from 'path';

test('Capture Screenshots of all screens for verification', async ({ page }) => {
  // 1. Home Screen
  await page.goto('/');
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-home.png') });

  // 2. Setup Screen
  await page.locator('#play-now-button').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-setup.png') });

  // 3. Gameplay Screen
  await page.locator('#start-game-button').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-gameplay.png') });

  // 4. Roll Dice
  await page.locator('#dice-roll-button').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-gameplay-rolled.png') });

  // 5. Result Screen
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('test-trigger-win'));
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-result.png') });
});
