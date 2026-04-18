-- ==========================================
-- TOM FROM MYSPACE AUTO-FOLLOW TRIGGER
-- ==========================================

-- This function intercepts new user registrations after their public.profile is created
-- and automatically sets up mutual following with the core member (biglacey@gmail.com).

CREATE OR REPLACE FUNCTION public.handle_tom_myspace_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth  -- Ensures both schemas are accessible
AS $$
DECLARE
  tom_id UUID;
BEGIN
  -- Look up the core member's UUID via their auth email
  SELECT id INTO tom_id
  FROM auth.users
  WHERE email = 'biglacey@gmail.com'
  LIMIT 1;

  -- Only proceed if we found the user and the new signup is NOT that user
  IF tom_id IS NOT NULL AND tom_id <> NEW.id THEN

    -- 1. New user follows core member (only if not already following)
    INSERT INTO public.follows (follower_id, following_id)
    SELECT NEW.id, tom_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = NEW.id AND following_id = tom_id
    );

    -- 2. Core member follows new user (only if not already following)
    INSERT INTO public.follows (follower_id, following_id)
    SELECT tom_id, NEW.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = tom_id AND following_id = NEW.id
    );

  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_profile_created_auto_follow ON public.profiles;

-- Create the trigger so it fires immediately after any new profile is inserted
CREATE TRIGGER on_profile_created_auto_follow
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_tom_myspace_follow();
