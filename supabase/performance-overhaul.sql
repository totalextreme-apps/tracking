-- =============================================================================
-- MediaTracking.app — Comprehensive Performance & Data Architecture Migration
-- Safe, idempotent, and reversible SQL migration (Phases 4, 5, and 7)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. HIGH-IMPACT PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------

-- Foreign key & join indexes (critical for get_app_wide_stats and media joins)
CREATE INDEX IF NOT EXISTS idx_collection_items_movie_id
  ON public.collection_items(movie_id)
  WHERE movie_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collection_items_show_id
  ON public.collection_items(show_id)
  WHERE show_id IS NOT NULL;

-- Covering composite index for useCollection's exact ORDER BY clause
CREATE INDEX IF NOT EXISTS idx_collection_items_user_sort_order
  ON public.collection_items(user_id, display_order ASC, grail_order ASC, created_at DESC);

-- Partial index for On Display queries (useFollowing, useAllUsers, shelf views)
CREATE INDEX IF NOT EXISTS idx_collection_items_user_on_display
  ON public.collection_items(user_id, display_order ASC, created_at DESC)
  WHERE is_on_display = true;

-- Partial index for Grail queries
CREATE INDEX IF NOT EXISTS idx_collection_items_user_grail
  ON public.collection_items(user_id, grail_order ASC, created_at DESC)
  WHERE is_grail = true;

-- Partial index for Community Swap Meet / Marketplace feed
CREATE INDEX IF NOT EXISTS idx_collection_items_marketplace_feed
  ON public.collection_items(created_at DESC)
  WHERE for_sale = true OR for_trade = true;

-- Partial index for Recently Watched / Watch Log queries
CREATE INDEX IF NOT EXISTS idx_collection_items_user_watched
  ON public.collection_items(user_id, last_watched_at DESC)
  WHERE last_watched_at IS NOT NULL;

-- GIN index for Curated Stacks array containment (.contains('custom_lists', [listName]))
CREATE INDEX IF NOT EXISTS idx_collection_items_custom_lists_gin
  ON public.collection_items USING GIN (custom_lists);

-- Composite index for Notifications polling & unread counts
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_date
  ON public.notifications(user_id, is_read, created_at DESC);

