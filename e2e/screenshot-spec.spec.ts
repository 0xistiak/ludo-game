import { test } from '@playwright/test';
import path from 'path';

test('Capture Screenshots of all screens for verification', async ({ page }) => {
  // 1. Home Screen across 360, 390, and desktop
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-home-360.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-home.png') });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-home-desktop.png') });

  // Reset to mobile 390x844 for flow test
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

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
