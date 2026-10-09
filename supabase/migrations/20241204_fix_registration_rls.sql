-- Fix RLS policy: Allow registration based on status only, not time
DROP POLICY IF EXISTS "Users can register for auctions" ON public.auction_registrations;

CREATE POLICY "Users can register for auctions"
  ON public.auction_registrations FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.auctions a
      WHERE a.id = auction_registrations.auction_id
      AND a.status = 'registration_open'
    )
  );

