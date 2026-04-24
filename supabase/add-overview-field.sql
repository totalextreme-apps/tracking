-- Add overview field to movies and shows tables
alter table public.movies add column if not exists overview text;
alter table public.shows add column if not exists overview text;

-- Ensure consistency in format naming if needed (already mostly handled by check constraints but overview is the big one here)
