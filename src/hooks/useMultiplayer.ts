'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  RoomRow,
  RoomPlayerRow,
  MultiplayerRoomData,
  GameMode,
} from '@/types/multiplayer';
import { PlayerColor } from '@/engine/geometry';
import { isOnlineRoomValid } from '@/lib/session/gameSession';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'server_session';
  let id = localStorage.getItem('ludo_session_id');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    localStorage.setItem('ludo_session_id', id);
  }
  return id;
}

export type OnlineScreen = 'lobby' | 'gameplay' | 'result' | null;

export function useMultiplayer() {
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<RoomPlayerRow[]>([]);
  const [me, setMe] = useState<RoomPlayerRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [opponentLeft, setOpponentLeft] = useState<boolean>(false);

  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roomRef = useRef<RoomRow | null>(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // Sync room data helper
  const updateRoomData = useCallback(
    (data: MultiplayerRoomData) => {
      setRoom(data.room);
      setPlayers(data.players);

      if (data.me) {
        setMe(data.me);
      } else if (sessionId) {
        const foundMe = data.players.find(
          (p) => p.session_id === sessionId || (p.seat_index === 0 && data.room.host_id === sessionId)
        );
        if (foundMe) setMe(foundMe);
      }

      if (typeof window !== 'undefined' && data.room?.code) {
        localStorage.setItem('ludo_active_room_code', data.room.code);
      }
    },
    [sessionId]
  );

  // Poll room data from server
  const fetchRoomState = useCallback(async () => {
    const currentRoomId = roomRef.current?.id;
    if (!currentRoomId) return;

    try {
      const res = await fetch(`/api/room/get?id=${currentRoomId}&sessionId=${sessionId}`);
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.room?.status === 'abandoned') {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('ludo_active_room_code');
          }
          setOpponentLeft(true);
          return;
        }

        updateRoomData(json.data);
        setIsConnected(true);
        setIsReconnecting(false);
      }
    } catch {
      // Background poll failure
    }
  }, [sessionId, updateRoomData]);

  // Realtime subscription + Fallback Polling (every 2.5s and visibility/focus/online)
  useEffect(() => {
    if (!room?.id) return;

    let supabase: ReturnType<typeof getSupabaseBrowserClient> | null = null;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      // Supabase browser client not available
    }

    // 1. Setup Supabase Realtime channel if available
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null = null;
    if (supabase) {
      channel = supabase
        .channel(`room_${room.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${room.id}`,
          },
          (payload) => {
            const updated = payload.new as RoomRow | undefined;
            if (updated?.status === 'abandoned') {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('ludo_active_room_code');
              }
              setOpponentLeft(true);
            }
            fetchRoomState();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'room_players',
            filter: `room_id=eq.${room.id}`,
          },
          () => {
            fetchRoomState();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setIsReconnecting(false);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setIsReconnecting(true);
          }
        });
    }

    // 2. Guaranteed Polling Fallback (every 2.5s)
    const pollInterval = setInterval(() => {
      fetchRoomState();
    }, 2500);

    // 3. Tab visibility, focus, and online events
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchRoomState();
      }
    };
    const handleFocus = () => fetchRoomState();
    const handleOnline = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      fetchRoomState();
    };
    const handleOffline = () => {
      setIsConnected(false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 4. Heartbeat interval
    heartbeatTimerRef.current = setInterval(async () => {
      if (roomRef.current?.id && sessionId) {
        try {
          await fetch('/api/room/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: roomRef.current.id, sessionId }),
          });
        } catch {
          // Silent heartbeat catch
        }
      }
    }, 15000);

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
      clearInterval(pollInterval);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [room?.id, sessionId, fetchRoomState]);

  // Reconnect function
  const reconnect = useCallback(
    async (codeToReconnect?: string) => {
      const code =
        codeToReconnect ||
        (typeof window !== 'undefined' ? localStorage.getItem('ludo_active_room_code') : null);

      if (!code) return false;

      setIsLoading(true);
      setIsReconnecting(true);
      try {
        const sid = sessionId || getOrCreateSessionId();
        const res = await fetch('/api/room/reconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: code,
            sessionId: sid,
          }),
        });

        const json = await res.json();
        if (json.success && json.data) {
          updateRoomData(json.data);
          setIsReconnecting(false);
          setIsConnected(true);
          return true;
        }
        // Room not found or unable to reconnect -> clean up
        if (typeof window !== 'undefined') {
          localStorage.removeItem('ludo_active_room_code');
        }
        return false;
      } catch {
        return false;
      } finally {
        setIsLoading(false);
        setIsReconnecting(false);
      }
    },
    [sessionId, updateRoomData]
  );

  // Safe check for restorable room without auto-jumping into the board
  const checkRestorableRoom = useCallback(async (): Promise<MultiplayerRoomData | null> => {
    if (typeof window === 'undefined') return null;
    const cachedCode = localStorage.getItem('ludo_active_room_code');
    if (!cachedCode) return null;

    try {
      const sid = sessionId || getOrCreateSessionId();
      const res = await fetch(`/api/room/get?code=${cachedCode}&sessionId=${sid}`);
      const json = await res.json();
      if (json.success && json.data?.room) {
        const { room: r, players: pl } = json.data;
        if (isOnlineRoomValid(r, sid, pl)) {
          return json.data;
        }
      }
      localStorage.removeItem('ludo_active_room_code');
      return null;
    } catch {
      return null;
    }
  }, [sessionId]);

  // Create Room
  const createRoom = useCallback(
    async (mode: GameMode, playerName: string, color?: PlayerColor) => {
      setIsLoading(true);
      setError(null);
      try {
        const sid = sessionId || getOrCreateSessionId();
        const res = await fetch('/api/room/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            playerName,
            playerColor: color,
            sessionId: sid,
          }),
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to create room');

        updateRoomData(json.data);
        return json.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create room';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, updateRoomData]
  );

  // Join Room
  const joinRoom = useCallback(
    async (roomCode: string, playerName: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const sid = sessionId || getOrCreateSessionId();
        const res = await fetch('/api/room/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode,
            playerName,
            sessionId: sid,
          }),
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to join room');

        updateRoomData(json.data);
        return json.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to join room';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, updateRoomData]
  );

  // Toggle Ready (Guest only)
  const toggleReady = useCallback(
    async (isReady: boolean) => {
      if (!room?.id) return;
      setError(null);
      try {
        const res = await fetch('/api/room/ready', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: room.id,
            sessionId,
            isReady,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to update ready state');
        updateRoomData(json.data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to toggle ready';
        setError(msg);
      }
    },
    [room, sessionId, updateRoomData]
  );

  // Start Game (Host only)
  const startGame = useCallback(async () => {
    if (!room?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/room/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          sessionId,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to start game');

      updateRoomData(json.data);
      return json.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start game';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [room, sessionId, updateRoomData]);

  // Leave Room
  const leaveRoom = useCallback(async () => {
    const roomId = room?.id;
    if (roomId) {
      try {
        await fetch('/api/room/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            sessionId,
          }),
        });
      } catch {
        // Keep going with local cleanup
      }
    }

    setRoom(null);
    setPlayers([]);
    setMe(null);
    setError(null);
    setOpponentLeft(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ludo_active_room_code');
    }
  }, [room, sessionId]);

  // Server-authoritative Dice Roll
  const rollDiceServer = useCallback(async () => {
    if (!room?.id) return;
    setError(null);
    try {
      const res = await fetch('/api/room/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          sessionId,
          expectedVersion: room.version,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        await fetchRoomState();
        throw new Error(json.error);
      }

      setRoom(json.data.room);
      return json.data;
    } catch (err: unknown) {
      await fetchRoomState();
      const msg = err instanceof Error ? err.message : 'Failed to roll dice';
      setError(msg);
      throw err;
    }
  }, [room, sessionId, fetchRoomState]);

  // Server-authoritative Move
  const makeMoveServer = useCallback(
    async (tokenId: string) => {
      if (!room?.id) return;
      setError(null);
      try {
        const res = await fetch('/api/room/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: room.id,
            sessionId,
            tokenId,
            expectedVersion: room.version,
          }),
        });

        const json = await res.json();
        if (!json.success) {
          await fetchRoomState();
          throw new Error(json.error);
        }

        setRoom(json.data.room);
        return json.data;
      } catch (err: unknown) {
        await fetchRoomState();
        const msg = err instanceof Error ? err.message : 'Failed to make move';
        setError(msg);
        throw err;
      }
    },
    [room, sessionId, fetchRoomState]
  );

  // Determine if current user is the host
  const isHost = Boolean(
    me?.is_host ||
    (room && sessionId && room.host_id === sessionId) ||
    (me && me.seat_index === 0)
  );

  // Single unified online screen router
  const onlineScreen: OnlineScreen = room
    ? room.status === 'waiting'
      ? 'lobby'
      : room.status === 'playing' || room.status === 'in_progress'
      ? 'gameplay'
      : room.status === 'finished'
      ? 'result'
      : null
    : null;

  return {
    sessionId,
    room,
    players,
    me,
    isHost,
    onlineScreen,
    isLoading,
    error,
    isReconnecting,
    isConnected,
    opponentLeft,
    setOpponentLeft,
    checkRestorableRoom,
    createRoom,
    joinRoom,
    toggleReady,
    startGame,
    leaveRoom,
    rollDiceServer,
    makeMoveServer,
    reconnect,
    fetchRoomState,
  };
}
