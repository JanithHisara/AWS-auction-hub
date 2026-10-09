-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE gem_status AS ENUM ('draft', 'active', 'ended', 'completed');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');

-- Create users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gems table
CREATE TABLE public.gems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  starting_price DECIMAL(12, 2) NOT NULL,
  min_bid_increment DECIMAL(12, 2) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status gem_status NOT NULL DEFAULT 'draft',
  carat_weight DECIMAL(8, 2),
  cut TEXT,
  color TEXT,
  clarity TEXT,
  provenance TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Create gem_images table
CREATE TABLE public.gem_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gem_id UUID NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gem_certificates table
CREATE TABLE public.gem_certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gem_id UUID NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  certificate_url TEXT NOT NULL,
  certificate_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bids table
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gem_id UUID NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bid_amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gem_id UUID NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  transaction_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create auction_winners table
CREATE TABLE public.auction_winners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gem_id UUID NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  winning_bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  selected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  UNIQUE(gem_id)
);

-- Create indexes for performance
CREATE INDEX idx_gems_status ON public.gems(status);
CREATE INDEX idx_gems_end_time ON public.gems(end_time);
CREATE INDEX idx_gems_admin_id ON public.gems(admin_id);
CREATE INDEX idx_bids_gem_id ON public.bids(gem_id);
CREATE INDEX idx_bids_user_id ON public.bids(user_id);
CREATE INDEX idx_bids_created_at ON public.bids(created_at DESC);
CREATE INDEX idx_gem_images_gem_id ON public.gem_images(gem_id);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gem_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gem_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_winners ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for gems
CREATE POLICY "Anyone can view active gems"
  ON public.gems FOR SELECT
  USING (status = 'active' OR status = 'ended' OR status = 'completed');

CREATE POLICY "Admins can view all gems"
  ON public.gems FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can create gems"
  ON public.gems FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
    AND admin_id = auth.uid()
  );

CREATE POLICY "Admins can update their own gems"
  ON public.gems FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
    AND admin_id = auth.uid()
  );

-- RLS Policies for gem_images
CREATE POLICY "Anyone can view gem images for active gems"
  ON public.gem_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.gems
      WHERE gems.id = gem_images.gem_id
      AND (gems.status = 'active' OR gems.status = 'ended' OR gems.status = 'completed')
    )
  );

CREATE POLICY "Admins can manage images for their gems"
  ON public.gem_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.gems
      WHERE gems.id = gem_images.gem_id
      AND gems.admin_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
      )
    )
  );

-- RLS Policies for gem_certificates
CREATE POLICY "Anyone can view certificates for active gems"
  ON public.gem_certificates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.gems
      WHERE gems.id = gem_certificates.gem_id
      AND (gems.status = 'active' OR gems.status = 'ended' OR gems.status = 'completed')
    )
  );

CREATE POLICY "Admins can manage certificates for their gems"
  ON public.gem_certificates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.gems
      WHERE gems.id = gem_certificates.gem_id
      AND gems.admin_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
      )
    )
  );

-- RLS Policies for bids
CREATE POLICY "Anyone can view bids for active/ended gems"
  ON public.bids FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.gems
      WHERE gems.id = bids.gem_id
      AND (gems.status = 'active' OR gems.status = 'ended' OR gems.status = 'completed')
    )
  );

CREATE POLICY "Users can view their own bids"
  ON public.bids FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bids for their gems"
  ON public.bids FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.gems
      WHERE gems.id = bids.gem_id
      AND gems.admin_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
      )
    )
  );

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
  );

-- RLS Policies for payments
CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view payments for their gems"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.gems
      WHERE gems.id = payments.gem_id
      AND gems.admin_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
      )
    )
  );

CREATE POLICY "Users can create payments for their wins"
  ON public.payments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.auction_winners
      WHERE auction_winners.gem_id = payments.gem_id
      AND auction_winners.user_id = auth.uid()
    )
  );

