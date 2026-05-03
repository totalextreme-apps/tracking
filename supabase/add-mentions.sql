-- Add mentions support via triggers
CREATE OR REPLACE FUNCTION notify_mentions()
RETURNS TRIGGER AS $$
DECLARE
  mention_username TEXT;
  mentioned_user_id UUID;
  object_id UUID;
  notif_type TEXT;
BEGIN
  -- Determine object type
  IF TG_TABLE_NAME = 'bulletin_posts' THEN
    object_id := NEW.id;
    notif_type := 'post_mention';
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    object_id := NEW.id;
    notif_type := 'comment_mention';
  END IF;

  FOR mention_username IN
    SELECT m[1] FROM regexp_matches(NEW.content, '@([a-zA-Z0-9_]+)', 'g') AS m
  LOOP
    -- Find user
    SELECT id INTO mentioned_user_id FROM profiles WHERE username = mention_username;
    
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
      -- Avoid duplicate notification for same reference
      IF NOT EXISTS (
         SELECT 1 FROM notifications 
         WHERE user_id = mentioned_user_id 
         AND actor_id = NEW.user_id 
         AND type = notif_type 
         AND reference_id = object_id
      ) THEN
         INSERT INTO notifications (user_id, actor_id, type, reference_id)
         VALUES (mentioned_user_id, NEW.user_id, notif_type, object_id);
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_post_mention ON bulletin_posts;
CREATE TRIGGER on_post_mention
  AFTER INSERT OR UPDATE ON bulletin_posts
  FOR EACH ROW
  EXECUTE FUNCTION notify_mentions();

DROP TRIGGER IF EXISTS on_comment_mention ON post_comments;
CREATE TRIGGER on_comment_mention
  AFTER INSERT OR UPDATE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_mentions();
