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

export const STACK_META_PREFIX = '__meta__:';
export const CUSTOM_TITLE_PREFIX = '__custom_title__:';
export const MULTIPACK_PREFIX = '__multipack__:';

export function isReservedListEntry(entry: string): boolean {
  return (
    entry.startsWith(STACK_META_PREFIX) ||
    entry.startsWith(CUSTOM_TITLE_PREFIX) ||
    entry.startsWith(MULTIPACK_PREFIX)
  );
}

export function getItemCustomTitle(
  item: { custom_lists?: string[] | null; custom_title?: string | null } | null | undefined
): string | null {
  if (!item) return null;
  if (typeof (item as any).custom_title === 'string' && (item as any).custom_title.trim()) {
    return (item as any).custom_title.trim();
  }
  if (!Array.isArray(item.custom_lists)) return null;
  const entry = item.custom_lists.find((e) => typeof e === 'string' && e.startsWith(CUSTOM_TITLE_PREFIX));
  if (!entry) return null;
  const val = entry.slice(CUSTOM_TITLE_PREFIX.length).trim();
  return val || null;
}

export function getItemMultipack(
  item: { custom_lists?: string[] | null; multipack?: string | null } | null | undefined
): string | null {
  if (!item) return null;
  if (typeof (item as any).multipack === 'string' && (item as any).multipack.trim()) {
    return (item as any).multipack.trim();
  }
  if (!Array.isArray(item.custom_lists)) return null;
  const entry = item.custom_lists.find((e) => typeof e === 'string' && e.startsWith(MULTIPACK_PREFIX));
  if (!entry) return null;
  const val = entry.slice(MULTIPACK_PREFIX.length).trim();
  return val || null;
}

export function getItemDisplayTitle(item: CollectionItemWithMedia | null | undefined): string {
  if (!item) return '';
  const custom = getItemCustomTitle(item);
  if (custom) return custom;
  const media = item.movies || item.shows;
  return (media as any)?.title || (media as any)?.name || '';
}

export function getStackDisplayTitle(item: CollectionItemWithMedia | null | undefined): string {
  if (!item) return '';
  if ((item as any).__isMultipackStack && (item as any).__multipackTitle) {
    return (item as any).__multipackTitle;
  }
  return getItemDisplayTitle(item);
}

export function isMultipackStack(stack: CollectionItemWithMedia[] | null | undefined): boolean {
  if (!stack || stack.length === 0) return false;
  return !!(stack[0] as any)?.__isMultipackStack;
}

export function withItemMetadata(
  customLists: string[] | null | undefined,
  opts: { customTitle?: string | null; multipack?: string | null }
): string[] {
  let result = Array.isArray(customLists) ? [...customLists] : [];
  if (opts.customTitle !== undefined) {
    result = result.filter((e) => !(typeof e === 'string' && e.startsWith(CUSTOM_TITLE_PREFIX)));
    const trimmed = opts.customTitle?.trim();
    if (trimmed) {
      result.push(`${CUSTOM_TITLE_PREFIX}${trimmed}`);
    }
  }
  if (opts.multipack !== undefined) {
    result = result.filter((e) => !(typeof e === 'string' && e.startsWith(MULTIPACK_PREFIX)));
    const trimmed = opts.multipack?.trim();
    if (trimmed) {
      result.push(`${MULTIPACK_PREFIX}${trimmed}`);
    }
  }
  return result;
}

export function getExistingMultipacks(collection: CollectionItemWithMedia[] | undefined): string[] {
  if (!collection) return [];
  const packs = new Map<string, string>();
  collection.forEach((item) => {
    const pack = getItemMultipack(item);
    if (pack) {
      const lower = pack.toLowerCase();
      if (!packs.has(lower)) {
        packs.set(lower, pack);
      }
    }
  });
  return Array.from(packs.values()).sort((a, b) => a.localeCompare(b));
}

export interface CuratedStackMeta {
  description?: string;
  isRanked?: boolean;
  itemOrder?: string[]; // ordered array of item IDs or stack keys
  updatedAt?: number;
}

export function isStackMetaEntry(entry: string, forListName?: string): boolean {
  if (!entry.startsWith(STACK_META_PREFIX)) return false;
  if (forListName === undefined) return true;
  return entry.startsWith(`${STACK_META_PREFIX}${forListName}:`);
}

export function serializeStackMeta(listName: string, meta: CuratedStackMeta): string {
  const payload: CuratedStackMeta = {
    description: meta.description?.trim() || '',
    isRanked: !!meta.isRanked,
    itemOrder: meta.itemOrder || [],
    updatedAt: meta.updatedAt || Date.now(),
  };
  return `${STACK_META_PREFIX}${listName}:${JSON.stringify(payload)}`;
}