-- RLS Policies for auction_winners
CREATE POLICY "Anyone can view auction winners"
  ON public.auction_winners FOR SELECT
  USING (true);

CREATE POLICY "Admins can create auction winners"
  ON public.auction_winners FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
    AND admin_id = auth.uid()
  );

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to get current highest bid for a gem
CREATE OR REPLACE FUNCTION public.get_highest_bid(gem_uuid UUID)
RETURNS DECIMAL(12, 2) AS $$
BEGIN
  RETURN (
    SELECT COALESCE(MAX(bid_amount), 0)
    FROM public.bids
    WHERE gem_id = gem_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.gems;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;


-- Migration: 20241122_add_auction_features.sql

-- Add anonymous_name to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS anonymous_name TEXT;

-- Update handle_new_user to generate anonymous_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  anon_name TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random name like "Bidder-123456"
    anon_name := 'Bidder-' || floor(random() * 900000 + 100000)::text;
    SELECT EXISTS(SELECT 1 FROM public.users WHERE anonymous_name = anon_name) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;

  INSERT INTO public.users (id, email, role, anonymous_name)
  VALUES (NEW.id, NEW.email, 'user', anon_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing users
DO $$
DECLARE
  r RECORD;
  anon_name TEXT;
  exists BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM public.users WHERE anonymous_name IS NULL LOOP
    LOOP
      anon_name := 'Bidder-' || floor(random() * 900000 + 100000)::text;
      SELECT EXISTS(SELECT 1 FROM public.users WHERE anonymous_name = anon_name) INTO exists;
      EXIT WHEN NOT exists;
    END LOOP;
    UPDATE public.users SET anonymous_name = anon_name WHERE id = r.id;
  END LOOP;
END $$;

-- Make anonymous_name unique and required
ALTER TABLE public.users ALTER COLUMN anonymous_name SET NOT NULL;
ALTER TABLE public.users ADD CONSTRAINT users_anonymous_name_key UNIQUE (anonymous_name);

-- Create auction_registrations table
CREATE TABLE IF NOT EXISTS public.auction_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gem_id UUID NOT NULL REFERENCES public.gems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(gem_id, user_id)
);

-- RLS for auction_registrations
ALTER TABLE public.auction_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can register themselves"
  ON public.auction_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own registrations"
  ON public.auction_registrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all registrations"
  ON public.auction_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Enable Realtime for auction_registrations
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_registrations;

-- Drop existing policy before recreating
DROP POLICY IF EXISTS "Authenticated users can place bids" ON public.bids;

-- Create new policy enforcing registration
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
      SELECT 1 FROM public.auction_registrations
      WHERE auction_registrations.gem_id = bids.gem_id
      AND auction_registrations.user_id = auth.uid()
    )
  );


-- Migration: 20241122_add_interval.sql

-- Add increment_interval to gems (default 60 seconds)
ALTER TABLE public.gems ADD COLUMN IF NOT EXISTS increment_interval INTEGER DEFAULT 60; -- in seconds

-- Update monitor query logic will be handled in API code, schema is sufficient.


-- Migration: 20241122_add_round_logic.sql

-- Add round info to gems
ALTER TABLE public.gems ADD COLUMN IF NOT EXISTS current_price DECIMAL(12, 2);
ALTER TABLE public.gems ADD COLUMN IF NOT EXISTS round_end_time TIMESTAMP WITH TIME ZONE;

-- Function to initialize current_price
CREATE OR REPLACE FUNCTION public.init_gem_price()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_price IS NULL THEN
    NEW.current_price := NEW.starting_price;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_gem_created_price
  BEFORE INSERT ON public.gems
  FOR EACH ROW EXECUTE FUNCTION public.init_gem_price();

-- Backfill
UPDATE public.gems SET current_price = starting_price WHERE current_price IS NULL;


-- Migration: 20241122_monitor_stats_rpc.sql

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



-- Migration: 20241204_restructure_auctions.sql

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

