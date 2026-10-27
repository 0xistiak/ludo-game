import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isLocalGameValid,
  isOnlineRoomValid,
  saveLocalGame,
  getLocalSavedGame,
  clearLocalGame,
  saveOnlineRoomCode,
  getOnlineRoomCode,
  clearOnlineRoomCode,
  clearAllGameSessions,
  LUDO_LOCAL_GAME_KEY,
  LUDO_ONLINE_ROOM_KEY,
  LOCAL_GAME_MAX_AGE_MS,
  ONLINE_ROOM_MAX_AGE_MS,
} from '../gameSession';
import { createGame } from '@/engine';
import { RoomRow } from '@/types/multiplayer';

class MockLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, val: string): void {
    this.store.set(key, val);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'window', {
  value: globalThis,
  writable: true,
  configurable: true,
});

describe('gameSession restore and validity logic', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.restoreAllMocks();
  });

  const baseGame = createGame({
    mode: '1v1',
    players: [
      { name: 'Alice', color: 'red' },
      { name: 'Bob', color: 'yellow' },
    ],
  });

  describe('isLocalGameValid', () => {
    it('returns true for fresh active game within 24 hours', () => {
      const now = Date.now();
      const valid = isLocalGameValid(
        {
          gameState: baseGame,
          savedAt: now - 1000 * 60, // 1 minute ago
        },
        now
      );
      expect(valid).toBe(true);
    });

    it('returns false if older than 24 hours', () => {
      const now = Date.now();
      const stale = isLocalGameValid(
        {
          gameState: baseGame,
          savedAt: now - (LOCAL_GAME_MAX_AGE_MS + 1000), // > 24 hours
        },
        now
      );
      expect(stale).toBe(false);
    });

    it('returns false if game is over or has a winner', () => {
      const finishedGame = {
        ...baseGame,
        phase: 'game_over' as const,
        winner: 'red' as const,
      };
      const now = Date.now();
      const invalid = isLocalGameValid(
        {
          gameState: finishedGame,
          savedAt: now,
        },
        now
      );
      expect(invalid).toBe(false);
    });

    it('returns false for corrupted or invalid payload', () => {
      expect(isLocalGameValid(null)).toBe(false);
      expect(isLocalGameValid({})).toBe(false);
      expect(isLocalGameValid({ gameState: {}, savedAt: Date.now() })).toBe(false);
      expect(isLocalGameValid({ gameState: baseGame, savedAt: 'invalid' })).toBe(false);
    });
  });

  describe('isOnlineRoomValid', () => {
    const mockRoom: Partial<RoomRow> = {
      id: 'room-1',
      code: 'ABCD12',
      status: 'playing',
      host_id: 'sess-alice',
      updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };

    const mockPlayers = [
      { session_id: 'sess-alice', seat_index: 0, name: 'Alice' },
      { session_id: 'sess-bob', seat_index: 1, name: 'Bob' },
    ];

    it('returns true when room is playing and player is a member within 30m', () => {
      const now = Date.now();
      expect(isOnlineRoomValid(mockRoom, 'sess-bob', mockPlayers, now)).toBe(true);
    });

    it('returns false when room is older than 30 minutes', () => {
      const now = Date.now();
      const staleRoom: Partial<RoomRow> = {
        ...mockRoom,
        updated_at: new Date(now - (ONLINE_ROOM_MAX_AGE_MS + 5000)).toISOString(),
      };
      expect(isOnlineRoomValid(staleRoom, 'sess-bob', mockPlayers, now)).toBe(false);
    });

    it('returns false when room is finished or abandoned', () => {
      const now = Date.now();
      expect(isOnlineRoomValid({ ...mockRoom, status: 'abandoned' }, 'sess-bob', mockPlayers, now)).toBe(false);
      expect(isOnlineRoomValid({ ...mockRoom, status: 'finished' }, 'sess-bob', mockPlayers, now)).toBe(false);
    });

    it('returns false if player is not in room members', () => {
      const now = Date.now();
      expect(isOnlineRoomValid(mockRoom, 'sess-stranger', mockPlayers, now)).toBe(false);
    });
  });

  describe('Storage persistence helpers', () => {
    it('saves, retrieves, and clears local game', () => {
      saveLocalGame(baseGame);
      const retrieved = getLocalSavedGame();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.gameState.config.mode).toBe('1v1');

      clearLocalGame();
      expect(getLocalSavedGame()).toBeNull();
    });

    it('saves, gets, and clears online room code', () => {
      saveOnlineRoomCode('XYZ123');
      expect(getOnlineRoomCode()).toBe('XYZ123');

      clearOnlineRoomCode();
      expect(getOnlineRoomCode()).toBeNull();
    });

    it('clears local game when finished game is saved', () => {
      saveLocalGame(baseGame);
      expect(getLocalSavedGame()).not.toBeNull();

      const finished = { ...baseGame, phase: 'game_over' as const, winner: 'red' as const };
      saveLocalGame(finished);
      expect(getLocalSavedGame()).toBeNull();
    });

    it('clears all sessions via clearAllGameSessions', () => {
      saveLocalGame(baseGame);
      saveOnlineRoomCode('ROOM99');

      expect(localStorage.getItem(LUDO_LOCAL_GAME_KEY)).not.toBeNull();
      expect(localStorage.getItem(LUDO_ONLINE_ROOM_KEY)).toBe('ROOM99');

      clearAllGameSessions();

      expect(localStorage.getItem(LUDO_LOCAL_GAME_KEY)).toBeNull();
      expect(localStorage.getItem(LUDO_ONLINE_ROOM_KEY)).toBeNull();
    });
  });
});
