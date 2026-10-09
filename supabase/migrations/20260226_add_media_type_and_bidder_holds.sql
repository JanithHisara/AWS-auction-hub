-- Add media_type column to gem_images for GIF/video support
ALTER TABLE public.gem_images
ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image';

-- Create bidder_holds table for admin hold feature
CREATE TABLE IF NOT EXISTS public.bidder_holds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT,
  held_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(auction_id, user_id, is_active)
);

-- Indexes for bidder_holds
CREATE INDEX IF NOT EXISTS idx_bidder_holds_auction ON public.bidder_holds(auction_id);
CREATE INDEX IF NOT EXISTS idx_bidder_holds_user ON public.bidder_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_bidder_holds_active ON public.bidder_holds(auction_id, is_active) WHERE is_active = true;

-- Enable RLS on bidder_holds
ALTER TABLE public.bidder_holds ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can view all holds
CREATE POLICY "Admins can view all holds"
  ON public.bidder_holds FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS: Users can view their own holds
CREATE POLICY "Users can view own holds"
  ON public.bidder_holds FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS: Admins can insert holds
CREATE POLICY "Admins can insert holds"
  ON public.bidder_holds FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS: Admins can update holds (for release)
CREATE POLICY "Admins can update holds"
  ON public.bidder_holds FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Enable realtime for bidder_holds
ALTER PUBLICATION supabase_realtime ADD TABLE public.bidder_holds;