-- Drop old table before recreating during restructure
DROP TABLE IF EXISTS public.auction_registrations CASCADE;

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
  
  -- Approval Status
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
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

CREATE POLICY "Admins can update registrations for their auctions"
  ON public.auction_registrations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM public.auctions a
      WHERE a.id = auction_registrations.auction_id
      AND a.admin_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update any registration"
  ON public.auction_registrations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
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


-- Migration: 20241204_fix_registration_rls.sql (Moved here to satisfy table dependencies)

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


-- Migration: 20241205_add_auction_type.sql

-- Add auction type enum
CREATE TYPE auction_type AS ENUM ('fixed_increment', 'variable_increment');

-- Add auction_type column to auctions table
ALTER TABLE public.auctions 
ADD COLUMN auction_type auction_type NOT NULL DEFAULT 'fixed_increment';

-- Add comment for clarity
COMMENT ON COLUMN public.auctions.auction_type IS 'fixed_increment: price increases at intervals, variable_increment: free-form bidding with min increment';

-- Migration: 20241206_fix_bid_approval_check.sql

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

-- Migration: 20250201_add_pending_status.sql

-- Add 'pending' status to gem_status enum
-- pending = item is published but waiting for its turn (not yet active)
ALTER TYPE gem_status ADD VALUE IF NOT EXISTS 'pending' AFTER 'draft';

-- Update RLS policy for gems to include pending status
DROP POLICY IF EXISTS "Published gems are viewable by everyone" ON public.gems;
CREATE POLICY "Published gems are viewable by everyone"
  ON public.gems FOR SELECT
  USING (status = 'pending' OR status = 'active' OR status = 'ended' OR status = 'completed');

-- Migration: 20250201_add_registration_count_rpc.sql

-- RPC function to get registration count (bypasses RLS)
CREATE OR REPLACE FUNCTION get_auction_registration_count(auction_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER 
  FROM public.auction_registrations 
  WHERE auction_id = auction_uuid 
  AND approval_status = 'approved';
$$ LANGUAGE sql SECURITY DEFINER;

-- Migration: 20250224_add_phone_display_name.sql

-- Add phone and display_name columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Update handle_new_user to set phone and display_name from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  anon_name TEXT;
  exists BOOLEAN;
  v_phone TEXT;
  v_display_name TEXT;
BEGIN
  -- Extract phone and display_name from raw_user_meta_data (set during signup options.data)
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_display_name := NEW.raw_user_meta_data->>'display_name';

  LOOP
    anon_name := 'Bidder-' || floor(random() * 900000 + 100000)::text;
    SELECT EXISTS(SELECT 1 FROM public.users WHERE anonymous_name = anon_name) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;

  INSERT INTO public.users (id, email, role, anonymous_name, phone, display_name)
  VALUES (NEW.id, NEW.email, 'user', anon_name, v_phone, v_display_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20250224_rename_auction_types.sql

-- Rename auction type enum values to match new terminology
-- Fixed -> Progressive Elimination Auction
-- Free-Form -> Tender Base / Fixed Bid

ALTER TYPE auction_type RENAME VALUE 'fixed_increment' TO 'progressive_elimination_auction';
ALTER TYPE auction_type RENAME VALUE 'variable_increment' TO 'tender_base_fixed_bid';

-- Update column default
ALTER TABLE public.auctions ALTER COLUMN auction_type SET DEFAULT 'progressive_elimination_auction'::auction_type;

-- Update comment for clarity
COMMENT ON COLUMN public.auctions.auction_type IS 'progressive_elimination_auction: price increases at intervals, bidders accept or drop out; tender_base_fixed_bid: closed bids above minimum, highest bid wins';

-- Migration: 20260226_add_media_type_and_bidder_holds.sql

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

-- Migration: 20260304_add_auction_chat.sql

-- Chat conversations: one per user per auction
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'waiting', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unread_by_user INTEGER NOT NULL DEFAULT 0,
  unread_by_admin INTEGER NOT NULL DEFAULT 0,
  UNIQUE(auction_id, user_id)
);

-- Chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_conv_auction ON public.chat_conversations(auction_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_user ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_status ON public.chat_conversations(auction_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_conv_assigned ON public.chat_conversations(assigned_admin_id) WHERE assigned_admin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_conv_last_msg ON public.chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_created ON public.chat_messages(conversation_id, created_at);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own conversations
CREATE POLICY "Users can view own conversations"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS: Admins can view all conversations
CREATE POLICY "Admins can view all conversations"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS: Authenticated users can create conversations (for themselves)
CREATE POLICY "Users can create own conversations"
  ON public.chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS: Admins can update conversations (status, assignment)
CREATE POLICY "Admins can update conversations"
  ON public.chat_conversations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS: Users can update their own conversations (for unread reset)
CREATE POLICY "Users can update own conversations"
  ON public.chat_conversations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS: Users can view messages in their own conversations
CREATE POLICY "Users can view own conversation messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND chat_conversations.user_id = auth.uid()
    )
  );

-- RLS: Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS: Users can insert messages into their own conversations
CREATE POLICY "Users can insert own messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'user'
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND chat_conversations.user_id = auth.uid()
    )
  );

