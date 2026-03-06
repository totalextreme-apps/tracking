const TMDB_BASE = 'https://api.themoviedb.org/3';
const API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY ?? '';

export interface TmdbMediaResult {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  genres?: { id: number; name: string }[];
  number_of_seasons?: number;
  seasons?: {
    air_date: string;
    episode_count: number;
    id: number;
    name: string;
    overview: string;
    poster_path: string;
    season_number: number;
  }[];
}

export interface TmdbSearchResponse {
  page: number;
  results: TmdbMediaResult[];
  total_pages: number;
  total_results: number;
}

async function tmdbFetch<T>(path: string): Promise<T> {
  if (!API_KEY) {
    throw new Error('EXPO_PUBLIC_TMDB_API_KEY is not set in .env');
  }
  const url = `${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB API error: ${res.status}`);
  }
  return res.json();
}

export async function searchMedia(query: string, page = 1): Promise<TmdbSearchResponse> {
  const encoded = encodeURIComponent(query);
  let data = await tmdbFetch<any>(`/search/multi?query=${encoded}&page=${page}`);

  // Forgiving Search Fallback: TMDB is notoriously bad at dealing with merged words (e.g., 'bladerunner' or 'spiderman')
  if ((!data.results || data.results.length < 3) && !query.includes(' ')) {
    const camelSplit = query.replace(/([a-z])([A-Z])/g, '$1 $2');
    let fallbackData = null;

    if (camelSplit !== query) {
      fallbackData = await tmdbFetch<any>(`/search/multi?query=${encodeURIComponent(camelSplit)}&page=${page}`);
    }

    if (!fallbackData || fallbackData.results.length === 0) {
      const cinematicSuffixes = ['man', 'woman', 'runner', 'wars', 'trek', 'girl', 'boy', 'day', 'night', 'world', 'game', 'story', 'land', 'city'];
      const lowerQuery = query.toLowerCase();

      for (const suffix of cinematicSuffixes) {
        if (lowerQuery.endsWith(suffix) && lowerQuery.length > suffix.length + 2) {
          const splitQuery = query.slice(0, -suffix.length) + ' ' + query.slice(-suffix.length);
          const splitData = await tmdbFetch<any>(`/search/multi?query=${encodeURIComponent(splitQuery)}&page=${page}`);
          if (splitData.results && splitData.results.length > 0) {
            fallbackData = splitData;
            break;
          }
        }
      }
    }

    if (fallbackData && fallbackData.results && fallbackData.results.length > 0) {
      data = fallbackData;
    }
  }

  const mediaResults = new Map<string, TmdbMediaResult>();
  let personIdToFetch: number | null = null;

  for (const item of data.results) {
    if (item.media_type === 'movie' || item.media_type === 'tv') {
      mediaResults.set(`${item.media_type}-${item.id}`, item);
    } else if (item.media_type === 'person') {
      if (!personIdToFetch) personIdToFetch = item.id;
      if (item.known_for) {
        for (const kf of item.known_for) {
          if (kf.media_type === 'movie' || kf.media_type === 'tv') {
            mediaResults.set(`${kf.media_type}-${kf.id}`, kf);
          }
        }
      }
    }
  }

  // If a person was found, fetch their actual filmography
  if (personIdToFetch && page === 1) {
    try {
      const movieCredits = await tmdbFetch<any>(`/person/${personIdToFetch}/movie_credits`);
      const tvCredits = await tmdbFetch<any>(`/person/${personIdToFetch}/tv_credits`);

      // Combine and add
      const movies = [...(movieCredits.cast || []), ...(movieCredits.crew || [])];
      const tvs = [...(tvCredits.cast || []), ...(tvCredits.crew || [])];

      for (const m of movies) mediaResults.set(`movie-${m.id}`, { ...m, media_type: 'movie' });
      for (const t of tvs) mediaResults.set(`tv-${t.id}`, { ...t, media_type: 'tv' });
    } catch (e) {
      console.warn('Failed to fetch person credits', e);
    }
  }

  const finalResults = Array.from(mediaResults.values())
    .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 20);

  return {
    page: data.page,
    results: finalResults,
    total_pages: data.total_pages,
    total_results: finalResults.length,
  };
}

export async function getMovieById(tmdbId: number): Promise<TmdbMediaResult & { credits?: { cast: any[] } }> {
  return tmdbFetch<TmdbMediaResult & { credits?: { cast: any[] } }>(`/movie/${tmdbId}?append_to_response=credits`);
}

export async function getTvShowById(tmdbId: number): Promise<TmdbMediaResult & { credits?: { cast: any[] } }> {
  return tmdbFetch<TmdbMediaResult & { credits?: { cast: any[] } }>(`/tv/${tmdbId}?append_to_response=credits`);
}

