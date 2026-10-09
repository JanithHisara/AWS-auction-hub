-- Add increment_interval to gems (default 60 seconds)
ALTER TABLE public.gems ADD COLUMN IF NOT EXISTS increment_interval INTEGER DEFAULT 60; -- in seconds

-- Update monitor query logic will be handled in API code, schema is sufficient.

