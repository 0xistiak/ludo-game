import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/room/[action]/route';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { GameState } from '@/engine';
import type { RoomPlayerRow } from '@/types/multiplayer';

export async function runOnlineFlowCheck() {
  console.log('--- STARTING ONLINE FLOW SIMULATION ---');
  let testRoomId: string | null = null;
  let testRoomCode: string | null = null;

  try {
    const hostSession = 'session-host-' + Date.now();
    const guestSession = 'session-guest-' + Date.now();
    const imposterSession = 'session-imposter-' + Date.now();

    // 1. Create Room (Host)
    console.log('Step 1: Creating room via POST /api/room/create...');
    const createReq = new NextRequest('http://localhost:3000/api/room/create', {
      method: 'POST',
      body: JSON.stringify({
        mode: '1v1',
        playerName: 'HostAlice',
        playerColor: 'red',
        sessionId: hostSession,
      }),
    });
    const createRes = await POST(createReq, { params: Promise.resolve({ action: 'create' }) });
    const createJson = await createRes.json();

    if (!createJson.success || !createJson.data?.room?.code) {
      throw new Error(`Failed to create room: ${JSON.stringify(createJson)}`);
    }

    testRoomId = createJson.data.room.id;
    testRoomCode = createJson.data.room.code;
    let currentVersion = createJson.data.room.version;
    console.log(`✓ Room created with code: ${testRoomCode}, ID: ${testRoomId}, Version: ${currentVersion}`);

    // Verify host sees their session, but no leaked sessions
    const hostPlayers = createJson.data.players;
    if (hostPlayers[0].session_id !== hostSession) {
      throw new Error('Host session mismatch in create response');
    }

    // 2. Second player joins (Guest)
    console.log('Step 2: Second player joining via POST /api/room/join...');
    const joinReq = new NextRequest('http://localhost:3000/api/room/join', {
      method: 'POST',
      body: JSON.stringify({
        roomCode: testRoomCode,
        playerName: 'GuestBob',
        sessionId: guestSession,
      }),
    });
    const joinRes = await POST(joinReq, { params: Promise.resolve({ action: 'join' }) });
    const joinJson = await joinRes.json();

    if (!joinJson.success) {
      throw new Error(`Failed to join room: ${JSON.stringify(joinJson)}`);
    }

    // Check session_id isolation: Guest must see their own session, host session must be stripped
    const guestPlayers = joinJson.data.players as RoomPlayerRow[];
    const hostInGuestResp = guestPlayers.find((p: RoomPlayerRow) => p.name === 'HostAlice');
    const guestInGuestResp = guestPlayers.find((p: RoomPlayerRow) => p.name === 'GuestBob');

    if (hostInGuestResp?.session_id) {
      throw new Error(`CRITICAL SECURITY FAILURE: Host session_id was leaked to guest! (${hostInGuestResp.session_id})`);
    }
    if (guestInGuestResp?.session_id !== guestSession) {
      throw new Error('Guest session_id missing from own view');
    }
    console.log('✓ Guest joined successfully. Host session_id is cleanly hidden.');

    // 3. Test: Guest ready and un-ready flow
    console.log('Step 3: Guest toggling ready state via POST /api/room/ready...');
    const readyReq = new NextRequest('http://localhost:3000/api/room/ready', {
      method: 'POST',
      body: JSON.stringify({
        roomId: testRoomId,
        sessionId: guestSession,
        isReady: true,
      }),
    });
    const readyRes = await POST(readyReq, { params: Promise.resolve({ action: 'ready' }) });
    const readyJson = await readyRes.json();

    if (!readyJson.success) {
      throw new Error(`Failed to set ready: ${JSON.stringify(readyJson)}`);
    }

    // Verify room NEVER starts automatically
    if (readyJson.data.room.status !== 'waiting') {
      throw new Error(`Room should still be 'waiting' after ready, got: ${readyJson.data.room.status}`);
    }
    console.log('✓ Guest is ready. Room correctly remains in waiting status (NO auto-start).');

    // 4. Test: Non-host cannot start game
    console.log('Step 4: Verifying guest cannot start game...');
    const guestStartReq = new NextRequest('http://localhost:3000/api/room/start', {
      method: 'POST',
      body: JSON.stringify({
        roomId: testRoomId,
        sessionId: guestSession,
      }),
    });
    const guestStartRes = await POST(guestStartReq, { params: Promise.resolve({ action: 'start' }) });
    const guestStartJson = await guestStartRes.json();
    if (guestStartJson.success) {
      throw new Error('Guest was erroneously allowed to start game!');
    }
    console.log('✓ Guest start game rejected with error:', guestStartJson.error);

    // 5. Test: Guest can un-ready and Host cannot start if non-host is un-ready
    console.log('Step 5: Testing un-ready and start rejection when not all ready...');
    const unreadyReq = new NextRequest('http://localhost:3000/api/room/ready', {
      method: 'POST',
      body: JSON.stringify({
        roomId: testRoomId,
        sessionId: guestSession,
        isReady: false,
      }),
    });
    await POST(unreadyReq, { params: Promise.resolve({ action: 'ready' }) });

    const hostStartNotReadyReq = new NextRequest('http://localhost:3000/api/room/start', {
      method: 'POST',
      body: JSON.stringify({
        roomId: testRoomId,
        sessionId: hostSession,
      }),
    });
    const hostStartNotReadyRes = await POST(hostStartNotReadyReq, { params: Promise.resolve({ action: 'start' }) });
    const hostStartNotReadyJson = await hostStartNotReadyRes.json();
    if (hostStartNotReadyJson.success) {
      throw new Error('Host was allowed to start game when players were not ready!');
    }
    console.log('✓ Host start rejected while player is un-ready:', hostStartNotReadyJson.error);

    // Guest re-readies with a fresh Request instance
    const reReadyReq = new NextRequest('http://localhost:3000/api/room/ready', {
      method: 'POST',
      body: JSON.stringify({
        roomId: testRoomId,
        sessionId: guestSession,
        isReady: true,
      }),
    });
    await POST(reReadyReq, { params: Promise.resolve({ action: 'ready' }) });

    // 6. Host starts game
    console.log('Step 6: Host starting game via POST /api/room/start...');
    const hostStartReq = new NextRequest('http://localhost:3000/api/room/start', {
      method: 'POST',
      body: JSON.stringify({
        roomId: testRoomId,
        sessionId: hostSession,
      }),
    });
    const hostStartRes = await POST(hostStartReq, { params: Promise.resolve({ action: 'start' }) });
    const hostStartJson = await hostStartRes.json();

    if (!hostStartJson.success || hostStartJson.data.room.status !== 'playing') {
      throw new Error(`Failed to start game: ${JSON.stringify(hostStartJson)}`);
    }

    const gameRoom = hostStartJson.data.room;
    currentVersion = gameRoom.version;
    console.log(`✓ Host started match successfully! Status: ${gameRoom.status}, Version: ${currentVersion}`);

    // Check active player
    const state = gameRoom.state as GameState;
    const activePlayerIndex = state.activePlayerIndex;
    const activePlayerColor = state.players[activePlayerIndex].color;
    const activeSession = activePlayerColor === 'red' ? hostSession : guestSession;
    const inactiveSession = activePlayerColor === 'red' ? guestSession : hostSession;
    console.log(`Active player is ${activePlayerColor} (Seat ${activePlayerIndex})`);

    // 4. Test: Wrong-turn move / roll is rejected
    console.log('Step 4: Verifying wrong-turn player cannot roll...');
    const wrongTurnReq = new NextRequest('http://localhost:3000/api/room/roll', {
      method: 'POST',
      body: JSON.stringify({
        roomId: testRoomId,
        sessionId: inactiveSession,
        expectedVersion: currentVersion,
      }),
    });
    const wrongTurnRes = await POST(wrongTurnReq, { params: Promise.resolve({ action: 'roll' }) });
    const wrongTurnJson = await wrongTurnRes.json();

    if (wrongTurnJson.success || wrongTurnJson.code !== 'NOT_YOUR_TURN') {
      throw new Error(`Expected NOT_YOUR_TURN error, got: ${JSON.stringify(wrongTurnJson)}`);
    }
    console.log('✓ Inactive player roll was correctly rejected (NOT_YOUR_TURN).');

    // 5. Test: Imposter cannot act for another seat
    console.log('Step 5: Verifying imposter cannot act for another seat...');
    const imposterReq = new NextRequest('http://localhost:3000/api/room/roll', {
      method: 'POST',
      body: JSON.stringify({
        roomId: testRoomId,
        sessionId: imposterSession,
        expectedVersion: currentVersion,
      }),
    });
    const imposterRes = await POST(imposterReq, { params: Promise.resolve({ action: 'roll' }) });
    const imposterJson = await imposterRes.json();

    if (imposterJson.success) {
      throw new Error('Imposter session was erroneously allowed to act!');
    }
    console.log('✓ Imposter action was rejected with error:', imposterJson.error);

    // 6. Active player rolls
    console.log('Step 6: Active player rolling via POST /api/room/roll...');
    const validRollReq = new NextRequest('http://localhost:3000/api/room/roll', {
      method: 'POST',
      body: JSON.stringify({
        roomId: testRoomId,
        sessionId: activeSession,
        expectedVersion: currentVersion,
      }),
    });
    const validRollRes = await POST(validRollReq, { params: Promise.resolve({ action: 'roll' }) });
    const validRollJson = await validRollRes.json();

    if (!validRollJson.success) {
      throw new Error(`Failed to roll dice: ${JSON.stringify(validRollJson)}`);
    }

    const rolledValue = validRollJson.data.roll;
    const legalMoves = validRollJson.data.legalMoves;
    const postRollVersion = validRollJson.data.room.version;
    console.log(`✓ Rolled ${rolledValue}. Legal moves: [${legalMoves.join(', ')}]. Version advanced to: ${postRollVersion}`);

    // 7. Test: Stale / Duplicate Roll or Move is rejected (Version Conflict)
    console.log('Step 7: Verifying stale action with old version is rejected...');
    const staleReq = new NextRequest('http://localhost:3000/api/room/roll', {
      method: 'POST',
      body: JSON.stringify({
        roomId: testRoomId,
        sessionId: activeSession,
        expectedVersion: currentVersion, // STALE VERSION
      }),
    });
    const staleRes = await POST(staleReq, { params: Promise.resolve({ action: 'roll' }) });
    const staleJson = await staleRes.json();

    if (staleJson.success || staleRes.status !== 409 || staleJson.code !== 'VERSION_CONFLICT') {
      throw new Error(`Expected 409 VERSION_CONFLICT, got status ${staleRes.status}: ${JSON.stringify(staleJson)}`);
    }
    console.log('✓ Stale action with old version was correctly rejected with 409 VERSION_CONFLICT.');

    // 8. Test Move (if phase is need_move or setup a need_move state to verify move execution)
    const postRollState = validRollJson.data.room.state as GameState;
    if ((postRollState.phase === 'need_move' || postRollState.phase === 'awaiting-move') && legalMoves.length > 0) {
      console.log('Step 8: Executing legal move via POST /api/room/move...');
      const moveReq = new NextRequest('http://localhost:3000/api/room/move', {
        method: 'POST',
        body: JSON.stringify({
          roomId: testRoomId,
          sessionId: activeSession,
          tokenId: legalMoves[0],
          expectedVersion: postRollVersion,
        }),
      });
      const moveRes = await POST(moveReq, { params: Promise.resolve({ action: 'move' }) });
      const moveJson = await moveRes.json();
      if (!moveJson.success) {
        throw new Error(`Move failed: ${JSON.stringify(moveJson)}`);
      }
      console.log(`✓ Move executed successfully. New Version: ${moveJson.data.room.version}`);

      // Verify duplicate move is rejected
      const dupMoveReq = new NextRequest('http://localhost:3000/api/room/move', {
        method: 'POST',
        body: JSON.stringify({
          roomId: testRoomId,
          sessionId: activeSession,
          tokenId: legalMoves[0],
          expectedVersion: postRollVersion, // STALE VERSION
        }),
      });
      const dupMoveRes = await POST(dupMoveReq, { params: Promise.resolve({ action: 'move' }) });
      const dupMoveJson = await dupMoveRes.json();
      if (dupMoveJson.success || dupMoveRes.status !== 409) {
        throw new Error(`Expected duplicate move rejection with 409, got: ${JSON.stringify(dupMoveJson)}`);
      }
      console.log('✓ Duplicate move rejected with 409 VERSION_CONFLICT.');
    } else {
      console.log('Step 8: Roll did not produce legal move (normal Ludo rule if no 6 rolled from yard). Testing move rejection for illegal phase...');
      const moveReq = new NextRequest('http://localhost:3000/api/room/move', {
        method: 'POST',
        body: JSON.stringify({
          roomId: testRoomId,
          sessionId: activeSession,
          tokenId: `${activePlayerColor}_0`,
          expectedVersion: postRollVersion,
        }),
      });
      const moveRes = await POST(moveReq, { params: Promise.resolve({ action: 'move' }) });
      const moveJson = await moveRes.json();
      if (moveJson.success) {
        throw new Error('Move should not succeed during need_roll phase');
      }
      console.log('✓ Illegal move correctly rejected during need_roll phase:', moveJson.error);
    }

    // 9. Verify Public GET does NOT expose session_id
    console.log('Step 9: Verifying GET /api/room/get strips all session_ids for unauthenticated readers...');
    const getReq = new NextRequest(`http://localhost:3000/api/room/get?code=${testRoomCode}`);
    const getRes = await GET(getReq, { params: Promise.resolve({ action: 'get' }) });
    const getJson = await getRes.json();

    if (!getJson.success || !getJson.data?.players) {
      throw new Error(`Failed to fetch room data: ${JSON.stringify(getJson)}`);
    }

    for (const player of getJson.data.players) {
      if (player.session_id) {
        throw new Error(`CRITICAL LEAK: player ${player.name} exposed session_id: ${player.session_id}`);
      }
    }
    console.log('✓ Public GET verified: zero session_ids exposed to client.');

    console.log('--- ALL ONLINE FLOW CHECKS PASSED PERFECTLY ---');
    return { success: true };
  } finally {
    // 10. Clean up test room
    if (testRoomId) {
      console.log(`Cleaning up test room ${testRoomId}...`);
      const supabase = getSupabaseServerClient();
      await supabase.from('rooms').delete().eq('id', testRoomId);
      console.log('✓ Test room successfully deleted.');
    }
  }
}
