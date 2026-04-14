-- Alter collection_items to store rating and review
ALTER TABLE public.collection_items 
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS review TEXT;

-- Trigger to sync bulletin posts to collection_items
CREATE OR REPLACE FUNCTION sync_bulletin_to_collection()
RETURNS TRIGGER AS $$
BEGIN
  -- If the post is linked to a collection_item_id, update it
  IF NEW.collection_item_id IS NOT NULL THEN
    UPDATE public.collection_items
    SET 
      rating = NEW.rating,
      review = NEW.content
    WHERE id = NEW.collection_item_id;
  END IF;
  
  -- If NOT linked to collection_item_id but user owns this movie, find it and update
  IF NEW.collection_item_id IS NULL AND (NEW.movie_id IS NOT NULL OR NEW.show_id IS NOT NULL) THEN
    UPDATE public.collection_items
    SET 
      rating = NEW.rating,
      review = NEW.content
    WHERE user_id = NEW.user_id 
      AND (
        (NEW.movie_id IS NOT NULL AND movie_id = NEW.movie_id) OR 
        (NEW.show_id IS NOT NULL AND show_id = NEW.show_id)
      )
      AND status = 'owned'; -- Only update owned items
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_bulletin_post_sync
  AFTER INSERT OR UPDATE ON public.bulletin_posts
  FOR EACH ROW
  EXECUTE FUNCTION sync_bulletin_to_collection();
