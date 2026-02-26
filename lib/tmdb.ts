const TMDB_BASE = 'https://api.themoviedb.org/3';
const API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY ?? '';

export interface TmdbMovieResult {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  genres?: { id: number; name: string }[];
}

export interface TmdbSearchResponse {
  page: number;
  results: TmdbMovieResult[];
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

export async function searchMovies(query: string, page = 1): Promise<TmdbSearchResponse> {
  const encoded = encodeURIComponent(query);
  let data = await tmdbFetch<any>(`/search/multi?query=${encoded}&page=${page}`);

  // Forgiving Search Fallback: TMDB is notoriously bad at dealing with merged words (e.g., 'bladerunner' or 'spiderman')
  // If we get <3 results for a single word, try splitting it before common suffixes or capital letters
  if ((!data.results || data.results.length < 3) && !query.includes(' ')) {
    const camelSplit = query.replace(/([a-z])([A-Z])/g, '$1 $2');

    let fallbackData = null;

    // 1. Try splitting CamelCase (e.g. BladeRunner -> Blade Runner)
    if (camelSplit !== query) {
      fallbackData = await tmdbFetch<any>(`/search/multi?query=${encodeURIComponent(camelSplit)}&page=${page}`);
    }

    // 2. Try splitting common cinematic suffixes (e.g. bladerunner -> blade runner, spiderman -> spider man)
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

  const movieResults = new Map<number, TmdbMovieResult>();
  let personIdToFetch: number | null = null;

  for (const item of data.results) {
    if (item.media_type === 'movie') {
      movieResults.set(item.id, item);
    } else if (item.media_type === 'person') {
      // Keep track of the first person found to pull their full credits
      if (!personIdToFetch) personIdToFetch = item.id;

      if (item.known_for) {
        for (const kf of item.known_for) {
          if (kf.media_type === 'movie') {
            movieResults.set(kf.id, kf);
          }
        }
      }
    }
  }

  // If a person was found, fetch their actual filmography
  if (personIdToFetch && page === 1) {
    try {
      const credits = await tmdbFetch<any>(`/person/${personIdToFetch}/movie_credits`);

      // Add directed movies
      const directed = credits.crew?.filter((c: any) => c.job === 'Director') || [];
      for (const m of directed) movieResults.set(m.id, m);

      // Add top acting roles
      const acted = credits.cast?.slice(0, 30) || [];
      for (const m of acted) movieResults.set(m.id, m);
    } catch (e) {
      console.warn('Failed to fetch person credits', e);
    }
  }

  // Convert to array and sort by popularity so the best movies are at the top
  const finalResults = Array.from(movieResults.values())
    .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 20);

  return {
    page: data.page,
    results: finalResults,
    total_pages: data.total_pages,
    total_results: finalResults.length, // approximation for UI
  };
}

export async function getMovieById(tmdbId: number): Promise<TmdbMovieResult & { credits?: { cast: any[] } }> {
  return tmdbFetch<TmdbMovieResult & { credits?: { cast: any[] } }>(`/movie/${tmdbId}?append_to_response=credits`);
}