export function getStackMeta(
  collection: CollectionItemWithMedia[] | undefined,
  listName: string
): CuratedStackMeta {
  if (!collection || !listName) return {};
  const prefix = `${STACK_META_PREFIX}${listName}:`;
  let best: CuratedStackMeta | null = null;

  for (const item of collection) {
    if (!item?.custom_lists) continue;
    for (const entry of item.custom_lists) {
      if (entry.startsWith(prefix)) {
        try {
          const parsed = JSON.parse(entry.slice(prefix.length)) as CuratedStackMeta;
          if (!best || (parsed.updatedAt || 0) > (best.updatedAt || 0)) {
            best = parsed;
          }
        } catch {
          // ignore malformed entry
        }
      }
    }
  }
  return best || {};
}

export function getCustomLists(collection: CollectionItemWithMedia[] | undefined): string[] {
  if (!collection) return [];
  const lists = new Set<string>();
  collection.forEach((item) => {
    item.custom_lists?.forEach((listName) => {
      if (listName && !isReservedListEntry(listName)) {
        lists.add(listName);
      }
    });
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
  useFranchiseSort = true,
  includeMultipackStacks = true
): CollectionItemWithMedia[][] {
  const filtered = filterByThriftMode(items, thriftMode);
  if (filtered.length === 0) return [];

  // Group by movie_id or show_id (+ custom title override so custom-titled VHS specials / releases stand as their own title)
  const groups = new Map<string, CollectionItemWithMedia[]>();
  const multipackGroups = new Map<string, { title: string; items: CollectionItemWithMedia[] }>();

  for (const item of filtered) {
    const media = item.movies || item.shows;
    const tmdbId = media?.tmdb_id;
    const customTitle = getItemCustomTitle(item)?.toLowerCase();
    let key: string;
    
    if (item.media_type === 'tv') {
      const showId = tmdbId || item.show_id || item.shows?.id || item.id;
      key = customTitle ? `tv-${showId}-custom-${customTitle}` : `tv-${showId}`;
    } else {
      const movieId = tmdbId || item.movie_id || item.movies?.id || item.id;
      key = customTitle ? `movie-${movieId}-custom-${customTitle}` : `movie-${movieId}`;
    }

    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);

    if (includeMultipackStacks) {
      const packName = getItemMultipack(item);
      if (packName) {
        const packKey = packName.toLowerCase();
        const existingPack = multipackGroups.get(packKey) ?? { title: packName, items: [] };
        existingPack.items.push(item);
        multipackGroups.set(packKey, existingPack);
      }
    }
  }

  // Sort each stack by season number (asc) then format quality (highest first)
  const stacks: CollectionItemWithMedia[][] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      if (a.media_type === 'tv' && b.media_type === 'tv') {
        const seasonA = a.season_number ?? 0;
        const seasonB = b.season_number ?? 0;
        if (seasonA !== seasonB) {
          return seasonA - seasonB;
        }
      }
      return (FORMAT_ORDER[b.format] ?? 0) - (FORMAT_ORDER[a.format] ?? 0);
    });
    stacks.push(sorted);
  }

  // Add Multi-pack compilation stacks so both the stacked multi-pack card AND individual items appear
  if (includeMultipackStacks) {
    for (const packGroup of multipackGroups.values()) {
      const sortedPackItems = [...packGroup.items].sort((a, b) => {
        const titleA = getItemDisplayTitle(a);
        const titleB = getItemDisplayTitle(b);
        return titleA.localeCompare(titleB);
      });
      const taggedPackStack = sortedPackItems.map((item) => ({
        ...item,
        __isMultipackStack: true,
        __multipackTitle: packGroup.title,
      })) as CollectionItemWithMedia[];
      stacks.push(taggedPackStack);
    }
  }

  // Pre-calculate max relevance score for each franchise
  const franchiseMaxScores = new Map<string, number>();
  if (searchQuery && sortBy === 'recent' && useFranchiseSort) {
    const q = searchQuery.toLowerCase().trim();
    const getScore = (title: string) => {
      if (!title) return 0;
      if (title === q) return 100;
      if (title.startsWith(q + ' ') || title.startsWith(q + ':')) return 80;
      if (title.includes(' ' + q + ' ') || title.includes(' ' + q)) return 60;
      if (title.includes(q)) return 40;
      return 0;
    };

    for (const stack of stacks) {
      const item = stack[0];
      const media = item.movies || item.shows;
      const franchise = !(item as any).__isMultipackStack ? item.franchise?.trim()?.toLowerCase() : undefined;
      if (franchise) {
        const displayTitle = getStackDisplayTitle(item).toLowerCase();
        const origTitle = ((media as any)?.title || (media as any)?.name || '').toLowerCase();
        const score = Math.max(getScore(displayTitle), getScore(origTitle));
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
    const isPackA = !!(itemA as any).__isMultipackStack;
    const isPackB = !!(itemB as any).__isMultipackStack;

    if (searchQuery && sortBy === 'recent') {
      const titleA = getStackDisplayTitle(itemA).toLowerCase();
      const titleB = getStackDisplayTitle(itemB).toLowerCase();
      const origTitleA = ((mediaA as any)?.title || (mediaA as any)?.name || '').toLowerCase();
      const origTitleB = ((mediaB as any)?.title || (mediaB as any)?.name || '').toLowerCase();
      
      // 1. If Franchise Sort is on and they are in the same franchise, franchise order ALWAYS wins
      if (useFranchiseSort && !isPackA && !isPackB) {
        const franchiseA = itemA.franchise?.trim();
        const franchiseB = itemB.franchise?.trim();
        if (franchiseA && franchiseB && franchiseA.toLowerCase() === franchiseB.toLowerCase()) {
          const orderA = itemA.franchise_order !== null && itemA.franchise_order !== undefined ? Number(itemA.franchise_order) : Infinity;
          const orderB = itemB.franchise_order !== null && itemB.franchise_order !== undefined ? Number(itemB.franchise_order) : Infinity;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
        }
      }

      // 2. Otherwise, use relevance score
      const q = searchQuery.toLowerCase().trim();

      const getScore = (title: string) => {
        if (!title) return 0;
        if (title === q) return 100;
        if (title.startsWith(q + ' ') || title.startsWith(q + ':')) return 80;
        if (title.includes(' ' + q + ' ') || title.includes(' ' + q)) return 60;
        if (title.includes(q)) return 40;
        return 0;
      };

      let scoreA = Math.max(getScore(titleA), getScore(origTitleA));
      let scoreB = Math.max(getScore(titleB), getScore(origTitleB));

      // If Franchise Sort is on, boost the item's score to its franchise's max score
      if (useFranchiseSort) {
        const franchiseA = !isPackA ? itemA.franchise?.trim()?.toLowerCase() : undefined;
        const franchiseB = !isPackB ? itemB.franchise?.trim()?.toLowerCase() : undefined;
        if (franchiseA) scoreA = Math.max(scoreA, franchiseMaxScores.get(franchiseA) || 0);
        if (franchiseB) scoreB = Math.max(scoreB, franchiseMaxScores.get(franchiseB) || 0);
      }

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // 3. If scores are tied and Franchise Sort is enabled, group items by franchise
      if (useFranchiseSort && !isPackA && !isPackB) {
        const franchiseA = itemA.franchise?.trim() || '';
        const franchiseB = itemB.franchise?.trim() || '';
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
        const rawTitleA = getStackDisplayTitle(itemA);
        const rawTitleB = getStackDisplayTitle(itemB);

        if (useFranchiseSort && !isPackA && !isPackB) {
          const franchiseA = itemA.franchise?.trim();
          const franchiseB = itemB.franchise?.trim();

          if (franchiseA && franchiseB) {
            if (franchiseA.toLowerCase() === franchiseB.toLowerCase()) {
              const orderA = itemA.franchise_order !== null && itemA.franchise_order !== undefined ? Number(itemA.franchise_order) : Infinity;
              const orderB = itemB.franchise_order !== null && itemB.franchise_order !== undefined ? Number(itemB.franchise_order) : Infinity;
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
          const titleAStr = getStackDisplayTitle(itemA);
          const titleBStr = getStackDisplayTitle(itemB);
          comparison = titleAStr.localeCompare(titleBStr);
        }
        break;
      case 'genre':
        const genreA = (itemA.movies?.genres?.[0]?.name ?? itemA.shows?.genres?.[0]?.name ?? 'ZZZ');
        const genreB = (itemB.movies?.genres?.[0]?.name ?? itemB.shows?.genres?.[0]?.name ?? 'ZZZ');
        comparison = genreA.localeCompare(genreB);
        if (comparison === 0) {
          const titleAStr = getStackDisplayTitle(itemA);
          const titleBStr = getStackDisplayTitle(itemB);
          comparison = titleAStr.localeCompare(titleBStr);
        }
        break;
      case 'value':
        const valA = itemA.value_estimate ?? -1;
        const valB = itemB.value_estimate ?? -1;
        comparison = valA - valB;
        if (comparison === 0) {
          const titleAStr = getStackDisplayTitle(itemA);
          const titleBStr = getStackDisplayTitle(itemB);
          comparison = titleAStr.localeCompare(titleBStr);
        }
        break;
      case 'recent':
      default:
        const latestA = Math.max(...a.map(i => new Date(i.created_at).getTime()));
        const latestB = Math.max(...b.map(i => new Date(i.created_at).getTime()));
        comparison = latestA - latestB;
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return stacks;
}
