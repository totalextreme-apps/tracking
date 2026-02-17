import { useQuery } from '@tanstack/react-query';
import { searchMovies } from '@/lib/tmdb';

export function useTmdbSearch(query: string) {
  return useQuery({
    queryKey: ['tmdb', 'search', query],
    queryFn: () => searchMovies(query),
    enabled: query.length >= 2,
  });
}
