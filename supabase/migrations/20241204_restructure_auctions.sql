-- =====================================================
-- RESTRUCTURE: Multi-Auction Platform with Secure Access
-- =====================================================

-- Create auction status enum
CREATE TYPE auction_status AS ENUM ('draft', 'upcoming', 'registration_open', 'live', 'ended', 'completed');

-- Create new auctions table (parent of gems/items)
CREATE TABLE public.auctions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  banner_image_url TEXT,
  
  -- Timing
  registration_start TIMESTAMP WITH TIME ZONE NOT NULL,
  registration_end TIMESTAMP WITH TIME ZONE NOT NULL,
  auction_start TIMESTAMP WITH TIME ZONE NOT NULL,
  auction_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Settings
  status auction_status NOT NULL DEFAULT 'draft',
  max_participants INTEGER,
  entry_fee DECIMAL(12, 2) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Create auction registrations table with unique access tokens
CREATE TABLE public.auction_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Secure access token (sent via email)
  access_token UUID NOT NULL DEFAULT uuid_generate_v4(),
  
  -- Registration details
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Access tracking
  first_access_at TIMESTAMP WITH TIME ZONE,
  last_access_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(auction_id, user_id),
  UNIQUE(access_token)
);

-- Add auction_id to gems table
ALTER TABLE public.gems ADD COLUMN auction_id UUID REFERENCES public.auctions(id) ON DELETE CASCADE;

-- Create user rewards/engagement table
CREATE TABLE public.user_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Points system
  total_points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  
  -- Badges (JSON array of earned badges)
  badges JSONB DEFAULT '[]'::jsonb,
  
  -- Stats
  auctions_participated INTEGER DEFAULT 0,
  total_bids_placed INTEGER DEFAULT 0,
  auctions_won INTEGER DEFAULT 0,
  
  -- Timestamps
  last_bid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Add reward tracking to bids
ALTER TABLE public.bids ADD COLUMN points_earned INTEGER DEFAULT 0;

-- Indexes for performance
CREATE INDEX idx_auctions_status ON public.auctions(status);
CREATE INDEX idx_auctions_start ON public.auctions(auction_start);
CREATE INDEX idx_auction_registrations_token ON public.auction_registrations(access_token);
CREATE INDEX idx_auction_registrations_user ON public.auction_registrations(user_id);
CREATE INDEX idx_gems_auction_id ON public.gems(auction_id);
CREATE INDEX idx_user_rewards_user ON public.user_rewards(user_id);

-- Enable RLS
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for auctions
CREATE POLICY "Anyone can view published auctions"
  ON public.auctions FOR SELECT
  USING (status != 'draft');

CREATE POLICY "Admins can view all auctions"
  ON public.auctions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admins can create auctions"
  ON public.auctions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
    AND admin_id = auth.uid()
  );

CREATE POLICY "Admins can update their auctions"
  ON public.auctions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
    AND admin_id = auth.uid()
  );

-- RLS Policies for auction_registrations
CREATE POLICY "Users can view their own registrations"
  ON public.auction_registrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view registrations for their auctions"
  ON public.auction_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.auctions a
      WHERE a.id = auction_registrations.auction_id
      AND a.admin_id = auth.uid()
    )
  );

CREATE POLICY "Users can register for auctions"
  ON public.auction_registrations FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.auctions a
      WHERE a.id = auction_registrations.auction_id
      AND a.status = 'registration_open'
      AND NOW() BETWEEN a.registration_start AND a.registration_end
    )
  );

-- RLS for user_rewards
CREATE POLICY "Users can view their own rewards"
  ON public.user_rewards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can update rewards"
  ON public.user_rewards FOR ALL
  USING (auth.uid() = user_id);

-- Function to validate auction access
CREATE OR REPLACE FUNCTION public.validate_auction_access(
  p_auction_id UUID,
  p_user_id UUID,
  p_access_token UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_registration auction_registrations;
  v_auction auctions;
BEGIN
  -- Check registration exists and token matches
  SELECT * INTO v_registration
  FROM public.auction_registrations
  WHERE auction_id = p_auction_id
    AND user_id = p_user_id
    AND access_token = p_access_token
    AND is_active = true;
    
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check auction is live
  SELECT * INTO v_auction
  FROM public.auctions
  WHERE id = p_auction_id
    AND status = 'live';
    
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update access tracking
  UPDATE public.auction_registrations
  SET 
    access_count = access_count + 1,
    first_access_at = COALESCE(first_access_at, NOW()),
    last_access_at = NOW()
  WHERE id = v_registration.id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to award points on bid
CREATE OR REPLACE FUNCTION public.award_bid_points()
RETURNS TRIGGER AS $$
DECLARE
  v_points INTEGER := 10; -- Base points per bid
  v_streak_bonus INTEGER := 0;
BEGIN
  -- Insert or update user rewards
  INSERT INTO public.user_rewards (user_id, total_points, total_bids_placed, last_bid_at)
  VALUES (NEW.user_id, v_points, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET 
    total_points = user_rewards.total_points + v_points,
    total_bids_placed = user_rewards.total_bids_placed + 1,
    last_bid_at = NOW(),
    updated_at = NOW();
  
  -- Update points earned on bid
  NEW.points_earned := v_points;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for awarding points
CREATE TRIGGER on_bid_placed
  BEFORE INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.award_bid_points();

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_registrations;

