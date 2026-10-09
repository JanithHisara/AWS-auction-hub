-- Function to get monitor stats bypassing RLS
CREATE OR REPLACE FUNCTION public.get_monitor_stats(p_gem_id UUID)
RETURNS TABLE (
  total_registered BIGINT,
  active_bidders BIGINT
) 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_price DECIMAL;
BEGIN
  -- Get current price of the gem
  SELECT current_price INTO v_current_price FROM public.gems WHERE id = p_gem_id;

  -- Count total registrations
  SELECT count(*) INTO total_registered
  FROM public.auction_registrations
  WHERE gem_id = p_gem_id;

  -- Count bidders at current price
  SELECT count(DISTINCT user_id) INTO active_bidders
  FROM public.bids
  WHERE gem_id = p_gem_id AND bid_amount = v_current_price;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Grant access to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.get_monitor_stats(UUID) TO anon, authenticated, service_role;

