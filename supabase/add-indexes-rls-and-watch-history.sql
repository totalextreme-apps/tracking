-- Migration: Add Indexes, RLS Policies, and Watch History
-- Run this in your Supabase SQL Editor

-- 1. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_collection_items_user ON public.collection_items(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_user_status ON public.collection_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bulletin_posts_user_date ON public.bulletin_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_comments_item ON public.item_comments(collection_item_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_date ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- 2. Add watch history columns to collection_items
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS last_watched_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS watch_count integer DEFAULT 0 NOT NULL;

-- 3. Add missing DELETE Row Level Security (RLS) policies
-- Note: Check if RLS is enabled; if it is, these policies are required.

-- Collection Items DELETE policy
DROP POLICY IF EXISTS "Users can delete own collection items" ON public.collection_items;
CREATE POLICY "Users can delete own collection items"
  ON public.collection_items FOR DELETE
  USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

-- Messages DELETE policy
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Notifications DELETE policy
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);
