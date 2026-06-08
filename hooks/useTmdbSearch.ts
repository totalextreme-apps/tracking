import { searchMedia } from '@/lib/tmdb';
import { useQuery } from '@tanstack/react-query';

export function useTmdbSearch(query: string, page = 1) {
  return useQuery({
    queryKey: ['tmdb', 'search', query, page],
    queryFn: () => searchMedia(query, page),
    enabled: query.trim().length > 0,
  });
}
