-- Add top_five_order field to the follows table to support custom sorting of Top 5 pinned members
ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS top_five_order INTEGER DEFAULT 0;
