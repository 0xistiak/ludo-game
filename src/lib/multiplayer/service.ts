import crypto from 'crypto';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createGame, rollDice, applyMove } from '@/engine/engine';
import { PlayerColor, getOppositeColor } from '@/engine/geometry';
import { GameState } from '@/engine/types';
import { generateRoomCode } from './roomCodes';
import {
  CreateRoomInput,
  JoinRoomInput,
  ToggleReadyInput,
  RollDiceInput,
  MakeMoveInput,
  ReconnectInput,
  RoomRow,
  RoomPlayerRow,
  MultiplayerRoomData,
} from '@/types/multiplayer';

interface ServiceError extends Error {
  code?: string;
}

function createServiceError(message: string, code?: string): ServiceError {
  const err = new Error(message) as ServiceError;
  if (code) err.code = code;
  return err;
}

export class MultiplayerService {
  /**
   * Creates a new multiplayer room.
   */
  static async createRoom(input: CreateRoomInput): Promise<MultiplayerRoomData> {
    const supabase = getSupabaseServerClient();
    const mode = input.mode;
    const hostColor: PlayerColor = (input.playerColor?.toLowerCase() as PlayerColor) || 'red';
    const hostName = (input.playerName || 'Player 1').trim().slice(0, 20);

    // Generate unique 6-char room code
    let code = generateRoomCode();
    for (let attempts = 0; attempts < 5; attempts++) {
      const { data: existing } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', code)
        .maybeSingle();

      if (!existing) break;
      code = generateRoomCode();
    }

    const team = mode === '2v2' ? 'teamA' : 'none';

    // Initial pre-game state
    const dummyState: GameState = createGame({
      mode,
      players: [
        { name: hostName, color: hostColor },
        { name: 'Waiting...', color: mode === '1v1' ? getOppositeColor(hostColor) : 'yellow' },
      ],
    });

    // 1. Insert Room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code,
        mode,
        host_id: input.sessionId,
        status: 'waiting',
        state: dummyState,
        version: 1,
      })
      .select('*')
      .single();

    if (roomError || !room) {
      throw new Error(`Failed to create room: ${roomError?.message || 'Unknown database error'}`);
    }

    // 2. Insert Host as Player 1
    const { data: player, error: playerError } = await supabase
      .from('room_players')
      .insert({
        room_id: room.id,
        session_id: input.sessionId,
        name: hostName,
        color: hostColor,
        team,
        seat_index: 0,
        is_ready: true, // Host is ready by default
        is_connected: true,
      })
      .select('*')
      .single();

    if (playerError || !player) {
      await supabase.from('rooms').delete().eq('id', room.id);
      throw new Error(`Failed to register host: ${playerError?.message || 'Player insert error'}`);
    }

    return {
      room: room as RoomRow,
      players: [player as RoomPlayerRow],
      me: player as RoomPlayerRow,
    };
  }

  /**
   * Joins an existing room by 6-char code.
   */
  static async joinRoom(input: JoinRoomInput): Promise<MultiplayerRoomData> {
    const supabase = getSupabaseServerClient();
    const code = input.roomCode.trim().toUpperCase();

    // 1. Fetch Room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (roomError || !room) {
      throw new Error('Room not found. Please check the 6-character code.');
    }

    const maxPlayers = room.mode === '1v1' ? 2 : 4;

    // 2. Fetch existing players
    const { data: players, error: playersError } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', room.id)
      .order('seat_index', { ascending: true });

    if (playersError || !players) {
      throw new Error('Failed to retrieve room players');
    }

    // Check if player is already in this room (reconnect scenario)
    const existingMe = players.find((p) => p.session_id === input.sessionId);
    if (existingMe) {
      await supabase
        .from('room_players')
        .update({ is_connected: true, last_seen_at: new Date().toISOString() })
        .eq('id', existingMe.id);

      existingMe.is_connected = true;
      return {
        room: room as RoomRow,
        players: players as RoomPlayerRow[],
        me: existingMe as RoomPlayerRow,
      };
    }

    if (room.status !== 'waiting') {
      throw new Error('This game has already started or finished.');
    }

    if (players.length >= maxPlayers) {
      throw new Error('This room is already full.');
    }

    // Determine seat and color
    const takenSeats = new Set(players.map((p) => p.seat_index));
    let nextSeat = 0;
    while (takenSeats.has(nextSeat) && nextSeat < maxPlayers) {
      nextSeat++;
    }

    const takenColors = new Set(players.map((p) => p.color.toLowerCase()));
    let assignedColor: PlayerColor = 'yellow';

    if (room.mode === '1v1') {
      const hostColor = players[0].color.toLowerCase() as PlayerColor;
      assignedColor = getOppositeColor(hostColor);
    } else {
      const allColors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
      assignedColor = allColors.find((c) => !takenColors.has(c)) || 'yellow';
    }

    const team = room.mode === '2v2'
      ? (assignedColor === 'red' || assignedColor === 'yellow' ? 'teamA' : 'teamB')
      : 'none';

    const playerName = (input.playerName || `Player ${players.length + 1}`).trim().slice(0, 20);

    const { data: newPlayer, error: joinError } = await supabase
      .from('room_players')
      .insert({
        room_id: room.id,
        session_id: input.sessionId,
        name: playerName,
        color: assignedColor,
        team,
        seat_index: nextSeat,
        is_ready: false,
        is_connected: true,
      })
      .select('*')
      .single();

    if (joinError || !newPlayer) {
      throw new Error(`Failed to join room: ${joinError?.message || 'Database error'}`);
    }

    const updatedPlayers = [...players, newPlayer] as RoomPlayerRow[];

    return {
      room: room as RoomRow,
      players: updatedPlayers,
      me: newPlayer as RoomPlayerRow,
    };
  }

  /**
   * Toggles ready state for a player.
   */
  static async toggleReady(input: ToggleReadyInput): Promise<MultiplayerRoomData> {
    const supabase = getSupabaseServerClient();

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', input.roomId)
      .single();

    if (roomError || !room) {
      throw new Error('Room not found');
    }

    const { error: readyError } = await supabase
      .from('room_players')
      .update({ is_ready: input.isReady, last_seen_at: new Date().toISOString() })
      .eq('room_id', input.roomId)
      .eq('session_id', input.sessionId);

    if (readyError) {
      throw new Error(`Failed to update ready state: ${readyError.message}`);
    }

    const { data: players } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', input.roomId)
      .order('seat_index', { ascending: true });

    const playerList = (players || []) as RoomPlayerRow[];
    const requiredCount = room.mode === '1v1' ? 2 : 4;
    const allReady =
      playerList.length === requiredCount &&
      playerList.every((p) => p.is_ready);

    let updatedRoom = room as RoomRow;

    if (allReady && room.status === 'waiting') {
      const enginePlayers = playerList.map((p) => ({
        name: p.name,
        color: p.color.toLowerCase() as PlayerColor,
      }));

      const initialState = createGame({
        mode: room.mode,
        players: enginePlayers,
      });

      const { data: startedRoom, error: startError } = await supabase
        .from('rooms')
        .update({
          status: 'in_progress',
          state: initialState,
          version: room.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', room.id)
        .select('*')
        .single();

      if (!startError && startedRoom) {
        updatedRoom = startedRoom as RoomRow;
      }
    }

    const me = playerList.find((p) => p.session_id === input.sessionId);

    return {
      room: updatedRoom,
      players: playerList,
      me,
    };
  }

  /**
   * Server-authoritative dice roll with atomic turn version check.
   */
  static async rollDiceServer(input: RollDiceInput): Promise<{
    room: RoomRow;
    roll: number;
    legalMoves: string[];
  }> {
    const supabase = getSupabaseServerClient();

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', input.roomId)
      .single();

    if (roomError || !room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'in_progress') {
      throw new Error('Game is not currently in progress');
    }

    // ATOMIC VERSION CHECK
    if (room.version !== input.expectedVersion) {
      throw createServiceError('Version mismatch: out-of-order action rejected.', 'VERSION_CONFLICT');
    }

    // Verify turn ownership
    const { data: players } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', input.roomId);

    const playerList = (players || []) as RoomPlayerRow[];
    const player = playerList.find((p) => p.session_id === input.sessionId);

    if (!player) {
      throw new Error('Player not registered in this room');
    }

    const currentState = room.state as GameState;
    const activePlayer = currentState.players[currentState.activePlayerIndex];

    if (activePlayer.color.toLowerCase() !== player.color.toLowerCase()) {
      throw createServiceError(
        `It is ${activePlayer.name}'s (${activePlayer.color}) turn, not yours.`,
        'NOT_YOUR_TURN'
      );
    }

    if (currentState.phase !== 'need_roll') {
      throw new Error(`Cannot roll dice during phase: ${currentState.phase}`);
    }

    // Cryptographically secure RNG
    const cryptoRng = () => {
      return crypto.randomInt(0, 1000000) / 1000000;
    };

    const rollResult = rollDice(currentState, cryptoRng);
    const newState = rollResult.state;
    const roll = rollResult.roll;
    const legalMoves = rollResult.legalMoves;

    // Atomic CAS DB Update
    const { data: updatedRoom, error: updateError } = await supabase
      .from('rooms')
      .update({
        state: newState,
        version: room.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', room.id)
      .eq('version', room.version)
      .select('*')
      .maybeSingle();

    if (updateError || !updatedRoom) {
      throw createServiceError('Atomic update conflict: concurrent action occurred.', 'VERSION_CONFLICT');
    }

    return {
      room: updatedRoom as RoomRow,
      roll,
      legalMoves,
    };
  }

  /**
   * Server-authoritative move execution with atomic turn version check.
   */
  static async makeMoveServer(input: MakeMoveInput): Promise<{
    room: RoomRow;
  }> {
    const supabase = getSupabaseServerClient();

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', input.roomId)
      .single();

    if (roomError || !room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'in_progress') {
      throw new Error('Game is not currently in progress');
    }

    // ATOMIC VERSION CHECK
    if (room.version !== input.expectedVersion) {
      throw createServiceError('Version mismatch: out-of-order action rejected.', 'VERSION_CONFLICT');
    }

    const { data: players } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', input.roomId);

    const playerList = (players || []) as RoomPlayerRow[];
    const player = playerList.find((p) => p.session_id === input.sessionId);

    if (!player) {
      throw new Error('Player not registered in this room');
    }

    const currentState = room.state as GameState;
    const activePlayer = currentState.players[currentState.activePlayerIndex];

    if (activePlayer.color.toLowerCase() !== player.color.toLowerCase()) {
      throw createServiceError(
        `It is ${activePlayer.name}'s (${activePlayer.color}) turn, not yours.`,
        'NOT_YOUR_TURN'
      );
    }

    if (currentState.phase !== 'need_move') {
      throw new Error(`Cannot make move during phase: ${currentState.phase}`);
    }

    // Server-side move validation and state transition using pure engine
    const nextState = applyMove(currentState, input.tokenId);
    const newStatus = nextState.winner !== null ? 'finished' : 'in_progress';

    // Atomic CAS DB Update
    const { data: updatedRoom, error: updateError } = await supabase
      .from('rooms')
      .update({
        state: nextState,
        status: newStatus,
        version: room.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', room.id)
      .eq('version', room.version)
      .select('*')
      .maybeSingle();

    if (updateError || !updatedRoom) {
      throw createServiceError('Atomic update conflict: concurrent action occurred.', 'VERSION_CONFLICT');
    }

    return {
      room: updatedRoom as RoomRow,
    };
  }

  /**
   * Reconnects an existing player session to a room.
   */
  static async reconnectPlayer(input: ReconnectInput): Promise<MultiplayerRoomData> {
    const supabase = getSupabaseServerClient();
    const code = input.roomCode.trim().toUpperCase();

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (roomError || !room) {
      throw new Error('Room not found');
    }

    const { data: players } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', room.id)
      .order('seat_index', { ascending: true });

    const playerList = (players || []) as RoomPlayerRow[];
    const me = playerList.find((p) => p.session_id === input.sessionId);

    if (me) {
      await supabase
        .from('room_players')
        .update({ is_connected: true, last_seen_at: new Date().toISOString() })
        .eq('id', me.id);

      me.is_connected = true;
    }

    return {
      room: room as RoomRow,
      players: playerList,
      me,
    };
  }

  /**
   * Heartbeat to keep connection status active.
   */
  static async heartbeat(input: { roomId: string; sessionId: string }): Promise<void> {
    const supabase = getSupabaseServerClient();
    await supabase
      .from('room_players')
      .update({
        is_connected: true,
        last_seen_at: new Date().toISOString(),
      })
      .eq('room_id', input.roomId)
      .eq('session_id', input.sessionId);
  }

  /**
   * Get room state by code or ID.
   */
  static async getRoomData(identifier: { code?: string; id?: string }): Promise<MultiplayerRoomData> {
    const supabase = getSupabaseServerClient();
    let query = supabase.from('rooms').select('*');

    if (identifier.id) {
      query = query.eq('id', identifier.id);
    } else if (identifier.code) {
      query = query.eq('code', identifier.code.trim().toUpperCase());
    } else {
      throw new Error('Must provide either id or code');
    }

    const { data: room, error: roomError } = await query.maybeSingle();
    if (roomError || !room) {
      throw new Error('Room not found');
    }

    const { data: players } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', room.id)
      .order('seat_index', { ascending: true });

    return {
      room: room as RoomRow,
      players: (players || []) as RoomPlayerRow[],
    };
  }
}
