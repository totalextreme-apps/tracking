-- 1. Add clerk_rank column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS clerk_rank text DEFAULT 'Trainee';

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION update_clerk_rank_on_collection_change()
RETURNS trigger AS $$
DECLARE
    target_user_id uuid;
    item_count integer;
    new_rank text;
BEGIN
    -- Determine which user we are updating based on the operation
    IF TG_OP = 'DELETE' THEN
        target_user_id := OLD.user_id;
    ELSE
        target_user_id := NEW.user_id;
    END IF;

    -- Count their collection items
    SELECT count(*) INTO item_count FROM collection_items WHERE user_id = target_user_id;

    -- Determine their new rank
    IF item_count >= 500 THEN
        new_rank := 'Store Manager';
    ELSIF item_count >= 200 THEN
        new_rank := 'Assistant Manager';
    ELSIF item_count >= 50 THEN
        new_rank := 'Shift Supervisor';
    ELSE
        new_rank := 'Trainee';
    END IF;

    -- Update their profile
    UPDATE profiles SET clerk_rank = new_rank WHERE id = target_user_id;

    RETURN NULL; -- For AFTER triggers
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger on collection_items
DROP TRIGGER IF EXISTS update_clerk_rank_trigger ON collection_items;
CREATE TRIGGER update_clerk_rank_trigger
AFTER INSERT OR DELETE OR UPDATE OF user_id
ON collection_items
FOR EACH ROW
EXECUTE FUNCTION update_clerk_rank_on_collection_change();

-- 4. Backfill existing users
DO $$
DECLARE
    r RECORD;
    item_count integer;
    new_rank text;
BEGIN
    FOR r IN SELECT id FROM profiles LOOP
        SELECT count(*) INTO item_count FROM collection_items WHERE user_id = r.id;
        
        IF item_count >= 500 THEN
            new_rank := 'Store Manager';
        ELSIF item_count >= 200 THEN
            new_rank := 'Assistant Manager';
        ELSIF item_count >= 50 THEN
            new_rank := 'Shift Supervisor';
        ELSE
            new_rank := 'Trainee';
        END IF;

        UPDATE profiles SET clerk_rank = new_rank WHERE id = r.id;
    END LOOP;
END;
$$;
