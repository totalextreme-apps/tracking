-- Create RPC function to fetch app-wide stats for most owned and most wanted titles
CREATE OR REPLACE FUNCTION public.get_app_wide_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  most_owned jsonb;
  most_wanted jsonb;
BEGIN
  -- 1. Fetch top 5 most owned movies/shows
  SELECT json_agg(t) INTO most_owned
  FROM (
    SELECT 
      c.movie_id,
      c.show_id,
      count(*) as count,
      m.title as movie_title,
      m.poster_path as movie_poster,
      s.name as show_name,
      s.poster_path as show_poster
    FROM public.collection_items c
    LEFT JOIN public.movies m ON c.movie_id = m.id
    LEFT JOIN public.shows s ON c.show_id = s.id
    WHERE c.status = 'owned'
    GROUP BY c.movie_id, c.show_id, m.title, m.poster_path, s.name, s.poster_path
    ORDER BY count DESC
    LIMIT 5
  ) t;

  -- 2. Fetch top 5 most wanted movies/shows
  SELECT json_agg(t) INTO most_wanted
  FROM (
    SELECT 
      c.movie_id,
      c.show_id,
      count(*) as count,
      m.title as movie_title,
      m.poster_path as movie_poster,
      s.name as show_name,
      s.poster_path as show_poster
    FROM public.collection_items c
    LEFT JOIN public.movies m ON c.movie_id = m.id
    LEFT JOIN public.shows s ON c.show_id = s.id
    WHERE c.status = 'wishlist'
    GROUP BY c.movie_id, c.show_id, m.title, m.poster_path, s.name, s.poster_path
    ORDER BY count DESC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'most_owned', COALESCE(most_owned, '[]'::json),
    'most_wanted', COALESCE(most_wanted, '[]'::json)
  );
END;
$$;
