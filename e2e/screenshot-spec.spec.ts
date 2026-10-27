import { test, expect } from '@playwright/test';
import path from 'path';

test('Capture Screenshots of all screens for verification', async ({ page }) => {
  test.setTimeout(120000);

  // 1. Home Screen across 360, 390, and desktop
  await page.goto('/');
  await page.setViewportSize({ width: 360, height: 640 });
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-home-360.png'), animations: 'disabled' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-home.png'), animations: 'disabled' });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-home-desktop.png'), animations: 'disabled' });

  // Reset to mobile 390x844 for flow test
  await page.setViewportSize({ width: 390, height: 844 });

  // 2. Setup Screen
  await expect(async () => {
    await page.locator('#play-now-button').click();
    await expect(page.locator('#start-game-button')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-setup.png'), animations: 'disabled' });

  // 3. Gameplay Screen
  await page.locator('#start-game-button').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-gameplay.png'), animations: 'disabled' });

  // 4. Roll Dice
  await page.locator('#dice-roll-button').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-gameplay-rolled.png'), animations: 'disabled' });

  // 5. Result Screen
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('test-trigger-win'));
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(process.cwd(), 'design/screenshot-result.png'), animations: 'disabled' });
});
