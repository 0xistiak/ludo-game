-- Migration: 20261027000004_auto_expire_rooms.sql
-- Auto-expire inactive rooms older than 30 minutes and provide helper function

CREATE OR REPLACE FUNCTION public.expire_inactive_rooms()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    expired_count integer;
BEGIN
    UPDATE public.rooms
    SET status = 'abandoned',
        updated_at = now()
    WHERE status IN ('waiting', 'playing', 'in_progress')
      AND updated_at < (now() - INTERVAL '30 minutes');
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_inactive_rooms() TO anon, authenticated, service_role;
