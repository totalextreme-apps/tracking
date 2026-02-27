-- Add custom_backdrop_url to collection_items
alter table public.collection_items add column if not exists custom_backdrop_url text;
