-- ============================================================================
-- MediaTracking.app — Lightweight Sync Fingerprint RPC (~130 bytes)
-- Allows returning sessions with a persisted local cache (IndexedDB / AsyncStorage)
-- to verify whether anything in the user's collection changed before downloading
-- any collection rows.
--
-- Safe, idempotent, reversible, and respects all existing RLS policies (SECURITY INVOKER).
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- 1. Add updated_at column to collection_items if not already present
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Keep updated_at current on every row UPDATE
CREATE OR REPLACE FUNCTION public.set_collection_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collection_items_updated_at ON public.collection_items;
CREATE TRIGGER trg_collection_items_updated_at
  BEFORE UPDATE ON public.collection_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_collection_items_updated_at();

-- 3. Composite index for fast per-user sync checks
CREATE INDEX IF NOT EXISTS idx_collection_items_user_updated_at
  ON public.collection_items (user_id, updated_at DESC);

-- 4. Lightweight ~130-byte Sync Fingerprint RPC
-- Detects any insert, delete, or field edit across the user's collection.
CREATE OR REPLACE FUNCTION public.get_collection_sync_fingerprint(target_user_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'item_count', COUNT(*),
    'max_created_at', MAX(created_at),
    'max_updated_at', MAX(updated_at),
    'checksum', COALESCE(
      BIT_XOR(
        ('x' || SUBSTRING(MD5(
          id::text || ':' ||
          COALESCE(status, '') || ':' ||
          COALESCE(format, '') || ':' ||
          COALESCE(rating::text, '') || ':' ||
          COALESCE(watch_count::text, '') || ':' ||
          COALESCE(display_order::text, '') || ':' ||
          COALESCE(grail_order::text, '') || ':' ||
          COALESCE(is_on_display::text, '') || ':' ||
          COALESCE(is_grail::text, '') || ':' ||
          COALESCE(for_sale::text, '') || ':' ||
          COALESCE(for_trade::text, '') || ':' ||
          COALESCE(value_estimate::text, '') || ':' ||
          COALESCE(array_to_string(custom_lists, ','), '')
        ), 1, 16))::bit(64)::bigint
      ),
      0
    )::text
  )
  FROM public.collection_items
  WHERE user_id = target_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_collection_sync_fingerprint(UUID) TO authenticated, anon;
