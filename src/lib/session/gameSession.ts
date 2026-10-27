/**
 * gameSession.ts
 *
 * Single centralized module managing persistence, validity checks,
 * auto-expiration, and escape/cleanup for both local and online game sessions.
 */

import { GameState } from '@/engine/types';
import { RoomRow, RoomPlayerRow } from '@/types/multiplayer';

export const LUDO_LOCAL_GAME_KEY = 'ludo_active_local_game';
export const LUDO_ONLINE_ROOM_KEY = 'ludo_active_room_code';

export const LOCAL_GAME_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const ONLINE_ROOM_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export interface SavedLocalGame {
  gameState: GameState;
  savedAt: number;
}

export interface RestorableLocalSession {
  type: 'local';
  gameState: GameState;
  savedAt: number;
}

export interface RestorableOnlineSession {
  type: 'online';
  roomCode: string;
  room?: RoomRow;
  players?: RoomPlayerRow[];
  me?: RoomPlayerRow;
  savedAt?: number;
}

export type RestorableSession = RestorableLocalSession | RestorableOnlineSession;

/**
 * Validates whether a local game can be restored.
 * Rules:
 * - Must have valid GameState with players and tokens
 * - Must not be finished / game over
 * - Must not be older than 24 hours
 */
export function isLocalGameValid(
  data: unknown,
  now = Date.now()
): data is SavedLocalGame {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Partial<SavedLocalGame>;

  if (typeof candidate.savedAt !== 'number' || candidate.savedAt <= 0) return false;
  if (now - candidate.savedAt > LOCAL_GAME_MAX_AGE_MS) return false;

  const gs = candidate.gameState;
  if (!gs || typeof gs !== 'object') return false;
  if (gs.phase === 'game_over' || gs.winner !== null || gs.winnerTeam !== null) {
    return false;
  }
  if (!Array.isArray(gs.players) || gs.players.length < 2) return false;
  if (!gs.tokens || typeof gs.tokens !== 'object') return false;

  return true;
}

/**
 * Validates whether an online room session is restorable.
 * Rules:
 * - Room must exist
 * - Status must be 'waiting', 'playing', or 'in_progress' (not finished, not abandoned)
 * - Last activity must be within 30 minutes
 * - Player must still be a registered member
 */
export function isOnlineRoomValid(
  room: Partial<RoomRow> | null | undefined,
  sessionId: string,
  players: Partial<RoomPlayerRow>[] = [],
  now = Date.now()
): boolean {
  if (!room || !room.id || !room.code) return false;

  const status = room.status;
  if (status !== 'waiting' && status !== 'playing' && status !== 'in_progress') {
    return false;
  }

  const timestampStr = room.updated_at || room.created_at;
  if (!timestampStr) return false;
  const lastActivity = new Date(timestampStr).getTime();
  if (isNaN(lastActivity) || now - lastActivity > ONLINE_ROOM_MAX_AGE_MS) {
    return false;
  }

  // Must still be a member in the player list (or host)
  const isMember = players.some(
    (p) => p.session_id === sessionId || (p.seat_index === 0 && room.host_id === sessionId)
  );

  return isMember;
}

/**
 * Saves local game to localStorage. If game is over or winner is declared, cleans it up.
 */
export function saveLocalGame(state: GameState | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!state || state.phase === 'game_over' || state.winner !== null || state.winnerTeam !== null) {
      clearLocalGame();
      return;
    }
    const payload: SavedLocalGame = {
      gameState: state,
      savedAt: Date.now(),
    };
    localStorage.setItem(LUDO_LOCAL_GAME_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save local game to storage', err);
  }
}

/**
 * Retrieves saved local game from localStorage if valid. If expired or corrupted, removes it.
 */
export function getLocalSavedGame(): SavedLocalGame | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LUDO_LOCAL_GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isLocalGameValid(parsed)) {
      return parsed;
    }
    // Expired or invalid -> clean up
    clearLocalGame();
    return null;
  } catch {
    clearLocalGame();
    return null;
  }
}

/**
 * Clears saved local game from localStorage.
 */
export function clearLocalGame(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LUDO_LOCAL_GAME_KEY);
  } catch {
    // ignore
  }
}

/**
 * Saves online room code to localStorage.
 */
export function saveOnlineRoomCode(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LUDO_ONLINE_ROOM_KEY, code.trim().toUpperCase());
  } catch {
    // ignore
  }
}

/**
 * Gets online room code from localStorage.
 */
export function getOnlineRoomCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LUDO_ONLINE_ROOM_KEY);
  } catch {
    return null;
  }
}

/**
 * Clears online room code from localStorage.
 */
export function clearOnlineRoomCode(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LUDO_ONLINE_ROOM_KEY);
  } catch {
    // ignore
  }
}

/**
 * Clears all active session data (both local and online).
 */
export function clearAllGameSessions(): void {
  clearLocalGame();
  clearOnlineRoomCode();
}
