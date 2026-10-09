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

