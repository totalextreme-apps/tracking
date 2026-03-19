-- Add missing columns to movies table for Genres and Cast
alter table public.movies add column if not exists genres jsonb;
alter table public.movies add column if not exists cast jsonb;

-- Relax user_id constraint to allow mock IDs for prototype testing
alter table public.collection_items alter column user_id drop not null;

-- Add policies to allow anyone to insert/update movies (needed for caching)
drop policy if exists "Allow anyone to insert movies" on public.movies;
create policy "Allow anyone to insert movies" on public.movies for insert with check (true);
drop policy if exists "Allow anyone to update movies" on public.movies;
create policy "Allow anyone to update movies" on public.movies for update using (true);

-- Allow the mock user ID specifically to insert into collection_items
drop policy if exists "Allow mock user to insert" on public.collection_items;
create policy "Allow mock user to insert" on public.collection_items 
  for insert with check (user_id = '00000000-0000-0000-0000-000000000000' or auth.uid() = user_id);
