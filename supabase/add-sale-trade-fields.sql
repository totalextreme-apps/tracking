-- Migration: Add For Sale / For Trade functionality
-- This allows users to mark items in their collection for sale or trade.

alter table public.collection_items 
  add column if not exists for_sale boolean default false,
  add column if not exists for_trade boolean default false,
  add column if not exists price numeric;

-- Indexing for performance in "Bins"
create index if not exists idx_collection_items_listing_status on public.collection_items (user_id, for_sale, for_trade);