-- RLS: Admins can insert messages
CREATE POLICY "Admins can insert messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'admin'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Migration: 20260304_add_rbac_system.sql

-- ============================================
-- RBAC: Role-Based Access Control System
-- ============================================

-- Add new role enum values (separate transaction required for enum)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'moderator';

-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  group_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role user_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);

-- Seed permissions
INSERT INTO public.permissions (key, name, description, group_name) VALUES
  ('view_dashboard', 'View Dashboard', 'Access admin dashboard and view statistics', 'Dashboard'),
  ('manage_auctions', 'Manage Auctions', 'Create, edit, and control auction status', 'Auctions'),
  ('manage_items', 'Manage Items', 'Create, edit, and publish items/gems', 'Items'),
  ('manage_registrations', 'Manage Registrations', 'View and approve/reject auction registrations', 'Registrations'),
  ('control_bidding', 'Control Bidding', 'Start/end bidding rounds, select winners, hold bidders', 'Bidding'),
  ('manage_users', 'Manage Users', 'View user list and profiles', 'Users'),
  ('assign_roles', 'Assign Roles', 'Assign roles (Moderator, Admin) to users', 'Users'),
  ('manage_permissions', 'Manage Permissions', 'Edit role permissions for any role', 'Access Control'),
  ('manage_chat', 'Manage Chat', 'View and respond to all chat conversations', 'Chat'),
  ('upload_files', 'Upload Files', 'Upload images and files', 'Files')
ON CONFLICT (key) DO NOTHING;

-- Seed default role-permission assignments
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::user_role, p.id FROM public.permissions p
WHERE p.key IN ('view_dashboard', 'manage_auctions', 'manage_items', 'manage_registrations', 'control_bidding', 'manage_users', 'manage_chat', 'upload_files')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'moderator'::user_role, p.id FROM public.permissions p
WHERE p.key IN ('view_dashboard', 'manage_registrations', 'manage_chat')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Update is_admin() to include all admin-level roles
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id AND role IN ('super_admin', 'admin', 'moderator')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Create has_permission() function
CREATE OR REPLACE FUNCTION public.has_permission(check_user_id UUID, permission_key TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = check_user_id AND u.role = 'super_admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.role_permissions rp ON rp.role = u.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE u.id = check_user_id AND p.key = permission_key
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS on new tables
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view permissions"
  ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin roles can view role permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Super admin can insert role permissions"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admin can update role permissions"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admin can delete role permissions"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'));

-- Update all existing RLS policies to use is_admin() instead of inline checks
-- (See full policy updates in the applied migration)

-- Migration: 20260308_add_device_nfc_system.sql

-- ============================================
-- Physical Device & NFC Card System
-- ============================================

-- Devices table: tracks registered ESP32 devices
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL UNIQUE,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'maintenance')),
  firmware_version TEXT,
  hardware_version TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NFC cards table: maps NFC card -> User -> Auction
