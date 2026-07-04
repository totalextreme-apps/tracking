import { searchMedia, getPersonMovieCredits, getPersonTvCredits } from '@/lib/tmdb';
import { useQuery } from '@tanstack/react-query';

export function useTmdbSearch(query: string, page = 1, searchMode = 'title') {
  return useQuery({
    queryKey: ['tmdb', 'search', query, page, searchMode],
    queryFn: async () => {
      if (searchMode === 'title') {
        return searchMedia(query, page);
      }

      try {
        const personRes = await searchMedia(query, 1);
        const person = personRes.results.find(r => (r as any).media_type === 'person' || (r as any).known_for);
        if (!person) {
          return { page: 1, results: [], total_pages: 1, total_results: 0 };
        }

        const movieCredits = await getPersonMovieCredits(person.id);
        const tvCredits = await getPersonTvCredits(person.id);

        let combined: any[] = [];
        if (searchMode === 'actor') {
          combined = [
            ...(movieCredits.cast || []).map((c: any) => ({ ...c, media_type: 'movie' })),
            ...(tvCredits.cast || []).map((c: any) => ({ ...c, media_type: 'tv' }))
          ];
        } else if (searchMode === 'director') {
          combined = [
            ...(movieCredits.crew || [])
              .filter((c: any) => c.job === 'Director')
              .map((c: any) => ({ ...c, media_type: 'movie' })),
            ...(tvCredits.crew || [])
              .filter((c: any) => c.job === 'Director')
              .map((c: any) => ({ ...c, media_type: 'tv' }))
          ];
        }

        combined.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

        const itemsPerPage = 20;
        const startIndex = (page - 1) * itemsPerPage;
        const paginated = combined.slice(startIndex, startIndex + itemsPerPage);

        return {
          page: page,
          results: paginated,
          total_pages: Math.ceil(combined.length / itemsPerPage),
          total_results: combined.length
        };
      } catch (e) {
        console.error('TMDB credit search failed:', e);
        return { page: 1, results: [], total_pages: 1, total_results: 0 };
      }
    },
    enabled: query.trim().length > 0,
  });
}
