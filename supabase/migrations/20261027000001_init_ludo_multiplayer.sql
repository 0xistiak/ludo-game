-- Migration: 20261027000001_init_ludo_multiplayer.sql
-- Server-authoritative online multiplayer tables and policies for Ludo

-- 1. Create rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(6) UNIQUE NOT NULL,
    mode VARCHAR(10) NOT NULL DEFAULT '1v1',
    host_id TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create room_players table
CREATE TABLE IF NOT EXISTS public.room_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color VARCHAR(10) NOT NULL,
    team VARCHAR(20) NOT NULL,
    seat_index INT NOT NULL,
    is_ready BOOLEAN NOT NULL DEFAULT false,
    is_connected BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_room_session UNIQUE (room_id, session_id),
    CONSTRAINT uq_room_color UNIQUE (room_id, color),
    CONSTRAINT uq_room_seat UNIQUE (room_id, seat_index)
);

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON public.room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_session ON public.room_players(room_id, session_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;

-- 5. Policies
DROP POLICY IF EXISTS "Allow public read access to rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow public read access to room_players" ON public.room_players;

-- Realtime subscriptions require SELECT permission for anon & authenticated
CREATE POLICY "Allow public read access to rooms"
    ON public.rooms FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access to room_players"
    ON public.room_players FOR SELECT
    USING (true);

-- 6. Add to Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rooms'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'room_players'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
    END IF;
END $$;
