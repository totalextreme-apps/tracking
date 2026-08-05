import type { CollectionItemWithMedia } from '@/types/database';

export function getGenres(collection: CollectionItemWithMedia[] | undefined): string[] {
  if (!collection) return [];
  const genres = new Set<string>();
  collection.forEach((item) => {
    const media = item.movies || item.shows;
    media?.genres?.forEach((g: any) => genres.add(g.name));
  });
  return Array.from(genres).sort();
}

export function getCustomLists(collection: CollectionItemWithMedia[] | undefined): string[] {
  if (!collection) return [];
  const lists = new Set<string>();
  collection.forEach((item) => {
    item.custom_lists?.forEach((listName) => lists.add(listName));
  });
  return Array.from(lists).sort();
}

const FORMAT_ORDER: Record<string, number> = {
  '4K': 5,
  'Blu-ray': 4,
  'BluRay': 4,
  'DVD': 3,
  'VHS': 2,
  'Digital': 1,
};

function filterByThriftMode(
  items: CollectionItemWithMedia[] | undefined,
  thriftMode: boolean
): CollectionItemWithMedia[] {
  if (!items) return [];
  return items.filter((i) =>
    thriftMode ? i.status === 'wishlist' : i.status === 'owned'
  );
}

export function getOnDisplayItems(collection: CollectionItemWithMedia[] | undefined) {
  if (!collection) return [];
  return collection
    .filter((item) => item.is_on_display && item.status === 'owned')
    .sort((a: any, b: any) => {
      if (a.display_order && b.display_order) return a.display_order - b.display_order;
      if (a.display_order) return -1;
      if (b.display_order) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export function getGrailItems(collection: CollectionItemWithMedia[] | undefined) {
  if (!collection) return [];
  return collection
    .filter((item) => item.is_grail && item.status === 'wishlist')
    .sort((a: any, b: any) => {
      if (a.grail_order && b.grail_order) return a.grail_order - b.grail_order;
      if (a.grail_order) return -1;
      if (b.grail_order) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export function getWishlistItems(collection: CollectionItemWithMedia[] | undefined) {
  if (!collection) return [];
  return collection.filter((item) => item.status === 'wishlist');
}

export type SortOption = 'recent' | 'title' | 'release' | 'rating' | 'bootleg' | 'genre' | 'value';
export type SortOrder = 'asc' | 'desc';

export function getStacks(
  items: CollectionItemWithMedia[] | undefined,
  thriftMode = false,
  sortBy: SortOption = 'recent',
  sortOrder: SortOrder = 'desc',
  searchQuery = '',
  useFranchiseSort = true
): CollectionItemWithMedia[][] {
  const filtered = filterByThriftMode(items, thriftMode);
  if (filtered.length === 0) return [];

  // Group by movie_id or show_id + season_number
  const groups = new Map<string, CollectionItemWithMedia[]>();
  for (const item of filtered) {
    const media = item.movies || item.shows;
    const tmdbId = media?.tmdb_id;
    let key: string;
    
    if (item.media_type === 'tv') {
      const showId = tmdbId || item.show_id || item.shows?.id || item.id;
      key = `tv-${showId}-s${item.season_number ?? 0}`;
    } else {
      const movieId = tmdbId || item.movie_id || item.movies?.id || item.id;
      key = `movie-${movieId}`;
    }

    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }

  // Sort each stack by format quality (highest first)
  const stacks: CollectionItemWithMedia[][] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) => (FORMAT_ORDER[b.format] ?? 0) - (FORMAT_ORDER[a.format] ?? 0)
    );
    stacks.push(sorted);
  }

  // Pre-calculate max relevance score for each franchise
  const franchiseMaxScores = new Map<string, number>();
  if (searchQuery && sortBy === 'recent' && useFranchiseSort) {
    const q = searchQuery.toLowerCase().trim();
    const getScore = (title: string) => {
      if (title === q) return 100;
      if (title.startsWith(q + ' ') || title.startsWith(q + ':')) return 80;
      if (title.includes(' ' + q + ' ') || title.includes(' ' + q)) return 60;
      if (title.includes(q)) return 40;
      return 0;
    };

    for (const stack of stacks) {
      const item = stack[0];
      const media = item.movies || item.shows;
      const franchise = media?.franchise?.trim()?.toLowerCase();
      if (franchise) {
        const title = ((media as any)?.title || (media as any)?.name || '').toLowerCase();
        const score = getScore(title);
        const currentMax = franchiseMaxScores.get(franchise) || 0;
        if (score > currentMax) {
          franchiseMaxScores.set(franchise, score);
        }
      }
    }
  }

  // Sort stacks
  stacks.sort((a, b) => {
    const itemA = a[0];
    const itemB = b[0];

    const mediaA = itemA.movies || itemA.shows;
    const mediaB = itemB.movies || itemB.shows;

    if (searchQuery && sortBy === 'recent') {
      const titleA = ((mediaA as any)?.title || (mediaA as any)?.name || '').toLowerCase();
      const titleB = ((mediaB as any)?.title || (mediaB as any)?.name || '').toLowerCase();
      
      // 1. If Franchise Sort is on and they are in the same franchise, franchise order ALWAYS wins
      if (useFranchiseSort) {
        const franchiseA = mediaA?.franchise?.trim();
        const franchiseB = mediaB?.franchise?.trim();
        if (franchiseA && franchiseB && franchiseA.toLowerCase() === franchiseB.toLowerCase()) {
          const orderA = mediaA?.franchise_order !== null && mediaA?.franchise_order !== undefined ? Number(mediaA.franchise_order) : Infinity;
          const orderB = mediaB?.franchise_order !== null && mediaB?.franchise_order !== undefined ? Number(mediaB.franchise_order) : Infinity;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
        }
      }

      // 2. Otherwise, use relevance score
      const q = searchQuery.toLowerCase().trim();

      const getScore = (title: string) => {
        if (title === q) return 100;
        if (title.startsWith(q + ' ') || title.startsWith(q + ':')) return 80;
        if (title.includes(' ' + q + ' ') || title.includes(' ' + q)) return 60;
        if (title.includes(q)) return 40;
        return 0;
      };

      let scoreA = getScore(titleA);
      let scoreB = getScore(titleB);

      // If Franchise Sort is on, boost the item's score to its franchise's max score
      if (useFranchiseSort) {
        const franchiseA = mediaA?.franchise?.trim()?.toLowerCase();
        const franchiseB = mediaB?.franchise?.trim()?.toLowerCase();
        if (franchiseA) scoreA = Math.max(scoreA, franchiseMaxScores.get(franchiseA) || 0);
        if (franchiseB) scoreB = Math.max(scoreB, franchiseMaxScores.get(franchiseB) || 0);
      }

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // 3. If scores are tied and Franchise Sort is enabled, group items by franchise
      if (useFranchiseSort) {
        const franchiseA = mediaA?.franchise?.trim() || '';
        const franchiseB = mediaB?.franchise?.trim() || '';
        if (franchiseA !== franchiseB) {
          if (franchiseA && !franchiseB) return -1;
          if (!franchiseA && franchiseB) return 1;
          return franchiseA.localeCompare(franchiseB);
        }
      }
    }

    let comparison = 0;

    switch (sortBy) {
      case 'recent':
        break; // If recent, it's already sorted by recent when passed in. Search ties are handled above.
      case 'title':
        const rawTitleA = itemA.movies?.title ?? itemA.shows?.name ?? '';
        const rawTitleB = itemB.movies?.title ?? itemB.shows?.name ?? '';

        if (useFranchiseSort) {
          const mediaA = itemA.movies || itemA.shows;
          const mediaB = itemB.movies || itemB.shows;

          const franchiseA = mediaA?.franchise?.trim();
          const franchiseB = mediaB?.franchise?.trim();

          if (franchiseA && franchiseB) {
            if (franchiseA.toLowerCase() === franchiseB.toLowerCase()) {
              const orderA = mediaA?.franchise_order !== null && mediaA?.franchise_order !== undefined ? Number(mediaA.franchise_order) : Infinity;
              const orderB = mediaB?.franchise_order !== null && mediaB?.franchise_order !== undefined ? Number(mediaB.franchise_order) : Infinity;
              if (orderA !== orderB) {
                comparison = orderA - orderB;
              } else {
                comparison = rawTitleA.localeCompare(rawTitleB);
              }
            } else {
              comparison = franchiseA.localeCompare(franchiseB);
            }
          } else if (franchiseA) {
            comparison = franchiseA.localeCompare(rawTitleB);
          } else if (franchiseB) {
            comparison = rawTitleA.localeCompare(franchiseB);
          } else {
            comparison = rawTitleA.localeCompare(rawTitleB);
          }
        } else {
          comparison = rawTitleA.localeCompare(rawTitleB);
        }

        // If titles are same, sort by season
        if (comparison === 0 && itemA.show_id === itemB.show_id) {
          comparison = (itemA.season_number ?? 0) - (itemB.season_number ?? 0);
        }
        break;
      case 'release':
        const dateA = itemA.movies?.release_date ?? itemA.shows?.first_air_date ?? '';
        const dateB = itemB.movies?.release_date ?? itemB.shows?.first_air_date ?? '';
        comparison = dateA.localeCompare(dateB);
        break;
      case 'rating':
        const ratingA = itemA.rating ?? 0;
        const ratingB = itemB.rating ?? 0;
        comparison = ratingA - ratingB;
        break;
      case 'bootleg':
        const isBootA = a.some(i => i.is_bootleg) ? 1 : 0;
        const isBootB = b.some(i => i.is_bootleg) ? 1 : 0;
        comparison = isBootA - isBootB;
        if (comparison === 0) {
          const titleAStr = itemA.movies?.title ?? itemA.shows?.name ?? '';
          const titleBStr = itemB.movies?.title ?? itemB.shows?.name ?? '';
          comparison = titleAStr.localeCompare(titleBStr);
        }
        break;
      case 'genre':
        const genreA = (itemA.movies?.genres?.[0]?.name ?? itemA.shows?.genres?.[0]?.name ?? 'ZZZ');
        const genreB = (itemB.movies?.genres?.[0]?.name ?? itemB.shows?.genres?.[0]?.name ?? 'ZZZ');
        comparison = genreA.localeCompare(genreB);
        if (comparison === 0) {
          const titleAStr = itemA.movies?.title ?? itemA.shows?.name ?? '';
          const titleBStr = itemB.movies?.title ?? itemB.shows?.name ?? '';
          comparison = titleAStr.localeCompare(titleBStr);
        }
        break;
      case 'value':
        const valA = itemA.value_estimate ?? -1;
        const valB = itemB.value_estimate ?? -1;
        comparison = valA - valB;
        if (comparison === 0) {
          const titleAStr = itemA.movies?.title ?? itemA.shows?.name ?? '';
          const titleBStr = itemB.movies?.title ?? itemB.shows?.name ?? '';
          comparison = titleAStr.localeCompare(titleBStr);
        }
        break;
      case 'recent':
      default:
        comparison = new Date(itemA.created_at).getTime() - new Date(itemB.created_at).getTime();
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return stacks;
}
