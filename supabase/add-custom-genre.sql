-- Migration: Add custom_genre column to movies and shows tables
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS custom_genre TEXT DEFAULT NULL;
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS custom_genre TEXT DEFAULT NULL;
