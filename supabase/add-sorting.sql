-- Add sorting columns to collection_items
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS grail_order INT DEFAULT 0;

-- Function to bulk update order
CREATE OR REPLACE FUNCTION update_collection_order(
  item_ids UUID[],
  order_type TEXT
) RETURNS VOID AS $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1 .. array_length(item_ids, 1) LOOP
    IF order_type = 'display' THEN
      UPDATE collection_items SET display_order = i WHERE id = item_ids[i] AND auth.uid() = user_id;
    ELSIF order_type = 'grail' THEN
      UPDATE collection_items SET grail_order = i WHERE id = item_ids[i] AND auth.uid() = user_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
