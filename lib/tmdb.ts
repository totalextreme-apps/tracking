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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const url = `${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${API_KEY}`;

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      throw new Error(`TMDB API error: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function searchMedia(query: string, page = 1): Promise<TmdbSearchResponse> {
  const trimmedQuery = query.trim();
  
  // Detect Year (e.g. "The Reaper 2000" or "The Reaper (2000)")
  const yearMatch = trimmedQuery.match(/\(?\b(19|20)\d{2}\b\)?$/);
  let year: string | null = null;
  let cleanQuery = trimmedQuery;
  
  if (yearMatch) {
    const rawMatch = yearMatch[0];
    year = rawMatch.replace(/[()]/g, ''); // Extract just the digits
    cleanQuery = trimmedQuery.replace(rawMatch, '').trim();
  }

  // ─── NEW: Multi-Cast Search Logic ───
  if (trimmedQuery.includes(',')) {
    const names = trimmedQuery.split(',').map(n => n.trim()).filter(n => n.length > 0);
    if (names.length >= 1) {
      try {
        // Resolve names to Person IDs
        const personPromises = names.map(name => tmdbFetch<any>(`/search/person?query=${encodeURIComponent(name)}&page=1`));
        const personResults = await Promise.all(personPromises);
        const personIds = personResults.map(r => r.results?.[0]?.id).filter(id => !!id);

        if (personIds.length > 0) {
          // Use Discover API with with_cast parameter (comma = AND logic in TMDB discover)
          const discoverData = await tmdbFetch<any>(`/discover/movie?with_cast=${personIds.join(',')}&page=${page}&sort_by=popularity.desc`);
          const tvDiscoverData = await tmdbFetch<any>(`/discover/tv?with_cast=${personIds.join(',')}&page=${page}&sort_by=popularity.desc`);
          
          const combinedResults = [
            ...(discoverData.results || []).map((r: any) => ({ ...r, media_type: 'movie' })),
            ...(tvDiscoverData.results || []).map((r: any) => ({ ...r, media_type: 'tv' }))
          ];

          return {
            page: page,
            results: combinedResults,
            total_pages: Math.max(discoverData.total_pages || 0, tvDiscoverData.total_pages || 0),
            total_results: combinedResults.length
          };
        }
      } catch (e) {
        console.warn('Multi-cast search failed, falling back', e);
      }
    }
  }

  const encoded = encodeURIComponent(cleanQuery);
  let data: any;

  if (year) {
    // If year detected, fetch movies and tv specifically with year filters
    try {
      const movieSearch = await tmdbFetch<any>(`/search/movie?query=${encoded}&primary_release_year=${year}&page=${page}`);
      const tvSearch = await tmdbFetch<any>(`/search/tv?query=${encoded}&first_air_date_year=${year}&page=${page}`);
      
      data = {
        page: page,
        results: [
          ...(movieSearch.results || []).map((r: any) => ({ ...r, media_type: 'movie' })),
          ...(tvSearch.results || []).map((r: any) => ({ ...r, media_type: 'tv' }))
        ],
        total_pages: Math.max(movieSearch.total_pages || 0, tvSearch.total_pages || 0),
        total_results: (movieSearch.total_results || 0) + (tvSearch.total_results || 0)
      };
    } catch (e) {
      // Fallback to multi-search if specialized fails
      data = await tmdbFetch<any>(`/search/multi?query=${encodeURIComponent(trimmedQuery)}&page=${page}`);
    }
  } else {
    data = await tmdbFetch<any>(`/search/multi?query=${encoded}&page=${page}`);
  }

  // Special handling for single-character searches which are often buried in multi-search
  if (cleanQuery.length === 1 && page === 1 && !year) {
    try {
      const movieSearch = await tmdbFetch<any>(`/search/movie?query=${encoded}&page=1`);
      const tvSearch = await tmdbFetch<any>(`/search/tv?query=${encoded}&page=1`);
      if (movieSearch.results) data.results.push(...movieSearch.results.map((r: any) => ({ ...r, media_type: 'movie' })));
      if (tvSearch.results) data.results.push(...tvSearch.results.map((r: any) => ({ ...r, media_type: 'tv' })));
    } catch (e) {
      console.warn('Failed to fetch specific results for short query', e);
    }
  }

  // Forgiving Search Fallback: If results are very low and it looks like a typo/crunched word
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

  // ─── NEW: Descriptive String Fallback (for noisy Barcode titles) ───
  if ((!data.results || data.results.length === 0) && cleanQuery.includes(' ')) {
    const words = cleanQuery.split(' ').filter(w => w.length > 0);
    if (words.length >= 4) {
      // Try searching for the first 3, 4, 5 words respectively
      for (let i = 5; i >= 3; i--) {
        if (words.length < i) continue;
        const subQuery = words.slice(0, i).join(' ');
        try {
          const fallbackData = await tmdbFetch<any>(`/search/multi?query=${encodeURIComponent(subQuery)}&page=${page}`);
          if (fallbackData.results && fallbackData.results.length > 0) {
            data = fallbackData;
            break;
          }
        } catch (e) { /* ignore */ }
      }
    }
  }

  const mediaResults = new Map<string, TmdbMediaResult>();
  let personIdToFetch: number | null = null;

  for (const item of data.results) {
    if (item.media_type === 'movie' || item.media_type === 'tv') {
      mediaResults.set(`${item.media_type}-${item.id}`, { ...item, isDirectMatch: true });
    } else if (item.media_type === 'person') {
      if (!personIdToFetch) personIdToFetch = item.id;
      if (item.known_for) {
        for (const kf of item.known_for) {
          if (kf.media_type === 'movie' || kf.media_type === 'tv') {
            mediaResults.set(`${kf.media_type}-${kf.id}`, { ...kf, isDirectMatch: true });
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

      // Combine and add — these are NOT direct title matches
      const movies = [...(movieCredits.cast || []), ...(movieCredits.crew || [])];
      const tvs = [...(tvCredits.cast || []), ...(tvCredits.crew || [])];

      for (const m of movies) {
        const key = `movie-${m.id}`;
        if (!mediaResults.has(key)) {
          mediaResults.set(key, { ...m, media_type: 'movie', isDirectMatch: false });
        }
      }
      for (const t of tvs) {
        const key = `tv-${t.id}`;
        if (!mediaResults.has(key)) {
          mediaResults.set(key, { ...t, media_type: 'tv', isDirectMatch: false });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch person credits', e);
    }
  }

  const finalResults = Array.from(mediaResults.values())
    .sort((a: any, b: any) => {
      const queryLower = query.toLowerCase();
      const titleA = (a.title || a.name || '').toLowerCase();
      const titleB = (b.title || b.name || '').toLowerCase();

      // Score 1: Exact Match (Massive weight)
      const exactA = titleA === queryLower ? 1 : 0;
      const exactB = titleB === queryLower ? 1 : 0;
      if (exactA !== exactB) return exactB - exactA;

      // Score 2: Starts With (High weight)
      const startsA = titleA.startsWith(queryLower) ? 1 : 0;
      const startsB = titleB.startsWith(queryLower) ? 1 : 0;
      if (startsA !== startsB) return startsB - startsA;

      // Score 3: Direct Match from Multi-Search (Medium weight)
      if (a.isDirectMatch && !b.isDirectMatch) return -1;
      if (!a.isDirectMatch && b.isDirectMatch) return 1;

      // Score 4: Popularity (Tie breaker)
      const popA = a.popularity || 0;
      const popB = b.popularity || 0;
      return popB - popA;
    })
    .slice(0, 40);

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

