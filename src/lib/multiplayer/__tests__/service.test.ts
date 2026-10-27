import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiplayerService } from '../service';
import { createGame } from '@/engine';

// Mock getSupabaseServerClient
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn(),
}));

import { getSupabaseServerClient } from '@/lib/supabase/server';

describe('MultiplayerService Server Authoritative Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects dice roll if expectedVersion does not match room version (atomic CAS turn check)', async () => {
    const mockRoom = {
      id: 'room-123',
      code: 'ABCDEF',
      mode: '1v1',
      status: 'in_progress',
      version: 5,
      state: createGame({
        mode: '1v1',
        players: [
          { name: 'Alice', color: 'red' },
          { name: 'Bob', color: 'yellow' },
        ],
      }),
    };

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }),
          }),
        }),
      }),
    };

    vi.mocked(getSupabaseServerClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseServerClient>
    );

    await expect(
      MultiplayerService.rollDiceServer({
        roomId: 'room-123',
        sessionId: 'sess-alice',
        expectedVersion: 4,
      })
    ).rejects.toThrow('Version mismatch: out-of-order action rejected.');
  });

  it('rejects roll if player is not the active player whose turn it is', async () => {
    const gameState = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    const mockRoom = {
      id: 'room-123',
      status: 'in_progress',
      version: 1,
      state: gameState,
    };

    const mockPlayers = [
      { id: 'p1', session_id: 'sess-alice', color: 'red', name: 'Alice' },
      { id: 'p2', session_id: 'sess-bob', color: 'yellow', name: 'Bob' },
    ];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'rooms') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }),
              }),
            }),
          };
        }
        if (table === 'room_players') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockPlayers, error: null }),
            }),
          };
        }
        return {};
      }),
    };

    vi.mocked(getSupabaseServerClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseServerClient>
    );

    await expect(
      MultiplayerService.rollDiceServer({
        roomId: 'room-123',
        sessionId: 'sess-bob',
        expectedVersion: 1,
      })
    ).rejects.toThrow("It is Alice's (red) turn, not yours.");
  });

  it('rejects moves when phase is not need_move', async () => {
    const gameState = createGame({
      mode: '1v1',
      players: [
        { name: 'Alice', color: 'red' },
        { name: 'Bob', color: 'yellow' },
      ],
    });

    const mockRoom = {
      id: 'room-123',
      status: 'in_progress',
      version: 1,
      state: gameState,
    };

    const mockPlayers = [
      { id: 'p1', session_id: 'sess-alice', color: 'red', name: 'Alice' },
      { id: 'p2', session_id: 'sess-bob', color: 'yellow', name: 'Bob' },
    ];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'rooms') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }),
              }),
            }),
          };
        }
        if (table === 'room_players') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockPlayers, error: null }),
            }),
          };
        }
        return {};
      }),
    };

    vi.mocked(getSupabaseServerClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseServerClient>
    );

    await expect(
      MultiplayerService.makeMoveServer({
        roomId: 'room-123',
        sessionId: 'sess-alice',
        tokenId: 'red_0',
        expectedVersion: 1,
      })
    ).rejects.toThrow(/Cannot make move during phase: (awaiting-roll|need_roll)/);
  });

  describe('startGame & toggleReady validation', () => {
    it('rejects startGame if caller is not the host', async () => {
      const mockRoom = {
        id: 'room-123',
        host_id: 'sess-host',
        status: 'waiting',
        mode: '1v1',
      };
      const mockPlayers = [
        { id: 'p1', session_id: 'sess-host', seat_index: 0, is_ready: false, name: 'Host', color: 'red' },
        { id: 'p2', session_id: 'sess-guest', seat_index: 1, is_ready: true, name: 'Guest', color: 'yellow' },
      ];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'rooms') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }),
                }),
              }),
            };
          }
          if (table === 'room_players') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockPlayers, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(getSupabaseServerClient).mockReturnValue(
        mockSupabase as unknown as ReturnType<typeof getSupabaseServerClient>
      );

      await expect(
        MultiplayerService.startGame({
          roomId: 'room-123',
          sessionId: 'sess-guest',
        })
      ).rejects.toThrow('Only the room host can start the game.');
    });

    it('rejects startGame if not enough players are present', async () => {
      const mockRoom = {
        id: 'room-123',
        host_id: 'sess-host',
        status: 'waiting',
        mode: '1v1',
      };
      const mockPlayers = [
        { id: 'p1', session_id: 'sess-host', seat_index: 0, is_ready: false, name: 'Host', color: 'red' },
      ];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'rooms') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }),
                }),
              }),
            };
          }
          if (table === 'room_players') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockPlayers, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(getSupabaseServerClient).mockReturnValue(
        mockSupabase as unknown as ReturnType<typeof getSupabaseServerClient>
      );

      await expect(
        MultiplayerService.startGame({
          roomId: 'room-123',
          sessionId: 'sess-host',
        })
      ).rejects.toThrow('Waiting for more players to join (1/2).');
    });

    it('rejects startGame if any non-host player is not ready', async () => {
      const mockRoom = {
        id: 'room-123',
        host_id: 'sess-host',
        status: 'waiting',
        mode: '1v1',
      };
      const mockPlayers = [
        { id: 'p1', session_id: 'sess-host', seat_index: 0, is_ready: false, name: 'Host', color: 'red' },
        { id: 'p2', session_id: 'sess-guest', seat_index: 1, is_ready: false, name: 'Guest', color: 'yellow' },
      ];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'rooms') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }),
                }),
              }),
            };
          }
          if (table === 'room_players') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockPlayers, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(getSupabaseServerClient).mockReturnValue(
        mockSupabase as unknown as ReturnType<typeof getSupabaseServerClient>
      );

      await expect(
        MultiplayerService.startGame({
          roomId: 'room-123',
          sessionId: 'sess-host',
        })
      ).rejects.toThrow('Waiting for all players to be ready.');
    });

    it('successfully starts game with status playing when host starts and guests are ready', async () => {
      const mockRoom = {
        id: 'room-123',
        host_id: 'sess-host',
        status: 'waiting',
        mode: '1v1',
        version: 1,
      };
      const mockPlayers = [
        { id: 'p1', session_id: 'sess-host', seat_index: 0, is_ready: false, name: 'Host', color: 'red' },
        { id: 'p2', session_id: 'sess-guest', seat_index: 1, is_ready: true, name: 'Guest', color: 'yellow' },
      ];
      const startedRoom = {
        ...mockRoom,
        status: 'playing',
        version: 2,
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'rooms') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }),
                }),
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: startedRoom, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === 'room_players') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockPlayers, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(getSupabaseServerClient).mockReturnValue(
        mockSupabase as unknown as ReturnType<typeof getSupabaseServerClient>
      );

      const result = await MultiplayerService.startGame({
        roomId: 'room-123',
        sessionId: 'sess-host',
      });

      expect(result.room.status).toBe('playing');
      expect(result.room.version).toBe(2);
      expect(result.players.length).toBe(2);
    });

    it('toggleReady never automatically starts the game', async () => {
      const mockRoom = {
        id: 'room-123',
        host_id: 'sess-host',
        status: 'waiting',
        mode: '1v1',
        version: 1,
      };
      const mockPlayers = [
        { id: 'p1', session_id: 'sess-host', seat_index: 0, is_ready: false, name: 'Host', color: 'red' },
        { id: 'p2', session_id: 'sess-guest', seat_index: 1, is_ready: true, name: 'Guest', color: 'yellow' },
      ];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'rooms') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }),
                }),
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { ...mockRoom, version: 2 }, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === 'room_players') {
            return {
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              }),
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockPlayers, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(getSupabaseServerClient).mockReturnValue(
        mockSupabase as unknown as ReturnType<typeof getSupabaseServerClient>
      );

      const result = await MultiplayerService.toggleReady({
        roomId: 'room-123',
        sessionId: 'sess-guest',
        isReady: true,
      });

      // Verify room status remains 'waiting' and did not auto-start
      expect(result.room.status).toBe('waiting');
    });
  });
});

