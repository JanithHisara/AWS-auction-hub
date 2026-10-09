-- RPC function to get registration count (bypasses RLS)
CREATE OR REPLACE FUNCTION get_auction_registration_count(auction_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER 
  FROM public.auction_registrations 
  WHERE auction_id = auction_uuid 
  AND approval_status = 'approved';
$$ LANGUAGE sql SECURITY DEFINER;
