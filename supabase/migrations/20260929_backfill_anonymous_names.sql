-- Backfill anonymous_name for all users who are missing one
-- Generates a unique name like "Bidder-A1B2C3" from the user UUID

UPDATE public.users
SET anonymous_name = 'Bidder-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 6))
WHERE anonymous_name IS NULL OR anonymous_name = '';

-- Update handle_new_user trigger to always auto-generate anonymous_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, display_name, anonymous_name)
  VALUES (
    NEW.id,
    NEW.email,
    'user',
    NEW.raw_user_meta_data->>'display_name',
    'Bidder-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 6))
  )
  ON CONFLICT (id) DO UPDATE
    SET
      display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
      anonymous_name = COALESCE(public.users.anonymous_name, EXCLUDED.anonymous_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
