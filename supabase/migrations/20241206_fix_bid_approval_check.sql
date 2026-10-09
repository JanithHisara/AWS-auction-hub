-- Fix: Require approved registration to place bids

-- Drop existing policy
DROP POLICY IF EXISTS "Authenticated users can place bids" ON public.bids;

-- Create new policy enforcing APPROVED registration for the gem's auction
CREATE POLICY "Authenticated users can place bids"
  ON public.bids FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.gems
      WHERE gems.id = bids.gem_id
      AND gems.status = 'active'
      AND NOW() < gems.end_time
    )
    AND EXISTS (
      SELECT 1 FROM public.auction_registrations ar
      JOIN public.gems g ON g.auction_id = ar.auction_id
      WHERE g.id = bids.gem_id
      AND ar.user_id = auth.uid()
      AND ar.approval_status = 'approved'
    )
  );
