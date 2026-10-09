-- Add 'pending' status to gem_status enum
-- pending = item is published but waiting for its turn (not yet active)
ALTER TYPE gem_status ADD VALUE IF NOT EXISTS 'pending' AFTER 'draft';

-- Update RLS policy for gems to include pending status
DROP POLICY IF EXISTS "Published gems are viewable by everyone" ON public.gems;
CREATE POLICY "Published gems are viewable by everyone"
  ON public.gems FOR SELECT
  USING (status = 'pending' OR status = 'active' OR status = 'ended' OR status = 'completed');
