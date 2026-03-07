ALTER TABLE public.collection_items DROP CONSTRAINT IF EXISTS collection_items_user_id_movie_id_format_key;
ALTER TABLE public.collection_items DROP CONSTRAINT IF EXISTS collection_items_user_id_show_id_season_number_format_key;
ALTER TABLE public.collection_items ADD UNIQUE NULLS NOT DISTINCT (user_id, movie_id, show_id, season_number, format, edition);
