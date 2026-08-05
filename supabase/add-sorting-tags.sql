-- Migration: Add sorting_tags column to movies and shows tables
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS sorting_tags TEXT DEFAULT NULL;
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS sorting_tags TEXT DEFAULT NULL;
