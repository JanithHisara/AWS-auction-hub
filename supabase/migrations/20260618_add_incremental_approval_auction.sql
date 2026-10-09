-- ============================================================
-- Incremental Approval Auction
-- Admin raises price; bidders must approve or they are eliminated.
-- ============================================================

-- 1. Add the new auction type enum value
ALTER TYPE auction_type ADD VALUE IF NOT EXISTS 'incremental_approval_auction';

-- 2. Create gem_eliminations table to track eliminated bidders per item
CREATE TABLE IF NOT EXISTS public.gem_eliminations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gem_id UUID NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  eliminated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  eliminated_at_price DECIMAL(12, 2) NOT NULL,
  UNIQUE(gem_id, user_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_gem_eliminations_gem_id ON public.gem_eliminations(gem_id);
CREATE INDEX IF NOT EXISTS idx_gem_eliminations_user_id ON public.gem_eliminations(user_id);

-- 4. Enable RLS
ALTER TABLE public.gem_eliminations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Users can see their own eliminations
CREATE POLICY "Users can view own eliminations"
  ON public.gem_eliminations FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all eliminations for their gems
CREATE POLICY "Admins can view eliminations for their gems"
  ON public.gem_eliminations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.gems g
      WHERE g.id = gem_eliminations.gem_id
      AND g.admin_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'moderator')
      )
    )
  );

-- Admins can insert eliminations for their gems
CREATE POLICY "Admins can insert eliminations for their gems"
  ON public.gem_eliminations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gems g
      WHERE g.id = gem_eliminations.gem_id
      AND g.admin_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'moderator')
      )
    )
  );

-- 6. Enable Realtime so clients get instant push on elimination
ALTER PUBLICATION supabase_realtime ADD TABLE public.gem_eliminations;

-- 7. Function: eliminate all bidders who have NOT accepted the current price
--    Called by admin after each round ends.
CREATE OR REPLACE FUNCTION public.eliminate_non_approvers(
  p_gem_id UUID,
  p_price DECIMAL
)
RETURNS INTEGER AS $$
DECLARE
  v_auction_id UUID;
  v_eliminated_count INTEGER := 0;
BEGIN
  -- Get auction_id for this gem
  SELECT auction_id INTO v_auction_id FROM public.gems WHERE id = p_gem_id;
  IF v_auction_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Insert elimination rows for all approved registrations that have NOT placed
  -- a bid at >= p_price on this gem, excluding already eliminated bidders.
  INSERT INTO public.gem_eliminations (gem_id, user_id, eliminated_at_price)
  SELECT
    p_gem_id,
    ar.user_id,
    p_price
  FROM public.auction_registrations ar
  WHERE ar.auction_id = v_auction_id
    AND ar.approval_status = 'approved'
    AND ar.is_active = true
    -- Not already eliminated for this gem
    AND NOT EXISTS (
      SELECT 1 FROM public.gem_eliminations ge
      WHERE ge.gem_id = p_gem_id AND ge.user_id = ar.user_id
    )
    -- Did NOT bid at or above the current price
    AND NOT EXISTS (
      SELECT 1 FROM public.bids b
      WHERE b.gem_id = p_gem_id
        AND b.user_id = ar.user_id
        AND b.bid_amount >= p_price
    )
  ON CONFLICT (gem_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_eliminated_count = ROW_COUNT;
  RETURN v_eliminated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Update the column comment
COMMENT ON COLUMN public.auctions.auction_type IS
  'progressive_elimination_auction: price increases at intervals, bidders accept or drop out; '
  'tender_base_fixed_bid: closed bids above minimum, highest bid wins; '
  'incremental_approval_auction: admin raises price, non-approvers are permanently eliminated, last bidder wins.';
