import { searchMedia, getPersonMovieCredits, getPersonTvCredits, searchPerson } from '@/lib/tmdb';
import { useQuery } from '@tanstack/react-query';

export function useTmdbSearch(query: string, page = 1, searchMode = 'title') {
  return useQuery({
    queryKey: ['tmdb', 'search', query, page, searchMode],
    queryFn: async () => {
      if (searchMode === 'title') {
        return searchMedia(query, page);
      }

      try {
        const names = query.split(',').map(n => n.trim()).filter(n => n.length > 0);
        if (names.length === 0) {
          return { page: 1, results: [], total_pages: 1, total_results: 0 };
        }

        const personResList = await Promise.all(names.map(name => searchPerson(name, 1)));
        const persons = personResList.map(res => res.results?.[0]).filter(Boolean);
        
        if (persons.length === 0 || persons.length !== names.length) {
          return { page: 1, results: [], total_pages: 1, total_results: 0 };
        }

        const allCreditsPromises = persons.map(async (person) => {
          const [movieCredits, tvCredits] = await Promise.all([
            getPersonMovieCredits(person.id),
            getPersonTvCredits(person.id)
          ]);

          let credits: any[] = [];
          if (searchMode === 'actor') {
            credits = [
              ...(movieCredits.cast || []).map((c: any) => ({ ...c, media_type: 'movie' })),
              ...(tvCredits.cast || []).map((c: any) => ({ ...c, media_type: 'tv' }))
            ];
          } else if (searchMode === 'director') {
            credits = [
              ...(movieCredits.crew || [])
                .filter((c: any) => c.job === 'Director')
                .map((c: any) => ({ ...c, media_type: 'movie' })),
              ...(tvCredits.crew || [])
                .filter((c: any) => c.job === 'Director')
                .map((c: any) => ({ ...c, media_type: 'tv' }))
            ];
          }
          return credits;
        });

        const creditsLists = await Promise.all(allCreditsPromises);

        // Find intersection of all lists
        let combined = creditsLists[0] || [];
        for (let i = 1; i < creditsLists.length; i++) {
          const currentList = creditsLists[i];
          const currentIds = new Set(currentList.map(c => `${c.media_type}-${c.id}`));
          combined = combined.filter(c => currentIds.has(`${c.media_type}-${c.id}`));
        }

        // Deduplicate
        const uniqueCombined = [];
        const seen = new Set();
        for (const item of combined) {
          const key = `${item.media_type}-${item.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueCombined.push(item);
          }
        }
        combined = uniqueCombined;

        combined.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

        const itemsPerPage = 20;
        const startIndex = (page - 1) * itemsPerPage;
        const paginated = combined.slice(startIndex, startIndex + itemsPerPage);

        return {
          page: page,
          results: paginated,
          total_pages: Math.ceil(combined.length / itemsPerPage) || 1,
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
