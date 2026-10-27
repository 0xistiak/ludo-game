-- Migration: 20261027000002_multiplayer_functions.sql
-- Server-side functions for atomic operations and room management

-- Function: generate unique 6-char room code
CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excludes ambiguous chars (0, O, 1, I)
    result TEXT := '';
    i INT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        result := '';
        FOR i IN 1..6 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
        
        SELECT EXISTS (SELECT 1 FROM public.rooms WHERE code = result) INTO code_exists;
        IF NOT code_exists THEN
            EXIT;
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Function: Atomic Compare-and-Swap state update with version check
CREATE OR REPLACE FUNCTION public.update_room_state_atomic(
    p_room_id UUID,
    p_new_state JSONB,
    p_expected_version BIGINT
)
RETURNS JSONB AS $$
DECLARE
    v_updated_row public.rooms%ROWTYPE;
BEGIN
    UPDATE public.rooms
    SET 
        state = p_new_state,
        version = version + 1,
        updated_at = now()
    WHERE id = p_room_id AND version = p_expected_version
    RETURNING * INTO v_updated_row;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'version', v_updated_row.version,
            'state', v_updated_row.state
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error', 'VERSION_CONFLICT',
            'message', 'State version mismatch or room not found'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Player heartbeat for presence / reconnect tracking
CREATE OR REPLACE FUNCTION public.touch_player_heartbeat(
    p_room_id UUID,
    p_session_id TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.room_players
    SET 
        is_connected = true,
        last_seen_at = now()
    WHERE room_id = p_room_id AND session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
