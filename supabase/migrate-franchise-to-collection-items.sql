-- Add franchise columns back to collection_items table
ALTER TABLE public.collection_items ADD COLUMN IF NOT EXISTS franchise TEXT DEFAULT NULL;
ALTER TABLE public.collection_items ADD COLUMN IF NOT EXISTS franchise_order NUMERIC DEFAULT NULL;

-- Migrate existing movies franchise data from movies to collection_items table
UPDATE public.collection_items c
SET 
  franchise = m.franchise,
  franchise_order = m.franchise_order
FROM public.movies m
WHERE c.movie_id = m.id 
  AND m.franchise IS NOT NULL 
  AND c.franchise IS NULL;

-- Migrate existing shows franchise data from shows to collection_items table
UPDATE public.collection_items c
SET 
  franchise = s.franchise,
  franchise_order = s.franchise_order
FROM public.shows s
WHERE c.show_id = s.id 
  AND s.franchise IS NOT NULL 
  AND c.franchise IS NULL;

-- Drop redundant franchise columns from movies and shows tables to keep schema clean
ALTER TABLE public.movies DROP COLUMN IF EXISTS franchise;
ALTER TABLE public.movies DROP COLUMN IF EXISTS franchise_order;
ALTER TABLE public.shows DROP COLUMN IF EXISTS franchise;
ALTER TABLE public.shows DROP COLUMN IF EXISTS franchise_order;
