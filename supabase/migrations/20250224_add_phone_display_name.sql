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
