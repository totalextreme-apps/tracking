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
  return tmdbFetch<TmdbSearchResponse>(`/search/movie?query=${encoded}&page=${page}`);
}

export async function getMovieById(tmdbId: number): Promise<TmdbMovieResult & { credits?: { cast: any[] } }> {
  return tmdbFetch<TmdbMovieResult & { credits?: { cast: any[] } }>(`/movie/${tmdbId}?append_to_response=credits`);
}
