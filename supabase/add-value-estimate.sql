-- Migration: Add value_estimate column to collection_items
alter table public.collection_items 
  add column if not exists value_estimate numeric;
