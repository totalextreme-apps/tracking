-- Add is_top_five field to the follows table to support the Top 5 pinned members feature
alter table public.follows add column if not exists is_top_five boolean default false;
