-- =====================================================
-- Automatic auction status transitions (Supabase-native)
-- Uses pg_cron to run a function every minute that advances
-- auction (and item) statuses based on their configured times.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.process_auction_schedule()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- 1) upcoming -> registration_open once registration has started
  --    (and the auction itself hasn't started yet).
  UPDATE public.auctions
     SET status = 'registration_open'
   WHERE status = 'upcoming'
     AND registration_start <= v_now
     AND auction_start > v_now;

  -- 2) upcoming / registration_open -> live once the start time passes
  --    (and the auction hasn't already ended).
  UPDATE public.auctions
     SET status = 'live'
   WHERE status IN ('upcoming', 'registration_open')
     AND auction_start <= v_now
     AND auction_end > v_now;

  -- 3) Any non-completed auction whose end time has passed -> ended.
  UPDATE public.auctions
     SET status = 'ended'
   WHERE status IN ('upcoming', 'registration_open', 'live')
     AND auction_end <= v_now;

  -- 4) Item-level: active gems past their end time -> ended.
  UPDATE public.gems
     SET status = 'ended'
   WHERE status = 'active'
     AND end_time < v_now;
END;
$$;

-- Schedule the function to run every minute (idempotent).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-auction-schedule') THEN
    PERFORM cron.unschedule('process-auction-schedule');
  END IF;

  PERFORM cron.schedule(
    'process-auction-schedule',
    '* * * * *',
    $cron$ SELECT public.process_auction_schedule(); $cron$
  );
END;
$$;
