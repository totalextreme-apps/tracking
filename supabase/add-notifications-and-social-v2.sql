-- Post Comments Table
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES bulletin_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Receiver
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Sender
  type TEXT NOT NULL, -- 'message', 'item_comment', 'post_comment', 'follow'
  reference_id UUID NOT NULL, -- ID of the related object
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Post Comments Policies
CREATE POLICY "Anyone can read post comments"
  ON post_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create post comments"
  ON post_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own post comments"
  ON post_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own post comments"
  ON post_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Notifications Policies
CREATE POLICY "Users can see own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications (mark as read)"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- TRIGGERS FOR NOTIFICATIONS --

-- 1. Notify on new message
CREATE OR REPLACE FUNCTION notify_on_message()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type, reference_id)
  VALUES (NEW.receiver_id, NEW.sender_id, 'message', NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_message_created ON messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_message();

-- 2. Notify on new item comment
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_item_comment_created ON item_comments;
CREATE TRIGGER on_item_comment_created
  AFTER INSERT ON item_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_item_comment();

-- 3. Notify on new post comment
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_post_comment_created ON post_comments;
CREATE TRIGGER on_post_comment_created
  AFTER INSERT ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_post_comment();
