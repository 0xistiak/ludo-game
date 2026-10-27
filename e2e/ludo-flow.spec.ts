import { test, expect } from '@playwright/test';

test.describe('Mobile Ludo User Flow (390x844)', () => {
  test('Complete journey: Home -> Setup -> Gameplay -> Move -> Result -> Home', async ({ page }) => {
    // 1. Visit Home Screen
    await page.goto('/');

    // Verify Title & Hero
    await expect(page.locator('h1')).toHaveText('LUDO');
    await expect(page.getByText('PLAY TOGETHER')).toBeVisible();

    // Verify Mandatory Footer
    const footer = page.locator('footer');
    await expect(footer).toContainText('Developed by istiak.tech');

    // Verify Mode Cards
    await expect(page.locator('#mode-1v1-button')).toBeVisible();
    await expect(page.locator('#mode-2v2-button')).toBeVisible();

    // Verify honest "Not configured yet" state for online room buttons
    await page.locator('#create-room-button').click();
    await expect(page.getByText('Not Configured Yet')).toBeVisible();
    await expect(page.getByText(/Phase 2/)).toBeVisible();
    await page.getByRole('button', { name: 'Got It' }).click();
    await expect(page.getByText('Not Configured Yet')).not.toBeVisible();

    // 2. Navigate to Game Setup
    await page.locator('#play-now-button').click();
    await expect(page.getByText('Game Setup')).toBeVisible();
    await expect(page.locator('#player1-name-input')).toBeVisible();

    // Change player name
    await page.locator('#player1-name-input').fill('Champion');

    // 3. Start Game
    await page.locator('#start-game-button').click();

    // 4. Verify Gameplay Screen
    await expect(page.getByText('1v1 DUEL')).toBeVisible();
    await expect(page.getByText('Champion')).toBeVisible();
    await expect(page.getByText('TURN')).toBeVisible();

    // Verify 3D Dice and SVG board are present
    const diceBtn = page.locator('#dice-roll-button');
    await expect(diceBtn).toBeVisible();
    await expect(page.locator('svg').first()).toBeVisible();

    // 5. Roll the dice
    await diceBtn.click();

    // Wait for rolling animation and settling
    await page.waitForTimeout(800);

    // If legal tokens are highlighted, click the first legal token
    const legalToken = page.locator('.legal-token-glow').first();
    if (await legalToken.isVisible({ timeout: 1500 }).catch(() => false)) {
      await legalToken.click();
      await page.waitForTimeout(500);
    }

    // 6. Test Restart Match dialog
    await page.locator('#restart-match-button').click();
    await expect(page.getByText('Restart Match?')).toBeVisible();
    // Cancel restart
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Restart Match?')).not.toBeVisible();

    // 7. Verify Win & Result Screen
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('test-trigger-win'));
    });

    // Wait for transition to Result Screen
    await expect(page.getByText(/WIN/i)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#play-again-button')).toBeVisible();
    await expect(page.locator('#home-button')).toBeVisible();

    // 8. Click Home button on Result Screen
    await page.locator('#home-button').click();
    await expect(page.locator('h1')).toHaveText('LUDO');
    await expect(page.locator('#play-now-button')).toBeVisible();
  });
});
