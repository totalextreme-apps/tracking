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
  BluRay: 4,
  DVD: 3,
  VHS: 2,
  Digital: 1,
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
  return collection.filter((item) => item.is_on_display && item.status !== 'wishlist');
}

export function getWishlistItems(collection: CollectionItemWithMedia[] | undefined) {
  if (!collection) return [];
  return collection.filter((item) => item.status === 'wishlist');
}

export type SortOption = 'recent' | 'title' | 'release' | 'rating' | 'bootleg';
export type SortOrder = 'asc' | 'desc';

export function getStacks(
  items: CollectionItemWithMedia[] | undefined,
  thriftMode = false,
  sortBy: SortOption = 'recent',
  sortOrder: SortOrder = 'desc'
): CollectionItemWithMedia[][] {
  const filtered = filterByThriftMode(items, thriftMode);
  if (filtered.length === 0) return [];

  // Group by movie_id or show_id + season_number
  const groups = new Map<string, CollectionItemWithMedia[]>();
  for (const item of filtered) {
    let key: string;
    if (item.media_type === 'tv' && item.show_id) {
      key = `tv-${item.show_id}-s${item.season_number ?? 0}`;
    } else if (item.movie_id) {
      key = `movie-${item.movie_id}`;
    } else {
      continue;
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

  // Sort stacks
  stacks.sort((a, b) => {
    const itemA = a[0];
    const itemB = b[0];

    const mediaA = itemA.movies || itemA.shows;
    const mediaB = itemB.movies || itemB.shows;

    let comparison = 0;

    switch (sortBy) {
      case 'title':
        const titleA = itemA.movies?.title ?? itemA.shows?.name ?? '';
        const titleB = itemB.movies?.title ?? itemB.shows?.name ?? '';
        comparison = titleA.localeCompare(titleB);
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
      case 'recent':
      default:
        comparison = new Date(itemA.created_at).getTime() - new Date(itemB.created_at).getTime();
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return stacks;
}
