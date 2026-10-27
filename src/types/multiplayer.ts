import { GameMode, GameState } from '@/engine/types';
import { PlayerColor } from '@/engine/geometry';

export type { GameMode, GameState, PlayerColor };

export type RoomStatus = 'waiting' | 'in_progress' | 'finished' | 'abandoned';

export interface RoomRow {
  id: string;
  code: string;
  mode: GameMode;
  host_id: string;
  status: RoomStatus;
  state: GameState;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RoomPlayerRow {
  id: string;
  room_id: string;
  session_id: string;
  name: string;
  color: PlayerColor;
  team: string;
  seat_index: number;
  is_ready: boolean;
  is_connected: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface MultiplayerRoomData {
  room: RoomRow;
  players: RoomPlayerRow[];
  me?: RoomPlayerRow;
}

export interface CreateRoomInput {
  mode: GameMode;
  playerName: string;
  playerColor?: PlayerColor;
  sessionId: string;
}

export interface JoinRoomInput {
  roomCode: string;
  playerName: string;
  sessionId: string;
  preferredColor?: PlayerColor;
}

export interface ToggleReadyInput {
  roomId: string;
  sessionId: string;
  isReady: boolean;
}

export interface RollDiceInput {
  roomId: string;
  sessionId: string;
  expectedVersion: number;
}

export interface MakeMoveInput {
  roomId: string;
  sessionId: string;
  tokenId: string;
  expectedVersion: number;
}

export interface ReconnectInput {
  roomCode: string;
  sessionId: string;
}

export interface HeartbeatInput {
  roomId: string;
  sessionId: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: 'VERSION_CONFLICT' | 'NOT_YOUR_TURN' | 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'GAME_NOT_STARTED' | 'INVALID_ACTION';
}
