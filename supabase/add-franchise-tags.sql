-- Add franchise columns to collection_items
ALTER TABLE public.collection_items ADD COLUMN IF NOT EXISTS franchise TEXT DEFAULT NULL;
ALTER TABLE public.collection_items ADD COLUMN IF NOT EXISTS franchise_order NUMERIC DEFAULT NULL;
