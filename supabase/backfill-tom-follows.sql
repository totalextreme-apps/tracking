-- ===================================================
-- BACKFILL: TOM FROM MYSPACE (CONNECT EVERYONE)
-- ===================================================

-- This script ensures that the core member (biglacey@gmail.com) 
-- follows everyone and everyone follows them, retroactively.

DO $$
DECLARE
  tom_id UUID;
BEGIN
  -- 1. Identify "Tom" (the core member)
  SELECT id INTO tom_id
  FROM auth.users
  WHERE email = 'biglacey@gmail.com'
  LIMIT 1;

  IF tom_id IS NOT NULL THEN
    -- 2. Everyone follows Tom
    INSERT INTO public.follows (follower_id, following_id)
    SELECT p.id, tom_id
    FROM public.profiles p
    WHERE p.id <> tom_id
    AND NOT EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = p.id AND f.following_id = tom_id
    );

    -- 3. Tom follows everyone
    INSERT INTO public.follows (follower_id, following_id)
    SELECT tom_id, p.id
    FROM public.profiles p
    WHERE p.id <> tom_id
    AND NOT EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = tom_id AND f.following_id = p.id
    );

    RAISE NOTICE 'Myspace Tom backfill complete for user ID: %', tom_id;
  ELSE
    RAISE NOTICE 'Core member biglacey@gmail.com not found. Skipping follow backfill.';
  END IF;
END $$;
