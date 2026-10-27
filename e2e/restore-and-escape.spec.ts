import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';

// Load .env.local into process.env for database test teardown
try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {
  // Ignore
}

import { getSupabaseServerClient } from '@/lib/supabase/server';

test.describe('Game Restore & Escape Routes (Tasks 1-4)', () => {
  test.setTimeout(90000);
  let createdRoomCode: string | null = null;

  test.afterEach(async () => {
    // Delete any test rooms from Supabase afterwards
    if (createdRoomCode) {
      try {
        const supabase = getSupabaseServerClient();
        await supabase.from('rooms').delete().eq('code', createdRoomCode);
      } catch (err) {
        console.error('Failed to cleanup test room:', err);
      }
      createdRoomCode = null;
    }
  });

  // (a) start local game → reload → Home shows Resume/Discard; Discard → clean Home
  test('(a) start local game -> reload -> Home shows Resume/Discard; Discard -> clean Home', async ({ page }) => {
    await page.goto('/');

    // Start local game with hydration resilience
    await expect(async () => {
      await page.locator('#play-now-button').click();
      await expect(page.getByText('Game Setup')).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    await page.locator('#start-game-button').click();

    // Verify in gameplay
    await expect(page.locator('#dice-roll-button')).toBeVisible({ timeout: 10000 });

    // Reload page -> MUST open Home with Resume/Discard banner (does NOT jump straight to board)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#resume-game-banner')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#resume-game-button')).toBeVisible();
    await expect(page.locator('#discard-game-button')).toBeVisible();

    // Clicking Discard removes the banner and leaves clean Home
    await page.locator('#discard-game-button').click();
    await expect(page.locator('#resume-game-banner')).not.toBeVisible();
    await expect(page.locator('#play-now-button')).toBeVisible();

    // Reloading again stays on clean Home
    await page.reload();
    await expect(page.locator('#resume-game-banner')).not.toBeVisible();
    await expect(page.locator('#play-now-button')).toBeVisible();
  });

  // (b) Leave game from the menu returns to Home and a reload stays on Home
  test('(b) Leave game from the menu returns to Home and a reload stays on Home', async ({ page }) => {
    await page.goto('/');

    // Start local game
    await expect(async () => {
      await page.locator('#play-now-button').click();
      await expect(page.getByText('Game Setup')).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    await page.locator('#start-game-button').click();
    await expect(page.locator('#dice-roll-button')).toBeVisible({ timeout: 10000 });

    // Open game menu (☰)
    await page.locator('#game-menu-button').click();
    await expect(page.getByText('Game Menu')).toBeVisible();

    // Click Leave Game / Home
    await page.locator('#menu-leave-button').click();
    await expect(page.getByText('Leave Game?')).toBeVisible();

    // Confirm Leave
    await page.locator('#confirm-leave-button').click();

    // Returns to Home
    await expect(page.locator('#play-now-button')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#resume-game-banner')).not.toBeVisible();

    // Reload stays on clean Home
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#play-now-button')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#resume-game-banner')).not.toBeVisible();
  });

  // (c) online: guest leaves, host sees "Player left"
  test('(c) online: guest leaves, host sees "Player left"', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      // 1. Host creates room
      await hostPage.goto('/');
      await expect(hostPage.locator('#create-room-button')).toBeVisible();
      await expect(async () => {
        await hostPage.locator('#create-room-button').click();
        await expect(hostPage.getByText('Create Online Room')).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 15000 });

      await hostPage.locator('#room-player-name-input').fill('AliceHost');
      await hostPage.locator('#submit-create-room-button').click();

      const codeLocator = hostPage.locator('#lobby-room-code');
      await expect(codeLocator).toBeVisible({ timeout: 15000 });
      const roomCode = (await codeLocator.innerText()).trim();
      createdRoomCode = roomCode;

      // 2. Guest joins room
      await guestPage.goto('/');
      await expect(guestPage.locator('#join-room-button')).toBeVisible();
      await expect(async () => {
        await guestPage.locator('#join-room-button').click();
        await expect(guestPage.getByText('Join Online Room')).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 15000 });

      await guestPage.locator('#join-room-code-input').fill(roomCode);
      await guestPage.locator('#join-player-name-input').fill('BobGuest');
      await guestPage.locator('#submit-join-room-button').click();

      // Guest is in lobby
      await expect(guestPage.locator('#lobby-room-code')).toBeVisible({ timeout: 15000 });

      // Guest marks ready
      await guestPage.locator('#lobby-ready-button').click();
      await expect(guestPage.locator('#lobby-ready-button')).toContainText(/Ready ✓/i, { timeout: 10000 });

      // Host starts game
      const hostStartBtn = hostPage.locator('#lobby-start-button');
      await expect(hostStartBtn).toBeEnabled({ timeout: 15000 });
      await hostStartBtn.click();

      // Both reach game board
      await expect(hostPage.locator('#dice-roll-button')).toBeVisible({ timeout: 15000 });
      await expect(guestPage.locator('#dice-roll-button')).toBeVisible({ timeout: 15000 });

      // 3. Guest leaves from in-game menu
      await guestPage.locator('#game-menu-button').click();
      await guestPage.locator('#menu-leave-button').click();
      await guestPage.locator('#confirm-leave-button').click();

      // Guest is returned to Home
      await expect(guestPage.locator('#play-now-button')).toBeVisible({ timeout: 10000 });

      // 4. Host sees "Player Left" modal / banner
      await expect(hostPage.getByText(/Player Left/i)).toBeVisible({ timeout: 15000 });
      await expect(hostPage.locator('#player-left-home-button')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.locator('#player-left-rematch-button')).toBeVisible();

      // Host clicks Return to Home
      await hostPage.locator('#player-left-home-button').click();
      await expect(hostPage.locator('#play-now-button')).toBeVisible({ timeout: 10000 });
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
    }
  });

  // (d) after clearing storage the app opens Home
  test('(d) after clearing storage the app opens Home', async ({ page }) => {
    await page.goto('/');

    // Start a game so state is populated
    await expect(async () => {
      await page.locator('#play-now-button').click();
      await expect(page.getByText('Game Setup')).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    await page.locator('#start-game-button').click();
    await expect(page.locator('#dice-roll-button')).toBeVisible({ timeout: 10000 });

    // Clear all browser storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Reload the app
    await page.reload({ waitUntil: 'domcontentloaded' });

    // App MUST open Home cleanly (no auto-restore, no resume banner, no crash)
    await expect(page.locator('#play-now-button')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#resume-game-banner')).not.toBeVisible();
    await expect(page.locator('#dice-roll-button')).not.toBeVisible();
  });
});
