-- Migration: 20261027000003_security_hardening.sql
-- Security Hardening: Protect session_id, block direct writes, restrict room listing

-- 1. Restrict table write permissions from anon and authenticated roles
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.rooms FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.room_players FROM anon, authenticated;

-- Ensure RLS is active on both tables
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;

-- 2. Drop previous select policies
DROP POLICY IF EXISTS "Allow public read access to rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow public read access to room_players" ON public.room_players;
DROP POLICY IF EXISTS "Allow read only by room code" ON public.rooms;
DROP POLICY IF EXISTS "Allow public read access to safe room_players columns" ON public.room_players;

-- 3. Room Players Column-Level Security & Sanitized View:
-- Revoke full-table SELECT from anon and authenticated
REVOKE SELECT ON TABLE public.room_players FROM anon, authenticated;

-- Grant SELECT ONLY on safe columns (session_id is excluded from client reads!)
GRANT SELECT (id, room_id, name, color, team, seat_index, is_ready, is_connected, last_seen_at, created_at)
ON TABLE public.room_players TO anon, authenticated;

-- RLS Policy allowing select on granted safe columns
CREATE POLICY "Allow public read access to safe room_players columns"
ON public.room_players
FOR SELECT
TO anon, authenticated
USING (true);

-- Create a sanitized public view for room_players
CREATE OR REPLACE VIEW public.room_players_public AS
SELECT 
    id,
    room_id,
    name,
    color,
    team,
    seat_index,
    is_ready,
    is_connected,
    last_seen_at,
    created_at
FROM public.room_players;

GRANT SELECT ON public.room_players_public TO anon, authenticated;

-- 4. Rooms: Restrict SELECT so clients cannot list all rooms
GRANT SELECT ON TABLE public.rooms TO anon, authenticated;

-- Policy: Only allow reading a room if matching the x-room-code header or claim
CREATE POLICY "Allow read only by room code"
ON public.rooms
FOR SELECT
TO anon, authenticated
USING (
  code = coalesce(
    nullif(current_setting('request.headers', true)::json->>'x-room-code', ''),
    nullif(current_setting('request.jwt.claim.room_code', true), '')
  )
);

-- Secure RPC function: retrieve a specific room only by passing the room code
CREATE OR REPLACE FUNCTION public.get_room_by_code(p_code TEXT)
RETURNS SETOF public.rooms
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.rooms
    WHERE code = UPPER(p_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_by_code(TEXT) TO anon, authenticated;

-- 5. Explicitly grant ALL privileges to service_role for server-authoritative operations
GRANT ALL ON TABLE public.rooms TO service_role;
GRANT ALL ON TABLE public.room_players TO service_role;
GRANT ALL ON public.room_players_public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
