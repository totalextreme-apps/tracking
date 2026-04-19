-- Step 1: Add preference columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS movie_preferences JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS format_preferences JSONB DEFAULT '[]'::jsonb;

-- Step 2: Ensure bio exists (it should, but just in case)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Step 3: Set default bio if null
UPDATE public.profiles SET bio = '' WHERE bio IS NULL;

-- Step 4: Refresh schema cache (Supabase Dashboard does this automatically)
