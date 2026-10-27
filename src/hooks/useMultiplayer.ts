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

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'server_session';
  let id = localStorage.getItem('ludo_session_id');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    localStorage.setItem('ludo_session_id', id);
  }
  return id;
}

export function useMultiplayer() {
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<RoomPlayerRow[]>([]);
  const [me, setMe] = useState<RoomPlayerRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  // Heartbeat interval ref
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roomRef = useRef<RoomRow | null>(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // Sync Room Data helper
  const updateRoomData = useCallback(
    (data: MultiplayerRoomData) => {
      setRoom(data.room);
      setPlayers(data.players);
      if (data.me) {
        setMe(data.me);
      } else if (sessionId) {
        const foundMe = data.players.find((p) => p.session_id === sessionId);
        if (foundMe) setMe(foundMe);
      }
      if (typeof window !== 'undefined' && data.room?.code) {
        localStorage.setItem('ludo_active_room_code', data.room.code);
      }
    },
    [sessionId]
  );

  // Realtime subscription setup
  useEffect(() => {
    if (!room?.id) return;

    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      return;
    }

    const channel = supabase
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
          if (payload.new && (payload.new as RoomRow).id === room.id) {
            setRoom(payload.new as RoomRow);
          }
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
        async () => {
          try {
            const res = await fetch(`/api/room/get?id=${room.id}`);
            const json = await res.json();
            if (json.success && json.data) {
              setPlayers(json.data.players);
              if (sessionId) {
                const foundMe = json.data.players.find((p: RoomPlayerRow) => p.session_id === sessionId);
                if (foundMe) setMe(foundMe);
              }
            }
          } catch {
            // Ignore background fetch error
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsReconnecting(false);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsReconnecting(true);
        }
      });

    // Start heartbeat
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
      supabase.removeChannel(channel);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [room?.id, sessionId]);

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

  // Toggle Ready
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
        if (!json.success) throw new Error(json.error);
        updateRoomData(json.data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to toggle ready';
        setError(msg);
      }
    },
    [room, sessionId, updateRoomData]
  );

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
        if (json.code === 'VERSION_CONFLICT') {
          const refreshRes = await fetch(`/api/room/get?id=${room.id}`);
          const refreshJson = await refreshRes.json();
          if (refreshJson.success) updateRoomData(refreshJson.data);
        }
        throw new Error(json.error);
      }

      setRoom(json.data.room);
      return json.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to roll dice';
      setError(msg);
      throw err;
    }
  }, [room, sessionId, updateRoomData]);

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
          if (json.code === 'VERSION_CONFLICT') {
            const refreshRes = await fetch(`/api/room/get?id=${room.id}`);
            const refreshJson = await refreshRes.json();
            if (refreshJson.success) updateRoomData(refreshJson.data);
          }
          throw new Error(json.error);
        }

        setRoom(json.data.room);
        return json.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to make move';
        setError(msg);
        throw err;
      }
    },
    [room, sessionId, updateRoomData]
  );

  // Reconnect
  const reconnect = useCallback(async (codeToReconnect?: string) => {
    const code =
      codeToReconnect ||
      (typeof window !== 'undefined' ? localStorage.getItem('ludo_active_room_code') : null);

    if (!code) return false;

    setIsLoading(true);
    setIsReconnecting(true);
    try {
      const sid = getOrCreateSessionId();
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
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
      setIsReconnecting(false);
    }
  }, [updateRoomData]);

  // Leave room
  const leaveRoom = useCallback(() => {
    setRoom(null);
    setPlayers([]);
    setMe(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ludo_active_room_code');
    }
  }, []);

  return {
    sessionId,
    room,
    players,
    me,
    isLoading,
    error,
    isReconnecting,
    createRoom,
    joinRoom,
    toggleReady,
    rollDiceServer,
    makeMoveServer,
    reconnect,
    leaveRoom,
  };
}
