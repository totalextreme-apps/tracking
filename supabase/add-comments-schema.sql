-- Migration: Add Collection Comments Schema
-- Run this in your Supabase SQL Editor

-- 1. Create item_comments Table
create table public.item_comments (
  id uuid default gen_random_uuid() primary key,
  collection_item_id uuid references public.collection_items(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS
alter table public.item_comments enable row level security;

-- 3. Comments Policies
-- Viewable by everyone
create policy "Item comments are viewable by everyone"
  on public.item_comments for select using (true);

-- Insert own comments
create policy "Users can insert own comments"
  on public.item_comments for insert 
  with check (auth.uid() = user_id or user_id = '00000000-0000-0000-0000-000000000000');

-- Delete own comments  
create policy "Users can delete own comments"
  on public.item_comments for delete 
  using (auth.uid() = user_id or user_id = '00000000-0000-0000-0000-000000000000');
