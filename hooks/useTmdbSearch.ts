import { searchMedia } from '@/lib/tmdb';
import { useQuery } from '@tanstack/react-query';

export function useTmdbSearch(query: string) {
  return useQuery({
    queryKey: ['tmdb', 'search', query],
    queryFn: () => searchMedia(query),
    enabled: query.trim().length > 0,
  });
}
