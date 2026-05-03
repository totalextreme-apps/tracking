-- Add is_top_five field to the follows table to support the Top 5 pinned members feature
alter table public.follows add column if not exists is_top_five boolean default false;

-- Add RLS policy to allow users to update their own follows (to toggle Top 5)
create policy "Users can update their own follows" on public.follows for update using (auth.uid() = follower_id);
