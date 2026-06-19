-- Migration: Fix Notification Triggers to run with SECURITY DEFINER
-- This resolves RLS errors (hangs) when a user comments on another user's item/post.
-- Run this in your Supabase SQL Editor.

-- 1. Fix notify_on_message
CREATE OR REPLACE FUNCTION notify_on_message()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type, reference_id)
  VALUES (NEW.receiver_id, NEW.sender_id, 'message', NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix notify_on_item_comment
CREATE OR REPLACE FUNCTION notify_on_item_comment()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
BEGIN
  -- Get the owner of the collection item
  SELECT user_id INTO owner_id FROM collection_items WHERE id = NEW.collection_item_id;
  
  -- Don't notify if commenting on own item
  IF owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, reference_id)
    VALUES (owner_id, NEW.user_id, 'item_comment', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix notify_on_post_comment
CREATE OR REPLACE FUNCTION notify_on_post_comment()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
BEGIN
  -- Get the owner of the post
  SELECT user_id INTO owner_id FROM bulletin_posts WHERE id = NEW.post_id;
  
  -- Don't notify if commenting on own post
  IF owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, reference_id)
    VALUES (owner_id, NEW.user_id, 'post_comment', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
