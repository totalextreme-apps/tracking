-- Migration: Add Social Features (Follows and Bulletin Board)
-- Run this in your Supabase SQL Editor

-- 1. Create Follows Table
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (follower_id, following_id)
);

-- 2. Create Bulletin Posts Table
create table public.bulletin_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  collection_item_id uuid references public.collection_items(id) on delete set null,
  movie_id bigint references public.movies(id),
  show_id bigint references public.shows(id),
  content text not null,
  rating integer, -- 0-5 optional
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable RLS on new tables
alter table public.follows enable row level security;
alter table public.bulletin_posts enable row level security;

-- 4. Follows Policies
-- Viewable by everyone (you can see who follows who)
create policy "Follows are viewable by everyone"
  on public.follows for select using (true);
  
-- Users can only insert their own follows (i.e. they are the follower)
create policy "Users can follow others"
  on public.follows for insert 
  with check (auth.uid() = follower_id or follower_id = '00000000-0000-0000-0000-000000000000');

-- Users can only unfollow
create policy "Users can unfollow"
  on public.follows for delete 
  using (auth.uid() = follower_id or follower_id = '00000000-0000-0000-0000-000000000000');

-- 5. Bulletin Posts Policies
-- Viewable by everyone
create policy "Posts are viewable by everyone"
  on public.bulletin_posts for select using (true);

-- Insert own posts
create policy "Users can insert own posts"
  on public.bulletin_posts for insert 
  with check (auth.uid() = user_id or user_id = '00000000-0000-0000-0000-000000000000');

-- Update own posts
create policy "Users can update own posts"
  on public.bulletin_posts for update 
  using (auth.uid() = user_id or user_id = '00000000-0000-0000-0000-000000000000');

-- Delete own posts  
create policy "Users can delete own posts"
  on public.bulletin_posts for delete 
  using (auth.uid() = user_id or user_id = '00000000-0000-0000-0000-000000000000');
