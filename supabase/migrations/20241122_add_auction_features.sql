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

