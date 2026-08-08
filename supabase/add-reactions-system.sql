-- Migration: Add Unified Reaction System
-- Run this in your Supabase SQL Editor

-- 1. Create Reactions Table
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Polymorphic Target Fields (exactly one must be non-null)
  post_id UUID REFERENCES public.bulletin_posts(id) ON DELETE CASCADE,
  collection_item_id UUID REFERENCES public.collection_items(id) ON DELETE CASCADE,
  post_comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  item_comment_id UUID REFERENCES public.item_comments(id) ON DELETE CASCADE,
  
  -- Reaction details
  reaction_type VARCHAR(50) NOT NULL, -- 'like' (👍), 'dislike' (👎), 'laugh' (😂), 'love' (❤️)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure EXACTLY one target column is reacted to
  CONSTRAINT check_only_one_target CHECK (
    (post_id IS NOT NULL AND collection_item_id IS NULL AND post_comment_id IS NULL AND item_comment_id IS NULL) OR
    (post_id IS NULL AND collection_item_id IS NOT NULL AND post_comment_id IS NULL AND item_comment_id IS NULL) OR
    (post_id IS NULL AND collection_item_id IS NULL AND post_comment_id IS NOT NULL AND item_comment_id IS NULL) OR
    (post_id IS NULL AND collection_item_id IS NULL AND post_comment_id IS NULL AND item_comment_id IS NOT NULL)
  ),
  
  -- Prevent a user from adding duplicate reactions on the same target
  UNIQUE (user_id, post_id, collection_item_id, post_comment_id, item_comment_id)
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_reactions_post ON public.reactions(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reactions_item ON public.reactions(collection_item_id) WHERE collection_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reactions_user ON public.reactions(user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Reactions are viewable by everyone" ON public.reactions;
CREATE POLICY "Reactions are viewable by everyone"
  ON public.reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert reactions" ON public.reactions;
CREATE POLICY "Authenticated users can insert reactions"
  ON public.reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

DROP POLICY IF EXISTS "Users can delete own reactions" ON public.reactions;
CREATE POLICY "Users can delete own reactions"
  ON public.reactions FOR DELETE
  USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

DROP POLICY IF EXISTS "Users can update own reactions" ON public.reactions;
CREATE POLICY "Users can update own reactions"
  ON public.reactions FOR UPDATE
  USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000')
  WITH CHECK (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

-- 5. Trigger for reaction notifications
CREATE OR REPLACE FUNCTION notify_on_reaction()
RETURNS TRIGGER AS $$
DECLARE
  target_owner_id UUID;
BEGIN
  -- 1. Identify the owner of the target item
  IF NEW.post_id IS NOT NULL THEN
    SELECT user_id INTO target_owner_id FROM public.bulletin_posts WHERE id = NEW.post_id;
  ELSIF NEW.collection_item_id IS NOT NULL THEN
    SELECT user_id INTO target_owner_id FROM public.collection_items WHERE id = NEW.collection_item_id;
  ELSIF NEW.post_comment_id IS NOT NULL THEN
    SELECT user_id INTO target_owner_id FROM public.post_comments WHERE id = NEW.post_comment_id;
  ELSIF NEW.item_comment_id IS NOT NULL THEN
    SELECT user_id INTO target_owner_id FROM public.item_comments WHERE id = NEW.item_comment_id;
  END IF;

  -- 2. Insert notification if owner is different from reactor
  IF target_owner_id IS NOT NULL AND target_owner_id != NEW.user_id THEN
    -- Make sure 'reaction' type is allowed, otherwise map to 'post_comment' or similar reference type if notifications table restricts it
    INSERT INTO public.notifications (user_id, actor_id, type, reference_id)
    VALUES (target_owner_id, NEW.user_id, 'reaction', NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Attach Trigger
DROP TRIGGER IF EXISTS on_reaction_created ON public.reactions;
CREATE TRIGGER on_reaction_created
  AFTER INSERT ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_reaction();

-- 7. Ensure Dev Mock User exists in auth.users and public.profiles (to prevent FK constraint violations in local/native dev environments)
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'dev_mock_user@mediatracking.app',
  '{}',
  '{}',
  false,
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, username, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'dev_mock_user', now())
ON CONFLICT (id) DO NOTHING;
