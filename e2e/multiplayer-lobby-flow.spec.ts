import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';

// Load .env.local into process.env for test teardown
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

test.describe('Multiplayer Two-Player Lobby & Game Flow', () => {
  test.setTimeout(90000);
  let createdRoomCode: string | null = null;

  test.afterEach(async () => {
    // Delete test room from Supabase afterwards
    if (createdRoomCode) {
      try {
        const supabase = getSupabaseServerClient();
        await supabase.from('rooms').delete().eq('code', createdRoomCode);
      } catch (err) {
        console.error('Failed to cleanup test room:', err);
      }
    }
  });

  test('Unified Lobby Flow: Host creates, Guest joins, ready/un-ready sync, start rejected if not ready, host starts, both reach board, refresh restore, and polling fallback', async ({
    browser,
  }) => {
    // 1. Host creates a room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/');
    await expect(hostPage.locator('#create-room-button')).toBeVisible();

    await hostPage.locator('#create-room-button').click();
    await expect(hostPage.getByText('Create Online Room')).toBeVisible();

    await hostPage.locator('#room-player-name-input').fill('AliceHost');
    await hostPage.locator('#submit-create-room-button').click();

    // Host should enter lobby screen with big room code
    const codeLocator = hostPage.locator('#lobby-room-code');
    await expect(codeLocator).toBeVisible({ timeout: 10000 });
    const roomCode = (await codeLocator.innerText()).trim();
    expect(roomCode.length).toBe(6);
    createdRoomCode = roomCode;

    // Verify copy button, share button, and waiting text
    await expect(hostPage.locator('#lobby-copy-button')).toBeVisible();
    await expect(hostPage.locator('#lobby-share-button')).toBeVisible();
    await expect(hostPage.getByText(/Waiting for players \(1\/2\)/i)).toBeVisible();

    // Verify host sees "Start Game" disabled initially
    const hostStartBtn = hostPage.locator('#lobby-start-button');
    await expect(hostStartBtn).toBeVisible();
    await expect(hostStartBtn).toBeDisabled();
    await expect(hostPage.getByText(/Waiting for all players to join/i)).toBeVisible();

    // Host does NOT see "I'm Ready" button
    await expect(hostPage.locator('#lobby-ready-button')).not.toBeVisible();

    // 2. Host refreshes: Home shows "Resume your game" banner; Host clicks Resume to return to lobby
    await hostPage.reload();
    await expect(hostPage.locator('#resume-game-banner')).toBeVisible({ timeout: 8000 });
    await hostPage.locator('#resume-game-button').click();
    await expect(hostPage.locator('#lobby-room-code')).toBeVisible({ timeout: 8000 });
    await expect(hostPage.locator('#lobby-room-code')).toHaveText(roomCode);
    await expect(hostPage.locator('#lobby-start-button')).toBeVisible();
    await expect(hostPage.locator('#lobby-start-button')).toBeDisabled();

    // 3. Guest joins from separate browser context with Realtime WebSocket blocked (fallback polling test)
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    // Block Supabase realtime websocket to verify fallback polling works when realtime is blocked
    await guestPage.route('**/realtime/v1/**', (route) => route.abort());

    await guestPage.goto('/');
    await hostPage.waitForTimeout(500);

    await guestPage.locator('#join-room-button').click();
    await expect(guestPage.getByText('Join Online Room')).toBeVisible();

    await guestPage.locator('#join-room-code-input').fill(roomCode);
    await guestPage.locator('#join-player-name-input').fill('BobGuest');
    await guestPage.locator('#submit-join-room-button').click();

    // Guest enters lobby
    await expect(guestPage.locator('#lobby-room-code')).toBeVisible({ timeout: 10000 });
    await expect(guestPage.locator('#lobby-room-code')).toHaveText(roomCode);

    // Guest sees "I'm Ready" button; guest does NOT see "Start Game" button
    const guestReadyBtn = guestPage.locator('#lobby-ready-button');
    await expect(guestReadyBtn).toBeVisible();
    await expect(guestReadyBtn).toContainText(/I'm Ready/i);
    await expect(guestPage.locator('#lobby-start-button')).not.toBeVisible();

    // On Host screen (via realtime or polling): Player count updates to 2/2
    await expect(hostPage.getByText(/Waiting for players \(2\/2\)/i)).toBeVisible({ timeout: 8000 });
    await expect(hostPage.getByText('BobGuest')).toBeVisible();

    // On Host screen: Start button is still disabled because BobGuest is not ready
    await expect(hostStartBtn).toBeDisabled();
    await expect(hostPage.getByText(/Waiting for all players to be ready/i)).toBeVisible();

    // 4. Guest clicks "I'm Ready" -> toggles to "Ready ✓"
    await guestReadyBtn.click();
    await expect(guestReadyBtn).toContainText(/Ready ✓/i, { timeout: 10000 });

    // Live update on Host screen: Host sees guest card is "Ready ✓"
    await expect(hostPage.getByText('Ready ✓')).toBeVisible({ timeout: 10000 });

    // Host's Start Game button becomes bright and ENABLED
    await expect(hostStartBtn).toBeEnabled({ timeout: 10000 });
    await expect(hostPage.getByText(/All players ready/i)).toBeVisible();

    // 5. Guest clicks to un-ready -> toggles back to Not Ready
    await guestReadyBtn.click();
    await expect(guestReadyBtn).toContainText(/I'm Ready/i, { timeout: 10000 });

    // Host screen updates: Host's Start Game button becomes DISABLED again
    await expect(hostStartBtn).toBeDisabled({ timeout: 10000 });
    await expect(hostPage.getByText(/Waiting for all players to be ready/i)).toBeVisible();

    // Guest clicks Ready again
    await guestReadyBtn.click();
    await expect(guestReadyBtn).toContainText(/Ready ✓/i, { timeout: 10000 });
    await expect(hostStartBtn).toBeEnabled({ timeout: 10000 });

    // 6. Host clicks "START GAME" -> Both clients transition to game board simultaneously!
    await hostStartBtn.click();

    // Host reaches game board
    await expect(hostPage.locator('#dice-roll-button')).toBeVisible({ timeout: 15000 });
    await expect(hostPage.getByText(/1v1 DUEL|ROOM/i)).toBeVisible();

    // Guest (even with Realtime blocked!) reaches game board via 2.5s fallback polling
    await expect(guestPage.locator('#dice-roll-button')).toBeVisible({ timeout: 15000 });
    await expect(guestPage.getByText(/1v1 DUEL|ROOM/i)).toBeVisible();

    // Both see clear turn indicator text ("Your turn" or "Waiting for")
    await expect(hostPage.getByText(/Your turn – tap the dice/i)).toBeVisible();
    await expect(guestPage.getByText(/Waiting for AliceHost/i)).toBeVisible();

    // 7. Guest refreshes during play: Home shows "Resume your game" banner; Guest clicks Resume to return to board
    await guestPage.reload();
    await expect(guestPage.locator('#resume-game-banner')).toBeVisible({ timeout: 8000 });
    await guestPage.locator('#resume-game-button').click();
    await expect(guestPage.locator('#dice-roll-button')).toBeVisible({ timeout: 10000 });
    await expect(guestPage.getByText(/1v1 DUEL|ROOM/i)).toBeVisible();

    // Cleanup contexts
    await hostContext.close();
    await guestContext.close();
  });
});
