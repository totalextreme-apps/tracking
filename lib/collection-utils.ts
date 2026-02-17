import type { CollectionItemWithMovie } from '@/types/database';

export function getGenres(collection: CollectionItemWithMovie[] | undefined): string[] {
  if (!collection) return [];
  const genres = new Set<string>();
  collection.forEach((item) => {
    item.movies?.genres?.forEach((g) => genres.add(g.name));
  });
  return Array.from(genres).sort();
}

const FORMAT_ORDER: Record<string, number> = {
  '4K': 5,
  BluRay: 4,
  DVD: 3,
  VHS: 2,
  Digital: 1,
};

function filterByThriftMode(
  items: CollectionItemWithMovie[] | undefined,
  thriftMode: boolean
): CollectionItemWithMovie[] {
  if (!items) return [];
  return items.filter((i) =>
    thriftMode ? i.status === 'wishlist' : i.status === 'owned'
  );
}

export function getOnDisplayItems(collection: CollectionItemWithMovie[] | undefined) {
  if (!collection) return [];
  return collection.filter((item) => item.is_on_display && item.status !== 'wishlist');
}

export function getWishlistItems(collection: CollectionItemWithMovie[] | undefined) {
  if (!collection) return [];
  return collection.filter((item) => item.status === 'wishlist');
}

export type SortOption = 'recent' | 'title' | 'release' | 'rating';
export type SortOrder = 'asc' | 'desc';

export function getStacks(
  items: CollectionItemWithMovie[] | undefined,
  thriftMode = false,
  sortBy: SortOption = 'recent',
  sortOrder: SortOrder = 'desc'
): CollectionItemWithMovie[][] {
  const filtered = filterByThriftMode(items, thriftMode);
  if (filtered.length === 0) return [];

  // Group by movie_id
  const byMovie = new Map<number, CollectionItemWithMovie[]>();
  for (const item of filtered) {
    if (!item.movies) continue;
    const existing = byMovie.get(item.movie_id) ?? [];
    existing.push(item);
    byMovie.set(item.movie_id, existing);
  }

  // Sort each stack by format quality (highest first)
  const stacks: CollectionItemWithMovie[][] = [];
  for (const group of byMovie.values()) {
    const sorted = [...group].sort(
      (a, b) => (FORMAT_ORDER[b.format] ?? 0) - (FORMAT_ORDER[a.format] ?? 0)
    );
    stacks.push(sorted);
  }

  // Sort stacks
  stacks.sort((a, b) => {
    const itemA = a[0];
    const itemB = b[0];

    let comparison = 0;

    switch (sortBy) {
      case 'title':
        const titleA = itemA.movies?.title ?? '';
        const titleB = itemB.movies?.title ?? '';
        comparison = titleA.localeCompare(titleB);
        break;
      case 'release':
        const dateA = itemA.movies?.release_date ?? '';
        const dateB = itemB.movies?.release_date ?? '';
        comparison = dateA.localeCompare(dateB);
        break;
      case 'rating':
        const ratingA = itemA.rating ?? 0;
        const ratingB = itemB.rating ?? 0;
        comparison = ratingA - ratingB;
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
