-- Add letterboxd_username to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS letterboxd_username TEXT;
