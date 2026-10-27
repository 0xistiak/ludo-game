import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { MultiplayerService } from '../service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create unprivileged client (anon role)
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

describe('Multiplayer Security & RLS Isolation Tests', () => {
  describe('1. Direct Client Write Rejection (No Direct INSERT/UPDATE/DELETE)', () => {
    it('blocks client from directly inserting into rooms table', async () => {
      const { data, error } = await anonClient
        .from('rooms')
        .insert({
          code: 'HACK01',
          host_id: 'malicious-client',
          mode: '1v1',
        })
        .select();

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501'); // Postgres permission denied
    });

    it('blocks client from directly updating rooms table', async () => {
      const { data, error } = await anonClient
        .from('rooms')
        .update({ version: 999 })
        .eq('code', 'ANYCOD')
        .select();

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
    });

    it('blocks client from directly deleting from rooms table', async () => {
      const { data, error } = await anonClient
        .from('rooms')
        .delete()
        .eq('code', 'ANYCOD')
        .select();

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
    });

    it('blocks client from directly inserting into room_players table', async () => {
      const { data, error } = await anonClient
        .from('room_players')
        .insert({
          session_id: 'fake-session',
          name: 'Attacker',
          color: 'red',
          team: 'teamA',
          seat_index: 0,
        })
        .select();

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
    });

    it('blocks client from directly updating room_players table', async () => {
      const { data, error } = await anonClient
        .from('room_players')
        .update({ is_ready: true })
        .eq('session_id', 'fake-session')
        .select();

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
    });

    it('blocks client from directly deleting from room_players table', async () => {
      const { data, error } = await anonClient
        .from('room_players')
        .delete()
        .eq('session_id', 'fake-session')
        .select();

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
    });
  });

  describe('2. session_id Column Protection', () => {
    it('blocks client from reading session_id column via direct SELECT', async () => {
      const { data, error } = await anonClient
        .from('room_players')
        .select('session_id');

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501'); // Permission denied for table/column
    });

    it('allows client to read public view without session_id column', async () => {
      const { data, error } = await anonClient
        .from('room_players_public')
        .select('*');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      // Verify no row in data contains session_id
      if (data && data.length > 0) {
        expect(data[0]).not.toHaveProperty('session_id');
      }
    });
  });

  describe('3. Room Enumeration Restriction', () => {
    it('prevents client from listing all rooms', async () => {
      const { data, error } = await anonClient
        .from('rooms')
        .select('*');

      expect(error).toBeNull();
      // Returns empty array because RLS blocks unrestricted table browsing
      expect(data).toEqual([]);
    });

    it('allows reading room strictly through RPC get_room_by_code', async () => {
      const { data, error } = await anonClient
        .rpc('get_room_by_code', { p_code: 'NON_EXISTENT_CODE' });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe('4. Server-Side Session Isolation in MultiplayerService', () => {
    it('strips other players session_id in getRoomData', async () => {
      // Create a mock room data with 2 players
      const hostSession = 'secret-host-session-123';
      const guestSession = 'secret-guest-session-456';

      const created = await MultiplayerService.createRoom({
        mode: '1v1',
        playerName: 'Host',
        playerColor: 'red',
        sessionId: hostSession,
      });

      try {
        const joined = await MultiplayerService.joinRoom({
          roomCode: created.room.code,
          playerName: 'Guest',
          sessionId: guestSession,
        });
        expect(joined.me?.session_id).toBe(guestSession);
        expect(joined.players.length).toBe(2);

        // Request as Guest: Host's session_id must be stripped
        const guestView = await MultiplayerService.getRoomData({
          code: created.room.code,
          sessionId: guestSession,
        });

        const hostInGuestView = guestView.players.find((p) => p.name === 'Host');
        const guestInGuestView = guestView.players.find((p) => p.name === 'Guest');

        expect(hostInGuestView?.session_id).toBeUndefined();
        expect(guestInGuestView?.session_id).toBe(guestSession);

        // Request without session: ALL session_ids must be stripped
        const publicView = await MultiplayerService.getRoomData({
          code: created.room.code,
        });

        for (const p of publicView.players) {
          expect(p.session_id).toBeUndefined();
        }
      } finally {
        const { getSupabaseServerClient } = await import('../../supabase/server');
        const supabase = getSupabaseServerClient();
        await supabase.from('rooms').delete().eq('id', created.room.id);
      }
    });
  });
});
