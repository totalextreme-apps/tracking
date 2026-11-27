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

export function isSpecialSeason(seasonNumber: number | null | undefined): boolean {
  return seasonNumber !== null && seasonNumber !== undefined && seasonNumber <= 0;
}

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
  if (item.media_type === 'tv' && isSpecialSeason(item.season_number) && item.edition?.trim()) {
    return item.edition.trim();
  }
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

const fastCollator =
  typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'
    ? new Intl.Collator(undefined, { sensitivity: 'base' })
    : null;

export function fastCompareStrings(a: string, b: string): number {
  if (fastCollator) return fastCollator.compare(a, b);
  return a.localeCompare(b);
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

export interface IndexedCuratedStack {
  listName: string;
  items: CollectionItemWithMedia[];
  meta: CuratedStackMeta;
}

/**
 * Single-pass O(N) indexer for all Curated Stacks in a collection.
 * Replaces O(L * N) repeated filtering and metadata scanning when rendering Curated Stacks.
 */
export function buildCuratedStacksIndex(
  collection: CollectionItemWithMedia[] | undefined
): Map<string, IndexedCuratedStack> {
  const index = new Map<string, IndexedCuratedStack>();
  if (!collection || collection.length === 0) return index;

  for (let i = 0; i < collection.length; i++) {
    const item = collection[i];
    if (!item?.custom_lists) continue;
    for (let j = 0; j < item.custom_lists.length; j++) {
      const entry = item.custom_lists[j];
      if (!entry) continue;
      if (entry.startsWith(STACK_META_PREFIX)) {
        const rest = entry.slice(STACK_META_PREFIX.length);
        const colonIdx = rest.indexOf(':');
        if (colonIdx > 0) {
          const listName = rest.slice(0, colonIdx);
          const jsonStr = rest.slice(colonIdx + 1);
          try {
            const parsed = JSON.parse(jsonStr) as CuratedStackMeta;
            let bucket = index.get(listName);
            if (!bucket) {
              bucket = { listName, items: [], meta: parsed };
              index.set(listName, bucket);
            } else if ((parsed.updatedAt || 0) >= (bucket.meta.updatedAt || 0)) {
              bucket.meta = parsed;
            }
          } catch {
            // ignore malformed
          }
        }
      } else if (!isReservedListEntry(entry)) {
        let bucket = index.get(entry);
        if (!bucket) {
          bucket = { listName: entry, items: [], meta: {} };
          index.set(entry, bucket);
        }
        bucket.items.push(item);
      }
    }
  }

  return index;
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
  return Array.from(lists).sort(fastCompareStrings);
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

  // Group by Multi-pack compilation (if tagged as part of a multi-pack), or by movie_id/show_id (+ custom title override)
  const groups = new Map<string, CollectionItemWithMedia[]>();
  const multipackGroups = new Map<string, { title: string; items: CollectionItemWithMedia[] }>();

  for (const item of filtered) {
    const packName = includeMultipackStacks ? getItemMultipack(item) : null;
    if (packName) {
      const packKey = packName.toLowerCase();
      const existingPack = multipackGroups.get(packKey) ?? { title: packName, items: [] };
      existingPack.items.push(item);
      multipackGroups.set(packKey, existingPack);
      continue;
    }

    const media = item.movies || item.shows;
    const tmdbId = media?.tmdb_id;
    const customTitle = getItemCustomTitle(item)?.toLowerCase();
    const specialEditionFallback =
      !customTitle && item.media_type === 'tv' && isSpecialSeason(item.season_number) && item.edition?.trim()
        ? item.edition.trim().toLowerCase()
        : undefined;
    const effectiveCustomKey = customTitle || specialEditionFallback;
    let key: string;
    
    if (item.media_type === 'tv') {
      const showId = tmdbId || item.show_id || item.shows?.id || item.id;
      key = effectiveCustomKey ? `tv-${showId}-custom-${effectiveCustomKey}` : `tv-${showId}`;
    } else {
      const movieId = tmdbId || item.movie_id || item.movies?.id || item.id;
      key = effectiveCustomKey ? `movie-${movieId}-custom-${effectiveCustomKey}` : `movie-${movieId}`;
    }

    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }

  // Sort each stack by season number (asc) then format quality (highest first)
  const stacks: CollectionItemWithMedia[][] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      if (a.media_type === 'tv' && b.media_type === 'tv') {
        const seasonA = isSpecialSeason(a.season_number) ? 0 : (a.season_number ?? 1);
        const seasonB = isSpecialSeason(b.season_number) ? 0 : (b.season_number ?? 1);
        if (seasonA !== seasonB) {
          return seasonA - seasonB;
        }
      }
      return (FORMAT_ORDER[b.format] ?? 0) - (FORMAT_ORDER[a.format] ?? 0);
    });
    stacks.push(sorted);
  }

  // Add Multi-pack compilation stacks so items in a multi-pack stack physically on top of one another
  if (includeMultipackStacks) {
    const q = searchQuery ? searchQuery.toLowerCase().trim() : '';
    const getItemRelevance = (item: CollectionItemWithMedia) => {
      if (!q) return 0;
      const t = getItemDisplayTitle(item).toLowerCase();
      const media = item.movies || item.shows;
      const orig = ((media as any)?.title || (media as any)?.name || '').toLowerCase();
      const ed = (item.edition || '').toLowerCase();
      let s = 0;
      for (const candidate of [t, orig, ed]) {
        if (!candidate) continue;
        if (candidate === q) s = Math.max(s, 100);
        else if (candidate.startsWith(q + ' ') || candidate.startsWith(q + ':')) s = Math.max(s, 80);
        else if (candidate.includes(' ' + q + ' ') || candidate.includes(' ' + q)) s = Math.max(s, 60);
        else if (candidate.includes(q)) s = Math.max(s, 40);
      }
      return s;
    };

    for (const packGroup of multipackGroups.values()) {
      const sortedPackItems = [...packGroup.items].sort((a, b) => {
        if (q) {
          const relDiff = getItemRelevance(b) - getItemRelevance(a);
          if (relDiff !== 0) return relDiff;
        }
        const orderA = a.franchise_order !== null && a.franchise_order !== undefined ? Number(a.franchise_order) : Infinity;
        const orderB = b.franchise_order !== null && b.franchise_order !== undefined ? Number(b.franchise_order) : Infinity;
        if (!isNaN(orderA) && !isNaN(orderB) && orderA !== orderB) {
          return orderA - orderB;
        }
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

  // Precompute per-stack timestamps & franchise orders once before sorting (O(N) instead of O(N log N))
  const stackLatestTs = new WeakMap<CollectionItemWithMedia[], number>();
  const stackMinFranchiseOrder = new WeakMap<CollectionItemWithMedia[], number>();
  const stackDisplayTitles = new WeakMap<CollectionItemWithMedia[], string>();

  for (let i = 0; i < stacks.length; i++) {
    const s = stacks[i];
    let maxTs = 0;
    let minOrder = Infinity;
    for (let j = 0; j < s.length; j++) {
      const it = s[j];
      const ts = Date.parse(it.created_at);
      if (ts > maxTs) maxTs = ts;
      if (it.franchise_order !== null && it.franchise_order !== undefined) {
        const n = Number(it.franchise_order);
        if (!isNaN(n) && n < minOrder) minOrder = n;
      }
    }
    stackLatestTs.set(s, maxTs);
    stackMinFranchiseOrder.set(s, minOrder);
    stackDisplayTitles.set(s, getStackDisplayTitle(s[0]));
  }

  // Sort stacks
  stacks.sort((a, b) => {
    const itemA = a[0];
    const itemB = b[0];

    const isPackA = !!(itemA as any).__isMultipackStack;
    const isPackB = !!(itemB as any).__isMultipackStack;

    if (searchQuery && sortBy === 'recent') {
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

      const getStackMaxSearchScore = (stack: CollectionItemWithMedia[]) => {
        let max = getScore((stackDisplayTitles.get(stack) || '').toLowerCase());
        for (const it of stack) {
          const m = it.movies || it.shows;
          const dTitle = getItemDisplayTitle(it).toLowerCase();
          const oTitle = ((m as any)?.title || (m as any)?.name || '').toLowerCase();
          const ed = (it.edition || '').toLowerCase();
          max = Math.max(max, getScore(dTitle), getScore(oTitle), getScore(ed));
        }
        return max;
      };

      let scoreA = getStackMaxSearchScore(a);
      let scoreB = getStackMaxSearchScore(b);

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
          return fastCompareStrings(franchiseA, franchiseB);
        }
      }
    }

    let comparison = 0;

    switch (sortBy) {
      case 'title':
        const rawTitleA = stackDisplayTitles.get(a) ?? getStackDisplayTitle(itemA);
        const rawTitleB = stackDisplayTitles.get(b) ?? getStackDisplayTitle(itemB);

        if (useFranchiseSort) {
          const franchiseA = isPackA ? (a.find((i) => i.franchise?.trim())?.franchise?.trim()) : itemA.franchise?.trim();
          const franchiseB = isPackB ? (b.find((i) => i.franchise?.trim())?.franchise?.trim()) : itemB.franchise?.trim();

          if (franchiseA && franchiseB) {
            if (franchiseA.toLowerCase() === franchiseB.toLowerCase()) {
              const orderA = stackMinFranchiseOrder.get(a) ?? Infinity;
              const orderB = stackMinFranchiseOrder.get(b) ?? Infinity;
              if (orderA !== orderB) {
                comparison = orderA - orderB;
              } else {
                comparison = fastCompareStrings(rawTitleA, rawTitleB);
              }
            } else {
              comparison = fastCompareStrings(franchiseA, franchiseB);
            }
          } else if (franchiseA) {
            comparison = fastCompareStrings(franchiseA, rawTitleB);
          } else if (franchiseB) {
            comparison = fastCompareStrings(rawTitleA, franchiseB);
          } else {
            comparison = fastCompareStrings(rawTitleA, rawTitleB);
          }
        } else {
          comparison = fastCompareStrings(rawTitleA, rawTitleB);
        }

        // If titles are same, sort by season
        if (comparison === 0 && itemA.show_id === itemB.show_id) {
          comparison = (itemA.season_number ?? 0) - (itemB.season_number ?? 0);
        }
        break;
      case 'release':
        const dateA = itemA.movies?.release_date ?? itemA.shows?.first_air_date ?? '';
        const dateB = itemB.movies?.release_date ?? itemB.shows?.first_air_date ?? '';
        comparison = dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
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
          const titleAStr = stackDisplayTitles.get(a) ?? getStackDisplayTitle(itemA);
          const titleBStr = stackDisplayTitles.get(b) ?? getStackDisplayTitle(itemB);
          comparison = fastCompareStrings(titleAStr, titleBStr);
        }
        break;
      case 'genre':
        const genreA = (itemA.movies?.genres?.[0]?.name ?? itemA.shows?.genres?.[0]?.name ?? 'ZZZ');
        const genreB = (itemB.movies?.genres?.[0]?.name ?? itemB.shows?.genres?.[0]?.name ?? 'ZZZ');
        comparison = fastCompareStrings(genreA, genreB);
        if (comparison === 0) {
          const titleAStr = stackDisplayTitles.get(a) ?? getStackDisplayTitle(itemA);
          const titleBStr = stackDisplayTitles.get(b) ?? getStackDisplayTitle(itemB);
          comparison = fastCompareStrings(titleAStr, titleBStr);
        }
        break;
      case 'value':
        const valA = itemA.value_estimate ?? -1;
        const valB = itemB.value_estimate ?? -1;
        comparison = valA - valB;
        if (comparison === 0) {
          const titleAStr = stackDisplayTitles.get(a) ?? getStackDisplayTitle(itemA);
          const titleBStr = stackDisplayTitles.get(b) ?? getStackDisplayTitle(itemB);
          comparison = fastCompareStrings(titleAStr, titleBStr);
        }
        break;
      case 'recent':
      default:
        const latestA = stackLatestTs.get(a) ?? 0;
        const latestB = stackLatestTs.get(b) ?? 0;
        comparison = latestA - latestB;
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return stacks;
}
