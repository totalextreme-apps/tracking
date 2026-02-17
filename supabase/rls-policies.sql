-- Run this if you already created the tables and need to add RLS policies.

alter table public.movies enable row level security;
alter table public.collection_items enable row level security;

drop policy if exists "Movies are viewable by everyone" on public.movies;
drop policy if exists "Authenticated users can insert movies" on public.movies;
drop policy if exists "Authenticated users can update movies" on public.movies;

create policy "Movies are viewable by everyone"
  on public.movies for select using (true);

create policy "Authenticated users can insert movies"
  on public.movies for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update movies"
  on public.movies for update using (auth.role() = 'authenticated');

drop policy if exists "Users can view own collection" on public.collection_items;
drop policy if exists "Users can insert own collection" on public.collection_items;
drop policy if exists "Users can update own collection" on public.collection_items;

create policy "Users can view own collection"
  on public.collection_items for select using (auth.uid() = user_id);

create policy "Users can insert own collection"
  on public.collection_items for insert with check (auth.uid() = user_id);

create policy "Users can update own collection"
  on public.collection_items for update using (auth.uid() = user_id);