-- Composite index for Direct Messages conversation queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_date
  ON public.messages(sender_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread
  ON public.messages(receiver_id, is_read, created_at DESC);

-- Case-insensitive username lookup index for @mentions and user search
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles(lower(username));

-- -----------------------------------------------------------------------------
-- 2. DATABASE-SIDE COLLECTION STATISTICS RPC (PHASE 4)
-- -----------------------------------------------------------------------------
-- Computes format counts, valuation totals, genre distribution, and decade
-- breakdowns in PostgreSQL, returning a compact JSON payload (~1 KB).

CREATE OR REPLACE FUNCTION public.get_user_collection_stats(target_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  summary_record RECORD;
  formats_json jsonb;
  genres_json jsonb;
  decades_json jsonb;
BEGIN
  -- 1. Core Summary Counts & Valuation Totals (Single table scan)
  SELECT
    count(*)::int AS total_items,
    count(*) FILTER (WHERE status = 'owned')::int AS owned_count,
    count(*) FILTER (WHERE status = 'wishlist')::int AS wishlist_count,
    count(*) FILTER (WHERE is_grail = true)::int AS grail_count,
    count(*) FILTER (WHERE is_on_display = true AND status = 'owned')::int AS on_display_count,
    count(DISTINCT format)::int AS unique_formats,
    count(*) FILTER (
      WHERE status = 'owned'
        AND value_estimate IS NOT NULL
        AND NOT (value_estimate >= 5.15 AND value_estimate <= 5.55)
    )::int AS valued_count,
    COALESCE(
      sum(value_estimate) FILTER (
        WHERE status = 'owned'
          AND value_estimate IS NOT NULL
          AND NOT (value_estimate >= 5.15 AND value_estimate <= 5.55)
      ),
      0
    )::numeric(12,2) AS total_value
  INTO summary_record
  FROM public.collection_items
  WHERE user_id = target_user_id;

  -- 2. Format Breakdown
  SELECT COALESCE(
    jsonb_object_agg(
      fmt,
      jsonb_build_object(
        'total', total_cnt,
        'owned', owned_cnt,
        'wishlist', wishlist_cnt,
        'valued', valued_cnt,
        'value_sum', val_sum
      )
    ),
    '{}'::jsonb
  )
  INTO formats_json
  FROM (
    SELECT
      CASE WHEN format = 'Blu-ray' THEN 'BluRay' ELSE COALESCE(format, 'Unknown') END AS fmt,
      count(*)::int AS total_cnt,
      count(*) FILTER (WHERE status = 'owned')::int AS owned_cnt,
      count(*) FILTER (WHERE status = 'wishlist')::int AS wishlist_cnt,
      count(*) FILTER (
        WHERE status = 'owned'
          AND value_estimate IS NOT NULL
          AND NOT (value_estimate >= 5.15 AND value_estimate <= 5.55)
      )::int AS valued_cnt,
      COALESCE(
        sum(value_estimate) FILTER (
          WHERE status = 'owned'
            AND value_estimate IS NOT NULL
            AND NOT (value_estimate >= 5.15 AND value_estimate <= 5.55)
        ),
        0
      )::numeric(12,2) AS val_sum
    FROM public.collection_items
    WHERE user_id = target_user_id
    GROUP BY 1
  ) f;

  -- 3. Genre Breakdown
  SELECT COALESCE(jsonb_object_agg(genre_name, genre_cnt), '{}'::jsonb)
  INTO genres_json
  FROM (
    SELECT
      genre_name,
      count(*)::int AS genre_cnt
    FROM (
      SELECT
        COALESCE(
          g.elem->>'name',
          'Uncategorized'
        ) AS genre_name
      FROM public.collection_items c
      LEFT JOIN public.movies m ON c.movie_id = m.id
      LEFT JOIN public.shows s ON c.show_id = s.id
      LEFT JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(COALESCE(m.genres, s.genres)) = 'array'
            AND jsonb_array_length(COALESCE(m.genres, s.genres)) > 0
          THEN COALESCE(m.genres, s.genres)
          ELSE '[{"name":"Uncategorized"}]'::jsonb
        END
      ) AS g(elem) ON true
      WHERE c.user_id = target_user_id
    ) raw_g
    GROUP BY genre_name
    ORDER BY genre_cnt DESC
  ) agg_g;

  -- 4. Release Decade Breakdown
  SELECT COALESCE(jsonb_object_agg(decade_year::text, decade_cnt), '{}'::jsonb)
  INTO decades_json
  FROM (
    SELECT
      (EXTRACT(YEAR FROM COALESCE(m.release_date, s.first_air_date))::int / 10) * 10 AS decade_year,
      count(*)::int AS decade_cnt
    FROM public.collection_items c
    LEFT JOIN public.movies m ON c.movie_id = m.id
    LEFT JOIN public.shows s ON c.show_id = s.id
    WHERE c.user_id = target_user_id
      AND COALESCE(m.release_date, s.first_air_date) IS NOT NULL
    GROUP BY 1
    ORDER BY 1 ASC
  ) agg_d;

  RETURN jsonb_build_object(
    'total_items', COALESCE(summary_record.total_items, 0),
    'owned_count', COALESCE(summary_record.owned_count, 0),
    'wishlist_count', COALESCE(summary_record.wishlist_count, 0),
    'grail_count', COALESCE(summary_record.grail_count, 0),
    'on_display_count', COALESCE(summary_record.on_display_count, 0),
    'unique_formats', COALESCE(summary_record.unique_formats, 0),
    'valued_count', COALESCE(summary_record.valued_count, 0),
    'total_value', COALESCE(summary_record.total_value, 0),
    'formats', formats_json,
    'genres', genres_json,
    'decades', decades_json
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. SINGLE-SCAN GLOBAL & PLATFORM STATISTICS RPCS (PHASE 4)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_global_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_cnt int;
  total_cnt int;
  wishlist_cnt int;
  grail_cnt int;
BEGIN
  SELECT count(*)::int INTO member_cnt FROM public.profiles;

  -- Single scan over collection_items instead of 3 separate subqueries
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE status = 'wishlist')::int,
    count(*) FILTER (WHERE is_grail = true)::int
  INTO total_cnt, wishlist_cnt, grail_cnt
  FROM public.collection_items;

  RETURN jsonb_build_object(
    'total_members', COALESCE(member_cnt, 0),
    'titles_in_circulation', COALESCE(total_cnt, 0),
    'special_requests', COALESCE(wishlist_cnt, 0),
    'most_wanted', COALESCE(grail_cnt, 0)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. SET-BASED COLLECTION MUTATION RPCS (PHASE 5)
-- -----------------------------------------------------------------------------

-- Set-based replacement for loop-based update_collection_order
CREATE OR REPLACE FUNCTION public.update_collection_order(
  item_ids UUID[],
  order_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF item_ids IS NULL OR array_length(item_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF order_type = 'display' THEN
    UPDATE public.collection_items c
    SET display_order = u.ord::int
    FROM unnest(item_ids) WITH ORDINALITY AS u(id, ord)
    WHERE c.id = u.id
      AND c.user_id = auth.uid();
  ELSIF order_type = 'grail' THEN
    UPDATE public.collection_items c
    SET grail_order = u.ord::int
    FROM unnest(item_ids) WITH ORDINALITY AS u(id, ord)
    WHERE c.id = u.id
      AND c.user_id = auth.uid();
  END IF;
END;
$$;

-- Set-based bulk custom list update RPC (eliminates N parallel HTTP PATCH requests)
CREATE OR REPLACE FUNCTION public.bulk_update_custom_lists_rpc(
  p_item_ids UUID[],
  p_list_name TEXT,
  p_is_adding BOOLEAN,
  p_encoded_meta TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  meta_prefix TEXT := '__meta__:' || p_list_name || ':';
  lead_id UUID;
BEGIN
  IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  lead_id := p_item_ids[1];

  IF p_is_adding THEN
    UPDATE public.collection_items c
    SET custom_lists = (
      SELECT array_agg(elem)
      FROM (
        SELECT elem
        FROM unnest(COALESCE(c.custom_lists, ARRAY[]::text[])) AS elem
        WHERE elem <> p_list_name
          AND NOT (elem LIKE meta_prefix || '%')
        UNION ALL
        SELECT p_list_name
        UNION ALL
        SELECT p_encoded_meta
        WHERE p_encoded_meta IS NOT NULL AND c.id = lead_id
      ) s
      WHERE elem IS NOT NULL
    )
    WHERE c.id = ANY(p_item_ids)
      AND c.user_id = auth.uid();
  ELSE
    UPDATE public.collection_items c
    SET custom_lists = COALESCE(
      (
        SELECT array_agg(elem)
        FROM unnest(COALESCE(c.custom_lists, ARRAY[]::text[])) AS elem
        WHERE elem <> p_list_name
          AND NOT (elem LIKE meta_prefix || '%')
      ),
      ARRAY[]::text[]
    )
    WHERE c.id = ANY(p_item_ids)
      AND c.user_id = auth.uid();
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. OPTIMIZED CLERK RANK TRIGGER (PHASE 7)
-- -----------------------------------------------------------------------------
-- Only updates public.profiles when clerk_rank actually changes, avoiding
-- redundant profile row locks and writes on every single collection mutation.

CREATE OR REPLACE FUNCTION public.update_clerk_rank_on_collection_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  item_count integer;
  new_rank text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  IF target_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::int INTO item_count
  FROM public.collection_items
  WHERE user_id = target_user_id;

  IF item_count >= 500 THEN
    new_rank := 'Store Manager';
  ELSIF item_count >= 200 THEN
    new_rank := 'Assistant Manager';
  ELSIF item_count >= 50 THEN
    new_rank := 'Shift Supervisor';
  ELSE
    new_rank := 'Trainee';
  END IF;

  -- Skip write if rank has not changed
  UPDATE public.profiles
  SET clerk_rank = new_rank
  WHERE id = target_user_id
    AND clerk_rank IS DISTINCT FROM new_rank;

  RETURN NULL;
END;
$$;

COMMIT;

-- =============================================================================
-- ROLLBACK REFERENCE (Down Migration)
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.bulk_update_custom_lists_rpc(UUID[], TEXT, BOOLEAN, TEXT);
-- DROP FUNCTION IF EXISTS public.get_user_collection_stats(UUID);
-- DROP INDEX IF EXISTS public.idx_collection_items_movie_id;
-- DROP INDEX IF EXISTS public.idx_collection_items_show_id;
-- DROP INDEX IF EXISTS public.idx_collection_items_user_sort_order;
-- DROP INDEX IF EXISTS public.idx_collection_items_user_on_display;
-- DROP INDEX IF EXISTS public.idx_collection_items_user_grail;
-- DROP INDEX IF EXISTS public.idx_collection_items_marketplace_feed;
-- DROP INDEX IF EXISTS public.idx_collection_items_user_watched;
-- DROP INDEX IF EXISTS public.idx_collection_items_custom_lists_gin;
-- DROP INDEX IF EXISTS public.idx_notifications_user_unread_date;
-- DROP INDEX IF EXISTS public.idx_messages_conversation_date;
-- DROP INDEX IF EXISTS public.idx_messages_receiver_unread;
-- DROP INDEX IF EXISTS public.idx_profiles_username_lower;
