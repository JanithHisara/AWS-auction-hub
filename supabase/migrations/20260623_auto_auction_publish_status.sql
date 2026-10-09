-- Update process_auction_schedule to automatically transition draft auctions to upcoming when published_at passes.

CREATE OR REPLACE FUNCTION public.process_auction_schedule()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- 0) draft -> upcoming once published_at has passed
  UPDATE public.auctions
     SET status = 'upcoming'
    WHERE status = 'draft'
      AND published_at IS NOT NULL
      AND published_at <= v_now;

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
