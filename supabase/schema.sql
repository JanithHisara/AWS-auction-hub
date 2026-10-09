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

