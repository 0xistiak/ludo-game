import { test, expect } from '@playwright/test';

test.describe('Mobile Ludo User Flow (390x844)', () => {
  test('Complete journey: Home -> Setup -> Gameplay -> Move -> Result -> Home', async ({ page }) => {
    // 1. Visit Home Screen
    await page.goto('/');

    // Verify Title & Hero Logo
    await expect(page).toHaveTitle(/PlayWebLudo/);
    const logo = page.locator('#playweb-ludo-logo');
    await expect(logo).toBeVisible();
    await expect(page.getByText('PLAY TOGETHER')).toBeVisible();

    // Verify logo is not overflowing the viewport
    const logoBox = await logo.boundingBox();
    expect(logoBox).not.toBeNull();
    if (logoBox) {
      expect(logoBox.width).toBeLessThanOrEqual(390);
      expect(logoBox.x + logoBox.width).toBeLessThanOrEqual(391);
    }

    // Verify Mandatory Footer
    const footer = page.locator('footer');
    await expect(footer).toContainText('Developed by istiak.tech');

    // Verify Mode Cards
    await expect(page.locator('#mode-1v1-button')).toBeVisible();
    await expect(page.locator('#mode-2v2-button')).toBeVisible();

    // Verify Create Room modal opens and closes
    await page.locator('#create-room-button').click();
    await expect(page.getByText('Create Online Room')).toBeVisible();
    await page.locator('#close-create-room-modal').click();
    await expect(page.getByText('Create Online Room')).not.toBeVisible();

    // Verify Join Room modal opens and closes
    await page.locator('#join-room-button').click();
    await expect(page.getByText('Join Online Room')).toBeVisible();
    await page.locator('#close-join-room-modal').click();
    await expect(page.getByText('Join Online Room')).not.toBeVisible();

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
    await expect(page.getByText('TURN', { exact: true })).toBeVisible();

    // Verify 3D Dice and SVG board are present
    const diceBtn = page.locator('#dice-roll-button');
    await expect(diceBtn).toBeVisible();
    await expect(page.locator('svg').first()).toBeVisible();

    // Verify Idle Dice State: Shows PlayWebLudo logo, NO pips, and "Tap to Roll!" hint
    const idleLogo = page.locator('#dice-idle-logo');
    await expect(idleLogo).toBeVisible();
    await expect(page.locator('.dice-pip')).toHaveCount(0);
    await expect(page.getByText(/Tap to Roll!/i)).toBeVisible();

    // 5. Roll the dice
    await diceBtn.click();

    // During roll/tumble: idle logo is hidden and pips are active
    await page.waitForTimeout(200);
    await expect(idleLogo).not.toBeVisible();
    const pipCount = await page.locator('.dice-pip').count();
    expect(pipCount).toBeGreaterThanOrEqual(1);
    expect(pipCount).toBeLessThanOrEqual(6);

    // Wait for roll animation and any auto-move or turn pass to settle
    await page.waitForTimeout(1200);

    // If legal tokens are highlighted and not already auto-moved, click the first legal token
    const legalToken = page.locator('.legal-token-glow').first();
    try {
      if (await legalToken.isVisible({ timeout: 1500 })) {
        await legalToken.click({ timeout: 2000 });
        await page.waitForTimeout(500);
      }
    } catch {
      // Auto-move may have executed the single move automatically
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
    await expect(page.locator('#playweb-ludo-logo')).toBeVisible();
    await expect(page.locator('#play-now-button')).toBeVisible();
  });

  test('Home screen fits in viewport without scrolling at 360x640, 390x844, and desktop', async ({ page }) => {
    for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(vp);
      await page.goto('/');

      const logo = page.locator('#playweb-ludo-logo');
      await expect(logo).toBeVisible();

      // Check logo bounding box
      const box = await logo.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(vp.width);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      }

      // Check no vertical scrolling
      const isScrollable = await page.evaluate(() => {
        return document.documentElement.scrollHeight > window.innerHeight + 1;
      });
      expect(isScrollable).toBe(false);
    }
  });

  test('Dice roll animation runs cleanly and stops with no transform/animation running after completion', async ({ page }) => {
    await page.goto('/');

    await expect(async () => {
      await page.locator('#play-now-button').click();
      await expect(page.getByText('Game Setup')).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    await page.locator('#start-game-button').click();
    await expect(page.locator('#dice-roll-button')).toBeVisible({ timeout: 10000 });

    const diceCube = page.locator('#dice-cube');
    await expect(diceCube).toBeVisible();

    // Trigger dice roll
    await page.locator('#dice-roll-button').click();

    // Wait until tumbling finishes (~600ms tumble animation)
    await page.waitForTimeout(800);

    // Verify dice has finished tumbling and has no residual transform/animation running
    const diceState = await page.evaluate(() => {
      const el = document.getElementById('dice-cube');
      if (!el) return null;
      const computed = window.getComputedStyle(el);
      return {
        hasTumbleClass: el.classList.contains('dice-tumbling'),
        animationName: computed.animationName,
        transform: computed.transform,
      };
    });

    expect(diceState).not.toBeNull();
    expect(diceState?.hasTumbleClass).toBe(false);
    expect(diceState?.animationName).toBe('none');
    expect(diceState?.transform).toBe('none');

    // Wait another 400ms during token selection / phase settling to confirm it stays completely still
    await page.waitForTimeout(400);

    const diceStateAfterPause = await page.evaluate(() => {
      const el = document.getElementById('dice-cube');
      if (!el) return null;
      const computed = window.getComputedStyle(el);
      return {
        hasTumbleClass: el.classList.contains('dice-tumbling'),
        animationName: computed.animationName,
        transform: computed.transform,
      };
    });

    expect(diceStateAfterPause?.hasTumbleClass).toBe(false);
    expect(diceStateAfterPause?.animationName).toBe('none');
    expect(diceStateAfterPause?.transform).toBe('none');
  });

  test('Key buttons (Create Room submit, Join submit, Start Game, Roll/dice, Play Again, Home) are inside viewport with no scrolling at 360x640 and 390x844', async ({
    page,
  }) => {
    const viewports = [
      { width: 360, height: 640 },
      { width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto('/');

      // Helper to assert element bounding box is completely inside the viewport
      const assertInsideViewport = async (selector: string) => {
        const el = page.locator(selector);
        await expect(el).toBeVisible({ timeout: 5000 });
        const box = await el.boundingBox();
        expect(box, `Bounding box for ${selector} on ${vp.width}x${vp.height} must not be null`).not.toBeNull();
        if (box) {
          expect(
            box.y,
            `${selector} top (${box.y}) must be inside viewport top (>= 0)`
          ).toBeGreaterThanOrEqual(0);
          expect(
            box.y + box.height,
            `${selector} bottom (${box.y + box.height}) must be inside viewport height (<= ${vp.height})`
          ).toBeLessThanOrEqual(vp.height + 2);
          expect(
            box.x,
            `${selector} left (${box.x}) must be inside viewport left (>= 0)`
          ).toBeGreaterThanOrEqual(0);
          expect(
            box.x + box.width,
            `${selector} right (${box.x + box.width}) must be inside viewport width (<= ${vp.width})`
          ).toBeLessThanOrEqual(vp.width + 2);
        }
      };

      // 1. Create Room modal submit button
      await page.locator('#create-room-button').click();
      await assertInsideViewport('#submit-create-room-button');
      await page.locator('#close-create-room-modal').click();
      await expect(page.locator('#submit-create-room-button')).not.toBeVisible();

      // 2. Join Room modal submit button
      await page.locator('#join-room-button').click();
      await assertInsideViewport('#submit-join-room-button');
      await page.locator('#close-join-room-modal').click();
      await expect(page.locator('#submit-join-room-button')).not.toBeVisible();

      // 3. Setup screen Start Game button
      await page.locator('#play-now-button').click();
      await assertInsideViewport('#start-game-button');

      // 4. Gameplay screen Roll/dice button
      await page.locator('#start-game-button').click();
      await assertInsideViewport('#dice-roll-button');

      // 5. Result screen Play Again and Home buttons
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('test-trigger-win'));
      });
      await assertInsideViewport('#play-again-button');
      await assertInsideViewport('#home-button');

      // Return to Home for next iteration
      await page.locator('#home-button').click();
      await expect(page.locator('#playweb-ludo-logo')).toBeVisible({ timeout: 5000 });
    }
  });
});

