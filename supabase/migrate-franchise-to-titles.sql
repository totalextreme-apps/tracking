-- Add franchise columns to movies and shows tables
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS franchise TEXT DEFAULT NULL;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS franchise_order NUMERIC DEFAULT NULL;

ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS franchise TEXT DEFAULT NULL;
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS franchise_order NUMERIC DEFAULT NULL;

-- Migrate existing movies franchise data from collection_items to movies table
UPDATE public.movies m
SET 
  franchise = c.franchise,
  franchise_order = c.franchise_order
FROM public.collection_items c
WHERE c.movie_id = m.id 
  AND c.franchise IS NOT NULL 
  AND m.franchise IS NULL;

-- Migrate existing shows franchise data from collection_items to shows table
UPDATE public.shows s
SET 
  franchise = c.franchise,
  franchise_order = c.franchise_order
FROM public.collection_items c
WHERE c.show_id = s.id 
  AND c.franchise IS NOT NULL 
  AND s.franchise IS NULL;

-- Drop old franchise columns from collection_items
ALTER TABLE public.collection_items DROP COLUMN IF EXISTS franchise;
ALTER TABLE public.collection_items DROP COLUMN IF EXISTS franchise_order;