CREATE TABLE public.nfc_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nfc_uid TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  auction_id UUID REFERENCES public.auctions(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nfc_uid, auction_id)
);

-- Device sessions table: audit trail for device usage
CREATE TABLE public.device_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL REFERENCES public.devices(device_id) ON DELETE CASCADE,
  nfc_uid TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired'))
);

-- Indexes
CREATE INDEX idx_devices_status ON public.devices(status);
CREATE INDEX idx_devices_device_id ON public.devices(device_id);
CREATE INDEX idx_nfc_cards_nfc_uid ON public.nfc_cards(nfc_uid);
CREATE INDEX idx_nfc_cards_user_id ON public.nfc_cards(user_id);
CREATE INDEX idx_nfc_cards_auction_id ON public.nfc_cards(auction_id);
CREATE INDEX idx_device_sessions_device_id ON public.device_sessions(device_id);
CREATE INDEX idx_device_sessions_auction_id ON public.device_sessions(auction_id);
CREATE INDEX idx_device_sessions_status ON public.device_sessions(status);

-- Enable RLS
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for devices
CREATE POLICY "Admin roles can view devices"
  ON public.devices FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admin roles can insert devices"
  ON public.devices FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin roles can update devices"
  ON public.devices FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admin roles can delete devices"
  ON public.devices FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- RLS Policies for nfc_cards
CREATE POLICY "Admin roles can view nfc_cards"
  ON public.nfc_cards FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admin roles can insert nfc_cards"
  ON public.nfc_cards FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin roles can update nfc_cards"
  ON public.nfc_cards FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admin roles can delete nfc_cards"
  ON public.nfc_cards FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- RLS Policies for device_sessions
CREATE POLICY "Admin roles can view device_sessions"
  ON public.device_sessions FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admin roles can manage device_sessions"
  ON public.device_sessions FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- Seed manage_devices permission
INSERT INTO public.permissions (key, name, description, group_name) VALUES
  ('manage_devices', 'Manage Devices', 'Manage physical devices and NFC card mappings', 'Devices')
ON CONFLICT (key) DO NOTHING;

-- Grant manage_devices to moderator and admin roles
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'moderator'::user_role, p.id FROM public.permissions p WHERE p.key = 'manage_devices'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::user_role, p.id FROM public.permissions p WHERE p.key = 'manage_devices'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Migration: 20260308_option_b_device_refactor.sql

-- Option B refactor: device owns auction assignment, NFC card is user-only identifier

-- Add auction_id to devices table so each device knows which auction it serves
ALTER TABLE public.devices ADD COLUMN auction_id UUID REFERENCES public.auctions(id) ON DELETE SET NULL;
CREATE INDEX idx_devices_auction_id ON public.devices(auction_id);

-- Simplify nfc_cards: drop the composite unique constraint and add a simple one on nfc_uid
-- First, remove duplicate nfc_uid rows (keep most recently created)
DELETE FROM public.nfc_cards a USING public.nfc_cards b
WHERE a.nfc_uid = b.nfc_uid AND a.created_at < b.created_at;

-- Drop the old composite unique constraint
ALTER TABLE public.nfc_cards DROP CONSTRAINT IF EXISTS nfc_cards_nfc_uid_auction_id_key;

-- Add simple unique constraint on nfc_uid (one card = one user)
ALTER TABLE public.nfc_cards ADD CONSTRAINT nfc_cards_nfc_uid_key UNIQUE (nfc_uid);

-- Migration: 20260319_fix_bids_update_policy.sql

-- Allow users to update their own bids (needed for bid editing in Closed Bid auctions)
CREATE POLICY "Users can update own bids"
  ON public.bids FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Migration: 20260608_auto_auction_status.sql

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

-- Migration: 20260618_add_incremental_approval_auction.sql

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
