import { ScrambledChannel } from '@/components/ScrambledChannel';
import { TrackingLoader } from '@/components/TrackingLoader';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { EmptyState } from '@/components/EmptyState';
import { OnDisplayCard } from '@/components/OnDisplayCard';
import { ReorderShelfModal } from '@/components/ReorderShelfModal';
import { QuickActionModal } from '@/components/QuickActionModal';
import { MultipackModal } from '@/components/MultipackModal';
import { StackCard } from '@/components/StackCard';
import { RouletteModal } from '@/components/RouletteModal';
import { ShareModal } from '@/components/ShareModal';
import { WatchLogModal } from '@/components/WatchLogModal';
import { TipsAndTricksModal } from '@/components/TipsAndTricksModal';
import { DesktopContainer } from '@/components/DesktopContainer';
import { useResponsiveColumns } from '@/hooks/useResponsiveColumns';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { useCollection, useHydrateCollectionCast, useUpdateCollectionItem } from '@/hooks/useCollection';
import { usePersistedState } from '@/hooks/usePersistedState';
import { getGenres, getOnDisplayItems, getGrailItems, getStacks, getItemCustomTitle, getItemDisplayTitle, getItemMultipack, getStackDisplayTitle } from '@/lib/collection-utils';
import type { CollectionItemWithMedia } from '@/types/database';
import { getBackdropUrl, getPosterUrl } from '@/lib/dummy-data';
import { supabase } from '@/lib/supabase';
import { searchMedia, getPersonMovieCredits, getPersonTvCredits, searchPerson } from '@/lib/tmdb';
import { useQueryClient } from '@tanstack/react-query';


function getRelativeTimeString(dateString?: string | null): string {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  
  if (isNaN(diffMs)) return '';

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${Math.max(1, diffMins)}m AGO`;
  }
  if (diffHours < 24) {
    return `${diffHours}h AGO`;
  }
  if (diffDays === 1) {
    return 'YESTERDAY';
  }
  if (diffDays < 7) {
    return `${diffDays}d AGO`;
  }
  
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

function RecentlyWatchedCard({ item, navigateToDetail, playSound, onLongPressAction }: {
  item: CollectionItemWithMedia;
  navigateToDetail: (item: CollectionItemWithMedia) => void;
  playSound: any;
  onLongPressAction: () => void;
}) {
  const media = item.movies || item.shows;
  if (!media) return null;

  const title = getItemDisplayTitle(item) || (item.media_type === 'movie' ? (media as any).title : (media as any).name);
  const tmdbBackdrop = getBackdropUrl(media.backdrop_path, 'w300');
  const backdropUrl = item.custom_backdrop_url || tmdbBackdrop || item.custom_poster_url || getPosterUrl(media.poster_path, 'w185');
  const format = item.format;
  const rating = item.rating;
  const watchCount = item.watch_count ?? 0;
  const lastWatchedStr = getRelativeTimeString(item.last_watched_at);

  const formatColors: Record<string, { bg: string, text: string, border: string }> = {
    'VHS': { bg: 'bg-red-950/80', text: 'text-red-400', border: 'border-red-500/30' },
    'DVD': { bg: 'bg-purple-950/80', text: 'text-purple-400', border: 'border-purple-500/30' },
    'BluRay': { bg: 'bg-blue-950/80', text: 'text-blue-400', border: 'border-blue-500/30' },
    '4K': { bg: 'bg-yellow-950/80', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    'Digital': { bg: 'bg-green-950/80', text: 'text-green-400', border: 'border-green-500/30' },
  };

  const colors = formatColors[format] || { bg: 'bg-neutral-900', text: 'text-neutral-400', border: 'border-neutral-800' };

  return (
    <Pressable
      onPress={() => {
        playSound('click');
        navigateToDetail(item);
      }}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        onLongPressAction();
      }}
      className="mr-4 w-72 h-[100px] flex-row bg-neutral-900 rounded-xl border border-neutral-800/80 overflow-hidden active:border-emerald-500/50 shadow-md shadow-black"
    >
      {/* Backdrop Section (Left) */}
      <View className="w-28 h-full bg-neutral-950 relative justify-center items-center">
        {backdropUrl ? (
          <Image
            source={{ uri: backdropUrl }}
            style={{ width: '100%', height: '100%', opacity: 0.85 }}
            contentFit="cover"
            contentPosition="top center"
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-neutral-800 w-full h-full">
            <Ionicons name="film-outline" size={20} color="#525252" />
          </View>
        )}

        {/* Vintage OSD Play Badge */}
        <View className="absolute top-2 left-2 bg-black/60 px-1.5 py-0.5 rounded flex-row items-center gap-1 border border-emerald-500/30">
          <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <Text className="text-[7px] text-emerald-400 font-mono font-bold tracking-wider">PLAY</Text>
        </View>

        {/* Format Badge Overlay bottom right of image */}
        <View className={`absolute bottom-2 right-2 px-1.5 py-0.5 rounded border ${colors.bg} ${colors.border}`}>
          <Text className={`text-[7px] font-mono font-bold ${colors.text}`}>{format === 'BluRay' ? 'Blu-ray' : format}</Text>
        </View>
      </View>

      {/* Info Section (Right) */}
      <View className="flex-1 p-2.5 justify-between">
        <View>
          <Text className="text-white font-mono text-xs font-bold leading-tight" numberOfLines={2}>
            {title.toUpperCase()}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-1">
            <Ionicons name="time-outline" size={10} color="#10b981" />
            <Text className="text-emerald-400 font-mono text-[9px] font-semibold">{lastWatchedStr}</Text>
          </View>
        </View>

        {/* Bottom stats: Stars and Tape counter */}
        <View className="flex-row items-center justify-between border-t border-neutral-800/60 pt-1.5">
          {/* Rating */}
          <View className="flex-row gap-0.5">
            {[...Array(5)].map((_, i) => (
              <FontAwesome
                key={i}
                name={i < (rating || 0) ? 'star' : 'star-o'}
                size={8}
                color={i < (rating || 0) ? '#f59e0b' : '#404040'}
              />
            ))}
          </View>

          {/* Tape watch counter */}
          <View className="flex-row items-center gap-1 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
            <Text className="text-neutral-500 font-mono text-[7px] font-bold">CNT</Text>
            <Text className="text-emerald-500 font-mono text-[8px] font-bold">{String(watchCount).padStart(3, '0')}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { userId, session, isLoading: authLoading, authPhase, showCaptcha, onCaptchaSuccess } = useAuth();
  const isGuest = !userId || session?.user?.is_anonymous;
  const { thriftMode, setThriftMode } = useThriftMode();
  const { playSound } = useSound();
  const params = useLocalSearchParams<{ actor?: string; director?: string; personId?: string }>();

  const { data: collection, isLoading: collectionLoading, isError: collectionError, refetch } = useCollection(userId) as any;
  const updateMutation = useUpdateCollectionItem(userId);
  const [quickActionItem, setQuickActionItem] = useState<CollectionItemWithMedia | null>(null);

  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'release' | 'rating' | 'value'>('recent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [useFranchiseSort, setUseFranchiseSort] = useState(true);
  const { numColumns: responsiveWebCols, isDesktop: isDesktopWeb } = useResponsiveColumns(2);
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && windowWidth > 1024;
  const [viewMode, setViewMode] = usePersistedState<'list' | 'grid2' | 'grid4' | 'custom'>('stacks_viewMode', isDesktop ? 'grid4' : 'grid2');
  const [numColumns, setNumColumns, columnsHydrated] = usePersistedState<number>('stacks_numColumns', isDesktop ? 4 : 2);
  const [isSliderLocked, setIsSliderLocked] = usePersistedState<boolean>('slider_locked', false);

  const resolvedColumns = viewMode === 'list'
    ? 1
    : viewMode === 'custom'
      ? numColumns
      : viewMode === 'grid2'
        ? 2
        : viewMode === 'grid4'
          ? 4
          : (isDesktopWeb ? responsiveWebCols : 2);
  const CARD_GAP = 24;
  const effectiveContainerWidth = Platform.OS === 'web' && windowWidth >= 768
    ? Math.min(windowWidth - 48, 1336)
    : (windowWidth - 32);

  const getCardWidth = (cols: number, containerWidth: number) => {
    const rawWidth = Math.floor((containerWidth - (cols * CARD_GAP)) / cols);
    if (Platform.OS === 'web' && windowWidth >= 768) {
      if (cols === 2) return Math.min(rawWidth, 420);
      if (cols === 3) return Math.min(rawWidth, 310);
      if (cols === 4) return Math.min(rawWidth, 240);
      if (cols === 5) return Math.min(rawWidth, 200);
    }
    return rawWidth;
  };

  const calculatedCardWidth = getCardWidth(resolvedColumns, effectiveContainerWidth);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'title' | 'actor' | 'director'>('title');
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [creditTmdbIds, setCreditTmdbIds] = useState<Set<string> | null>(null);
  const [isSearchingCredits, setIsSearchingCredits] = useState(false);
  const mainScrollRef = useRef<ScrollView>(null);
  const [stacksSectionY, setStacksSectionY] = useState<number>(0);

  useEffect(() => {
    const incomingActor = typeof params.actor === 'string' && params.actor.trim() ? params.actor.trim() : null;
    const incomingDirector = typeof params.director === 'string' && params.director.trim() ? params.director.trim() : null;
    const incomingPersonId = typeof params.personId === 'string' && /^\d+$/.test(params.personId) ? parseInt(params.personId, 10) : null;

    if (incomingActor || incomingDirector) {
      if (thriftMode) setThriftMode(false);
      setFormatFilter(null);
      setGenreFilter(null);
      setMediaTypeFilter(null);
      setHasEditionFilter(false);
      setMultipackFilter(false);
      setSearchMode(incomingDirector ? 'director' : 'actor');
      setSearchQuery(incomingDirector || incomingActor || '');
      setSelectedPersonId(incomingPersonId);
      setTimeout(() => {
        if (mainScrollRef.current && stacksSectionY > 0) {
          mainScrollRef.current.scrollTo({ y: Math.max(0, stacksSectionY - 16), animated: true });
        }
      }, 150);
    }
  }, [params.actor, params.director, params.personId]);

  useEffect(() => {
    if (searchQuery.trim().length < 2 || searchMode === 'title') {
      setCreditTmdbIds(null);
      return;
    }

    const delay = selectedPersonId ? 0 : 400;
    const timer = setTimeout(async () => {
      setIsSearchingCredits(true);
      try {
        let personId = selectedPersonId;
        if (!personId) {
          const personRes = await searchPerson(searchQuery, 1);
          const person = personRes.results?.[0];
          personId = person?.id ?? null;
        }
        if (personId) {
          const [movieCredits, tvCredits] = await Promise.all([
            getPersonMovieCredits(personId),
            getPersonTvCredits(personId),
          ]);

          const ids = new Set<string>();
          if (searchMode === 'actor') {
            if (movieCredits.cast) {
              movieCredits.cast.forEach((c: any) => ids.add(`movie-${c.id}`));
            }
            if (tvCredits.cast) {
              tvCredits.cast.forEach((c: any) => ids.add(`tv-${c.id}`));
            }
          } else if (searchMode === 'director') {
            if (movieCredits.crew) {
              movieCredits.crew.forEach((c: any) => {
                if (c.job === 'Director') ids.add(`movie-${c.id}`);
              });
            }
            if (tvCredits.crew) {
              tvCredits.crew.forEach((c: any) => {
                if (c.job === 'Director') ids.add(`tv-${c.id}`);
              });
            }
          }
          setCreditTmdbIds(ids);
        } else {
          setCreditTmdbIds(new Set<string>());
        }
      } catch (e) {
        console.error('Failed to resolve credits:', e);
        setCreditTmdbIds(new Set());
      } finally {
        setIsSearchingCredits(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [searchQuery, searchMode, selectedPersonId]);

  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'movie' | 'tv' | null>(null);
  const [hasEditionFilter, setHasEditionFilter] = useState(false);
  const [multipackFilter, setMultipackFilter] = useState(false);
  const [activeMultipackName, setActiveMultipackName] = useState<string | null>(null);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50);

  useEffect(() => {
    setDisplayLimit(50);
  }, [searchQuery, formatFilter, genreFilter, mediaTypeFilter, hasEditionFilter, multipackFilter, sortBy, sortOrder, thriftMode]);
  
  const shelfRef = useRef<ScrollView>(null);
  const grailRef = useRef<ScrollView>(null);
  const recentlyWatchedRef = useRef<ScrollView>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [showRewind, setShowRewind] = useState(false);
  const [reorderModalVisible, setReorderModalVisible] = useState(false);
  const [reorderType, setReorderType] = useState<'display' | 'grail'>('display');
  const [showRouletteModal, setShowRouletteModal] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const [shareLinkMessage, setShareLinkMessage] = useState('');
  const [shareTextMessage, setShareTextMessage] = useState('');
  const [showWatchLogModal, setShowWatchLogModal] = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [tipsBannerDismissed, setTipsBannerDismissed] = usePersistedState<boolean>('tips_banner_dismissed', false);
  const { onboardingKey } = useSettings();

  useEffect(() => {
    if (onboardingKey > 0) {
      setTipsBannerDismissed(false);
    }
  }, [onboardingKey]);

  // Lazy-hydrate cast metadata only when Actor or Director search mode is active
  useHydrateCollectionCast(
    userId,
    collection,
    searchMode !== 'title' && searchQuery.trim().length >= 2
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setShowRewind(true);
    playSound('rewind');
    setTimeout(() => {
      if (refetch) refetch();
      setShowRewind(false);
      setRefreshing(false);
    }, 1500);
  };

  const scrollShelfRight = () => {
    if (shelfRef.current) {
      playSound('click');
      if (Platform.OS === 'web') (shelfRef.current as any).scrollTo({ x: (shelfRef.current as any).scrollLeft + 400, animated: true });
      else shelfRef.current.scrollTo({ x: 500, animated: true });
    }
  };

  const scrollShelfLeft = () => {
    if (shelfRef.current) {
      playSound('click');
      if (Platform.OS === 'web') (shelfRef.current as any).scrollTo({ x: (shelfRef.current as any).scrollLeft - 400, animated: true });
      else shelfRef.current.scrollTo({ x: 0, animated: true });
    }
  };

  const scrollGrailRight = () => {
    if (grailRef.current) {
      playSound('click');
      if (Platform.OS === 'web') (grailRef.current as any).scrollTo({ x: (grailRef.current as any).scrollLeft + 400, animated: true });
      else grailRef.current.scrollTo({ x: 500, animated: true });
    }
  };

  const scrollGrailLeft = () => {
    if (grailRef.current) {
      playSound('click');
      if (Platform.OS === 'web') (grailRef.current as any).scrollTo({ x: (grailRef.current as any).scrollLeft - 400, animated: true });
      else grailRef.current.scrollTo({ x: 0, animated: true });
    }
  };

  const scrollRecentlyWatchedRight = () => {
    if (recentlyWatchedRef.current) {
      playSound('click');
      if (Platform.OS === 'web') (recentlyWatchedRef.current as any).scrollTo({ x: (recentlyWatchedRef.current as any).scrollLeft + 400, animated: true });
      else recentlyWatchedRef.current.scrollTo({ x: 500, animated: true });
    }
  };

  const scrollRecentlyWatchedLeft = () => {
    if (recentlyWatchedRef.current) {
      playSound('click');
      if (Platform.OS === 'web') (recentlyWatchedRef.current as any).scrollTo({ x: (recentlyWatchedRef.current as any).scrollLeft - 400, animated: true });
      else recentlyWatchedRef.current.scrollTo({ x: 0, animated: true });
    }
  };

  const toggleFavorite = async (item: CollectionItemWithMedia) => {
    try {
      const isWishlist = item.status === 'wishlist';
      const updates = isWishlist ? { is_grail: !item.is_grail } : { is_on_display: !item.is_on_display };
      await updateMutation.mutateAsync({ itemId: item.id, updates });
    } catch (e) {
      console.error('Failed to toggle status', e);
    }
  };

  const handleGridRate = async (item: CollectionItemWithMedia, rating: number) => {
    if (!item || !collection) return;
    playSound('click');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const isMovie = item.media_type === 'movie';
      const relatedItems = collection.filter((i: any) => {
        if (isMovie) return i.movie_id === item.movie_id;
        return i.show_id === item.show_id && i.season_number === item.season_number;
      });
      const relatedIds = relatedItems.map((i: any) => i.id);
      if (relatedIds.length > 0) {
        await updateMutation.mutateAsync({ itemIds: relatedIds, updates: { rating } });
      }
    } catch (e) {
      console.error('Failed to save rating', e);
    }
  };

  const navigateToDetail = (item: CollectionItemWithMedia) => {
    if (item.media_type === 'tv') {
      const showId = item.show_id || item.shows?.id;
      if (showId) router.push({ pathname: "/show/[id]", params: { id: showId, season: item.season_number ?? 1, itemId: item.id } } as any);
    } else {
      const movieId = item.movie_id || item.movies?.id;
      if (movieId) router.push({ pathname: "/movie/[id]", params: { id: movieId, itemId: item.id } } as any);
    }
  };

  const genres = getGenres(collection);

  const filteredCollection = useMemo(() => {
    if (!collection) return [];
    let items = collection.filter((i: any) => thriftMode ? i.status === 'wishlist' : i.status === 'owned');

    if (formatFilter && formatFilter !== 'ALL') {
      items = items.filter((item: any) => {
        if (formatFilter === 'BOOTLEG') return item.is_bootleg;
        if (formatFilter === 'FOR SALE') return item.for_sale;
        if (formatFilter === 'FOR TRADE') return item.for_trade;
        if (formatFilter === 'MULTI-PACK') return !!getItemMultipack(item);
        if (formatFilter === 'HAS EDITION') return !!(item.edition && item.edition.trim().length > 0);
        return item.format === formatFilter;
      });
    }

    if (hasEditionFilter) {
      items = items.filter((item: any) => !!(item.edition && item.edition.trim().length > 0));
    }

    if (multipackFilter) {
      items = items.filter((item: any) => !!getItemMultipack(item));
    }

    if (searchQuery) {
      if (searchMode === 'actor' || searchMode === 'director') {
        const qLower = searchQuery.toLowerCase().trim();
        items = items.filter((item: any) => {
          const m = item.movies || item.shows;
          if (!m) return false;
          const type = item.movies ? 'movie' : 'tv';
          if (creditTmdbIds && m.tmdb_id && creditTmdbIds.has(`${type}-${m.tmdb_id}`)) {
            return true;
          }
          const castList = (m as any).movie_cast || (m as any).show_cast;
          if (Array.isArray(castList)) {
            return castList.some((c: any) => {
              if (!c?.name) return false;
              const isDirectorEntry = (c.character || '').toLowerCase() === 'director';
              if (searchMode === 'director' && !isDirectorEntry) return false;
              if (searchMode === 'actor' && isDirectorEntry) return false;
              if (selectedPersonId && c.id === selectedPersonId) return true;
              return c.name.toLowerCase().includes(qLower);
            });
          }
          return false;
        });
      } else {
        const noiseWords = new Set(['remake', 'original', 'reboot', 'sequel', 'tv', 'show', 'series', 'film']);
        const tokens = searchQuery
          .toLowerCase()
          .replace(/['’]/g, '')
          .split(/[\s,()\-:;!?"\[\]\/]+/)
          .map(t => t.trim())
          .filter(t => t.length > 0 && !noiseWords.has(t));

        if (tokens.length > 0) {
          items = items.filter((item: any) => {
            const m = item.movies || item.shows;
            if (!m) return false;

            const title = (m.title || m.name || '').toLowerCase();
            const customTitle = (getItemCustomTitle(item) || '').toLowerCase();
            const multipack = (getItemMultipack(item) || '').toLowerCase();
            const year = (m.release_date || m.first_air_date || '').slice(0, 4);
            const format = (item.format || '').toLowerCase();
            const edition = (item.edition || '').toLowerCase();
            const notes = (item.notes || '').toLowerCase();
            const franchise = (item.franchise || '').toLowerCase();
            const tags = (m.sorting_tags || '').toLowerCase();
            
            const searchableTexts: string[] = [title, customTitle, multipack, year, format, edition, notes, franchise, tags];
            
            if (m.genres && Array.isArray(m.genres)) {
              m.genres.forEach((g: any) => {
                if (g?.name) searchableTexts.push(g.name.toLowerCase());
              });
            }

            return tokens.every(token => 
              searchableTexts.some(text => {
                const words = text
                  .replace(/['’]/g, '')
                  .split(/[\s,().:;!?"\[\]\/]+/);
                return words.some(word => word.startsWith(token));
              })
            );
          });
        }
      }
    }

    if (genreFilter) items = items.filter((item: any) => (item.movies || item.shows)?.genres?.some((g: any) => g?.name === genreFilter));
    if (mediaTypeFilter) items = items.filter((item: any) => item.media_type === mediaTypeFilter);

    // If any item in a Multi-pack matched the search/filter, include all sibling items from that Multi-pack so the stack stays complete
    if (items.length > 0 && collection) {
      const matchedPackKeys = new Set<string>();
      for (const item of items) {
        const pack = getItemMultipack(item);
        if (pack) matchedPackKeys.add(pack.toLowerCase());
      }
      if (matchedPackKeys.size > 0) {
        const includedIds = new Set(items.map((i: any) => i.id));
        const siblings = collection.filter((i: any) => {
          if (includedIds.has(i.id)) return false;
          if ((thriftMode ? i.status === 'wishlist' : i.status === 'owned') === false) return false;
          const pack = getItemMultipack(i);
          return !!(pack && matchedPackKeys.has(pack.toLowerCase()));
        });
        if (siblings.length > 0) {
          items = [...items, ...siblings];
        }
      }
    }

    return items;
  }, [collection, thriftMode, formatFilter, hasEditionFilter, multipackFilter, searchQuery, genreFilter, mediaTypeFilter, searchMode, creditTmdbIds, selectedPersonId]);

  const queryClient = useQueryClient();
  const [inlineShelfReorder, setInlineShelfReorder] = useState<'display' | 'grail' | null>(null);
  const [shelfDrag, setShelfDrag] = useState<{
    type: 'display' | 'grail';
    activeId: string;
    startIndex: number;
    currentIndex: number;
    dx: number;
  } | null>(null);

  const shelfDragRef = useRef<{
    type: 'display' | 'grail';
    activeId: string;
    startIndex: number;
    currentIndex: number;
    startX: number;
    hasMoved: boolean;
    snapshot: any[];
  } | null>(null);

  const filteredStacks = useMemo(() => {
    return getStacks(filteredCollection, thriftMode, sortBy, sortOrder, searchQuery, useFranchiseSort);
  }, [filteredCollection, thriftMode, sortBy, sortOrder, searchQuery, useFranchiseSort]);

  const baseOnDisplay = useMemo(() => {
    const raw = getOnDisplayItems(collection);
    if (!formatFilter || formatFilter === 'ALL') return raw;
    return raw.filter((item: any) => item.format === formatFilter);
  }, [collection, formatFilter]);

  const baseGrailList = useMemo(() => {
    const raw = getGrailItems(collection);
    if (!formatFilter || formatFilter === 'ALL') return raw;
    return raw.filter((item: any) => item.format === formatFilter);
  }, [collection, formatFilter]);

  const onDisplay = useMemo(() => {
    if (!shelfDrag || shelfDrag.type !== 'display') return baseOnDisplay;
    const { startIndex, currentIndex } = shelfDrag;
    if (startIndex === currentIndex || startIndex < 0 || currentIndex < 0 || startIndex >= baseOnDisplay.length || currentIndex >= baseOnDisplay.length) {
      return baseOnDisplay;
    }
    const copy = [...baseOnDisplay];
    const [moved] = copy.splice(startIndex, 1);
    copy.splice(currentIndex, 0, moved);
    return copy;
  }, [baseOnDisplay, shelfDrag]);

  const grailList = useMemo(() => {
    if (!shelfDrag || shelfDrag.type !== 'grail') return baseGrailList;
    const { startIndex, currentIndex } = shelfDrag;
    if (startIndex === currentIndex || startIndex < 0 || currentIndex < 0 || startIndex >= baseGrailList.length || currentIndex >= baseGrailList.length) {
      return baseGrailList;
    }
    const copy = [...baseGrailList];
    const [moved] = copy.splice(startIndex, 1);
    copy.splice(currentIndex, 0, moved);
    return copy;
  }, [baseGrailList, shelfDrag]);

  const commitShelfOrder = useCallback(async (type: 'display' | 'grail', reordered: any[]) => {
    if (!userId) return;
    const itemIds = reordered.map((i) => i.id);
    const orderField = type === 'display' ? 'display_order' : 'grail_order';
    const rankMap = new Map<string, number>();
    itemIds.forEach((id, idx) => rankMap.set(id, idx + 1));

    queryClient.setQueryData(['collection', userId], (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((item: any) => {
        if (!rankMap.has(item.id)) return item;
        return { ...item, [orderField]: rankMap.get(item.id) };
      });
    });

    playSound('click');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const { error } = await (supabase.rpc as any)('update_collection_order', {
        item_ids: itemIds,
        order_type: type,
      });
      if (error) throw error;
    } catch (err) {
      console.error('Failed to save shelf order:', err);
      queryClient.invalidateQueries({ queryKey: ['collection', userId] });
    }
  }, [userId, queryClient, playSound]);

  const updateShelfDrag = useCallback((clientX: number) => {
    const ref = shelfDragRef.current;
    if (!ref) return;
    const dx = clientX - ref.startX;
    if (!ref.hasMoved && Math.abs(dx) < 5) return;
    ref.hasMoved = true;

    const stepX = 164; // OnDisplayCard width (160) + horizontal margin (4)
    const nextIndex = Math.max(
      0,
      Math.min(ref.snapshot.length - 1, Math.round((ref.startIndex * stepX + dx) / stepX))
    );
    if (nextIndex !== ref.currentIndex) {
      ref.currentIndex = nextIndex;
      Haptics.selectionAsync();
    }
    setShelfDrag({
      type: ref.type,
      activeId: ref.activeId,
      startIndex: ref.startIndex,
      currentIndex: ref.currentIndex,
      dx,
    });
  }, []);

  const finishShelfDrag = useCallback(() => {
    const ref = shelfDragRef.current;
    if (!ref) return;
    shelfDragRef.current = null;
    setShelfDrag(null);
    if (ref.hasMoved && ref.currentIndex !== ref.startIndex) {
      const copy = [...ref.snapshot];
      const [moved] = copy.splice(ref.startIndex, 1);
      copy.splice(ref.currentIndex, 0, moved);
      commitShelfOrder(ref.type, copy);
    }
  }, [commitShelfOrder]);

  const beginShelfDrag = useCallback((clientX: number, type: 'display' | 'grail', id: string, index: number, immediate = false) => {
    const snapshot = type === 'display' ? baseOnDisplay : baseGrailList;
    shelfDragRef.current = {
      type,
      activeId: id,
      startIndex: index,
      currentIndex: index,
      startX: clientX,
      hasMoved: immediate,
      snapshot,
    };
    if (immediate) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShelfDrag({ type, activeId: id, startIndex: index, currentIndex: index, dx: 0 });
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onMouseMove = (ev: MouseEvent) => {
        if (shelfDragRef.current?.hasMoved) ev.preventDefault();
        updateShelfDrag(ev.clientX);
      };
      const onTouchMove = (ev: TouchEvent) => {
        if (!shelfDragRef.current) return;
        const t = ev.touches[0];
        if (!t) return;
        if (ev.cancelable) ev.preventDefault();
        updateShelfDrag(t.clientX);
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onUp);
        window.removeEventListener('touchcancel', onUp);
        finishShelfDrag();
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onUp);
      window.addEventListener('touchcancel', onUp);
    }
  }, [baseOnDisplay, baseGrailList, updateShelfDrag, finishShelfDrag]);

  const makeShelfDragProps = useCallback(
    (type: 'display' | 'grail', id: string, idx: number, stopProp = false) => {
      if (Platform.OS === 'web') {
        return {
          onMouseDown: (e: any) => {
            if (stopProp) e.stopPropagation();
            if (e.button !== undefined && e.button !== 0) return;
            beginShelfDrag(e.clientX, type, id, idx, false);
          },
          onTouchStart: (e: any) => {
            if (stopProp) e.stopPropagation();
            const t = e.nativeEvent?.touches?.[0] || e.touches?.[0] || e.nativeEvent;
            const cx = t?.clientX ?? t?.pageX ?? 0;
            beginShelfDrag(cx, type, id, idx, true);
          },
          onDragStart: (e: any) => e.preventDefault(),
        } as any;
      }
      return {
        onTouchStart: (e: any) => {
          if (stopProp) e.stopPropagation();
          beginShelfDrag(e.nativeEvent.pageX, type, id, idx, true);
        },
        onTouchMove: (e: any) => {
          if (stopProp) e.stopPropagation();
          updateShelfDrag(e.nativeEvent.pageX);
        },
        onTouchEnd: (e: any) => {
          if (stopProp) e.stopPropagation();
          finishShelfDrag();
        },
        onTouchCancel: () => finishShelfDrag(),
      };
    },
    [beginShelfDrag, updateShelfDrag, finishShelfDrag]
  );

  const recentlyWatched = useMemo(() => {
    if (!collection) return [];
    const raw = collection
      .filter((i: any) => i.status === 'owned' && i.last_watched_at)
      .sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime())
      .slice(0, 10);
    if (!formatFilter || formatFilter === 'ALL') return raw;
    return raw.filter((item: any) => item.format === formatFilter);
  }, [collection, formatFilter]);

  const getFormatPillStyles = (fmt: string, isSelected: boolean) => {
    if (isSelected) return { container: 'bg-amber-500/20 border-amber-500/50', text: 'text-amber-500' };
    const baseText = 'text-neutral-300'; // CRISP READABLE TEXT
    if (fmt === 'VHS') return { container: 'bg-red-500/5 border-red-500/30', text: baseText };
    if (fmt === 'DVD') return { container: 'bg-purple-500/5 border-purple-500/30', text: baseText };
    if (fmt === 'BluRay') return { container: 'bg-blue-500/5 border-blue-500/30', text: baseText };
    if (fmt === '4K') return { container: 'bg-yellow-400/5 border-yellow-400/30', text: baseText };
    if (fmt === 'Digital') return { container: 'bg-green-500/5 border-green-500/30', text: baseText };
    if (fmt === 'MULTI-PACK') return { container: 'bg-amber-500/10 border-amber-500/40', text: baseText };
    if (fmt === 'HAS EDITION') return { container: 'bg-indigo-500/10 border-indigo-500/40', text: baseText };
    if (fmt === 'BOOTLEG') return { container: 'bg-orange-600/10 border-orange-600/40', text: baseText };
    if (fmt === 'FOR SALE') return { container: 'bg-red-600/10 border-red-600/40', text: baseText };
    if (fmt === 'FOR TRADE') return { container: 'bg-sky-600/10 border-sky-600/40', text: baseText };
    return { container: 'bg-neutral-900 border-neutral-800', text: baseText };
  };

  if (authPhase === 'checking' || authLoading) return <View className="flex-1 bg-black items-center justify-center"><TrackingLoader label="SYNCHRONIZING..." /></View>;

  return (
    <View className="flex-1 bg-neutral-950" style={thriftMode ? { backgroundColor: '#07140f' } : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

          <ScrollView
            ref={mainScrollRef}
            className="flex-1"
            scrollEnabled={shelfDrag === null}
            contentContainerStyle={{ paddingBottom: 160 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
          >
        <DesktopContainer>
          <View>
          {/* COMPACT NON-INTRUSIVE TIPS & TRICKS BANNER */}
          {!tipsBannerDismissed && (
            <View className="px-4 md:px-8 mt-3 max-w-7xl mx-auto w-full">
              <View className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex-row items-center justify-between">
                <Pressable
                  onPress={() => {
                    playSound('click');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowTipsModal(true);
                  }}
                  className="flex-row items-center gap-2 flex-1 pr-2 active:opacity-75"
                >
                  <View className="bg-amber-500/20 p-1.5 rounded-lg border border-amber-500/40">
                    <Ionicons name="bulb-outline" size={13} color="#f59e0b" />
                  </View>
                  <Text className="text-neutral-200 font-mono text-[10px] sm:text-xs flex-1 leading-4">
                    New to Tracking?{' '}
                    <Text className="text-amber-400 font-bold underline">
                      Check out some helpful tips &amp; tricks ›
                    </Text>
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    playSound('click');
                    setTipsBannerDismissed(true);
                  }}
                  hitSlop={8}
                  className="p-1 rounded-full bg-neutral-900/80 border border-neutral-800"
                >
                  <Ionicons name="close" size={12} color="#737373" />
                </Pressable>
              </View>
            </View>
          )}

          {/* ON DISPLAY SECTION (OWNED) - ONLY IN STACKS MODE */}
          {onDisplay.length > 0 && !thriftMode && (
            <View className="mb-8 mt-6">
              <View className="px-4 md:px-8 flex-row items-center justify-between mb-2 max-w-7xl mx-auto w-full gap-2 flex-wrap">
                <View className="flex-row items-baseline gap-2 flex-wrap flex-1 min-w-[200px]">
                  <Text className="text-amber-500 font-bold text-2xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>ON DISPLAY</Text>
                  <Text className="text-neutral-500 font-mono text-xs ml-1">/ {onDisplay.length}</Text>
                  <Pressable 
                    onPress={() => {
                      const itemsText = onDisplay.map((item: any, index: number) => {
                        const m = item.movies || item.shows;
                        return `${index + 1}. ${m?.title || m?.name} (${item.format})`;
                      }).join('\n');
                      const shareUrl = userId ? `https://mediatracking.app/profile/${userId}?tab=on-display` : '';
                      
                      if (!userId || isGuest) {
                        import('react-native').then(({ Share }) => {
                          Share.share({ message: `Check out what I have On Display:\n\n${itemsText}` });
                        });
                        return;
                      }

                      setShareTitle("Share On Display");
                      setShareLinkMessage(`Check out what I have On Display on Tracking!\n\n${shareUrl}`);
                      setShareTextMessage(`Check out what I have On Display:\n\n${itemsText}\n\nView here: ${shareUrl}`);
                      setShareModalVisible(true);
                      playSound('click');
                    }}
                    className="ml-2 flex-row items-center justify-center p-1.5 rounded-full bg-neutral-900 border border-neutral-800"
                  >
                    <Ionicons name="share-outline" size={14} color="#f59e0b" />
                  </Pressable>
                  {onDisplay.length > 1 && !isGuest && (
                    <View className="flex-row items-center gap-1.5 ml-2">
                      <Pressable 
                        onPress={() => {
                          playSound('click');
                          setInlineShelfReorder(prev => prev === 'display' ? null : 'display');
                        }}
                        className={`px-2 py-1 border rounded flex-row items-center ${inlineShelfReorder === 'display' ? 'bg-amber-500 border-amber-400' : 'bg-neutral-900 border-neutral-800'}`}
                      >
                        <Ionicons name="move" size={10} color={inlineShelfReorder === 'display' ? '#000' : '#f59e0b'} style={{ marginRight: 4 }} />
                        <Text className={`font-mono text-[10px] font-bold ${inlineShelfReorder === 'display' ? 'text-black' : 'text-amber-500'}`}>
                          {inlineShelfReorder === 'display' ? 'DONE DRAGGING' : 'DRAG SHELF'}
                        </Text>
                      </Pressable>
                      <Pressable 
                        onPress={() => { setReorderType('display'); setReorderModalVisible(true); }}
                        className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded flex-row items-center"
                      >
                        <Ionicons name="grid-outline" size={10} color="#f59e0b" style={{ marginRight: 4 }} />
                        <Text className="text-amber-500 font-mono text-[10px] font-bold">REORDER</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={scrollShelfLeft} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800"><Ionicons name="chevron-back" size={16} color="#f59e0b" /></Pressable>
                  <Pressable onPress={scrollShelfRight} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800"><Ionicons name="chevron-forward" size={16} color="#f59e0b" /></Pressable>
                </View>
              </View>
              <View className="relative">
                <Image source={require('@/assets/images/shelf_background.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.8 }} contentFit="cover" />
                <ScrollView ref={shelfRef} horizontal scrollEnabled={shelfDrag === null && inlineShelfReorder !== 'display'} showsHorizontalScrollIndicator={false} style={{ height: 366 }} contentContainerStyle={{ paddingLeft: 24, paddingRight: 40 }} className="py-12">
                  {onDisplay.map((item: any, idx: number) => {
                    const isDraggingThis = shelfDrag?.type === 'display' && shelfDrag.activeId === item.id;
                    const translateX = isDraggingThis && shelfDrag ? shelfDrag.dx - (idx - shelfDrag.startIndex) * 164 : 0;
                    const canDragWholeCard = inlineShelfReorder === 'display';

                    return (
                      <View
                        key={item.id}
                        {...(canDragWholeCard ? makeShelfDragProps('display', item.id, idx, false) : {})}
                        style={[
                          {
                            position: 'relative',
                            zIndex: isDraggingThis ? 999 : 1,
                            transform: isDraggingThis ? [{ translateX }, { scale: 1.05 }] : [],
                          },
                          canDragWholeCard && Platform.OS === 'web'
                            ? ({ touchAction: 'none', userSelect: 'none', cursor: isDraggingThis ? 'grabbing' : 'grab' } as any)
                            : null,
                        ]}
                      >
                        {!isGuest && onDisplay.length > 1 && (
                          <View
                            {...makeShelfDragProps('display', item.id, idx, true)}
                            style={[
                              {
                                position: 'absolute',
                                top: -8,
                                left: 10,
                                zIndex: 50,
                              },
                              Platform.OS === 'web'
                                ? ({ touchAction: 'none', userSelect: 'none', cursor: 'grab' } as any)
                                : null,
                            ]}
                          >
                            <View className="bg-amber-500 border-2 border-black px-2 py-0.5 rounded-md shadow flex-row items-center gap-1">
                              <Text className="text-black font-black text-[10px]" style={{ fontFamily: 'VCR_OSD_MONO' }}>
                                #{idx + 1}
                              </Text>
                              <Ionicons name="reorder-two" size={11} color="#000" />
                            </View>
                          </View>
                        )}
                        <OnDisplayCard
                          item={item}
                          onSingleTapAction={() => {
                            if (canDragWholeCard || isDraggingThis) return;
                            navigateToDetail(item);
                          }}
                          onLongPressAction={() => {
                            if (canDragWholeCard) return;
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                            setQuickActionItem(item);
                          }}
                          onToggleFavorite={toggleFavorite}
                          onRatePress={(rating) => handleGridRate(item, rating)}
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          {/* RECENTLY WATCHED SECTION (OWNED) - ONLY IN STACKS MODE */}
          {recentlyWatched.length > 0 && !thriftMode && (
            <View className="mb-8 mt-2">
              <View className="px-4 md:px-8 flex-row items-center justify-between mb-3 max-w-7xl mx-auto w-full gap-2 flex-wrap">
                <Pressable
                  onPress={() => {
                    playSound('click');
                    setShowWatchLogModal(true);
                  }}
                  className="flex-row items-center gap-2 flex-wrap flex-1 min-w-[200px] active:opacity-75"
                >
                  <Text className="text-emerald-500 font-bold text-2xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>RECENTLY WATCHED</Text>
                  <Text className="text-neutral-500 font-mono text-xs ml-0.5">/ {recentlyWatched.length}</Text>
                  <View className="bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30 flex-row items-center gap-1 ml-1">
                    <Ionicons name="list" size={10} color="#10b981" />
                    <Text className="text-emerald-400 font-mono text-[9px] font-bold uppercase">VIEW LOG ›</Text>
                  </View>
                </Pressable>
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={scrollRecentlyWatchedLeft} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800"><Ionicons name="chevron-back" size={16} color="#10b981" /></Pressable>
                  <Pressable onPress={scrollRecentlyWatchedRight} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800"><Ionicons name="chevron-forward" size={16} color="#10b981" /></Pressable>
                </View>
              </View>
              <View className="bg-neutral-900/30 border-y border-neutral-900/60 py-4 relative">
                <ScrollView ref={recentlyWatchedRef} horizontal showsHorizontalScrollIndicator={false} style={{ height: 148 }} contentContainerStyle={{ paddingLeft: 24, paddingRight: 40 }} className="py-2">
                  {recentlyWatched.map((item: any) => (
                    <RecentlyWatchedCard
                      key={item.id}
                      item={item}
                      navigateToDetail={navigateToDetail}
                      playSound={playSound}
                      onLongPressAction={() => setQuickActionItem(item)}
                    />
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {/* THE GRAILS SECTION (WISHLIST) - ONLY IN THRIFT MODE */}
          {grailList.length > 0 && thriftMode && (
            <View className="mb-8 mt-6">
              <View className="px-4 md:px-8 flex-row items-center justify-between mb-2 max-w-7xl mx-auto w-full gap-2 flex-wrap">
                <View className="flex-row items-baseline gap-2 flex-wrap flex-1 min-w-[200px]">
                  <Text className="text-amber-500 font-bold text-2xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>THE GRAILS</Text>
                  <Text className="text-neutral-500 font-mono text-xs ml-1">/ {grailList.length}</Text>
                  <Pressable 
                    onPress={() => {
                      const itemsText = grailList.map((item: any, index: number) => {
                        const m = item.movies || item.shows;
                        return `${index + 1}. ${m?.title || m?.name} (${item.format})`;
                      }).join('\n');
                      const shareUrl = userId ? `https://mediatracking.app/profile/${userId}?tab=grails` : '';

                      if (!userId || isGuest) {
                        import('react-native').then(({ Share }) => {
                          Share.share({ message: `Check out my Grails:\n\n${itemsText}` });
                        });
                        return;
                      }

                      setShareTitle("Share Grails");
                      setShareLinkMessage(`Check out my Grails on Tracking!\n\n${shareUrl}`);
                      setShareTextMessage(`Check out my Grails:\n\n${itemsText}\n\nView here: ${shareUrl}`);
                      setShareModalVisible(true);
                      playSound('click');
                    }}
                    className="ml-2 flex-row items-center justify-center p-1.5 rounded-full bg-neutral-900 border border-neutral-800"
                  >
                    <Ionicons name="share-outline" size={14} color="#f59e0b" />
                  </Pressable>
                  {grailList.length > 1 && !isGuest && (
                    <View className="flex-row items-center gap-1.5 ml-2">
                      <Pressable 
                        onPress={() => {
                          playSound('click');
                          setInlineShelfReorder(prev => prev === 'grail' ? null : 'grail');
                        }}
                        className={`px-2 py-1 border rounded flex-row items-center ${inlineShelfReorder === 'grail' ? 'bg-amber-500 border-amber-400' : 'bg-neutral-900 border-neutral-800'}`}
                      >
                        <Ionicons name="move" size={10} color={inlineShelfReorder === 'grail' ? '#000' : '#f59e0b'} style={{ marginRight: 4 }} />
                        <Text className={`font-mono text-[10px] font-bold ${inlineShelfReorder === 'grail' ? 'text-black' : 'text-amber-500'}`}>
                          {inlineShelfReorder === 'grail' ? 'DONE DRAGGING' : 'DRAG SHELF'}
                        </Text>
                      </Pressable>
                      <Pressable 
                        onPress={() => { setReorderType('grail'); setReorderModalVisible(true); }}
                        className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded flex-row items-center"
                      >
                        <Ionicons name="grid-outline" size={10} color="#f59e0b" style={{ marginRight: 4 }} />
                        <Text className="text-amber-500 font-mono text-[10px] font-bold">REORDER</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={scrollGrailLeft} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800"><Ionicons name="chevron-back" size={16} color="#f59e0b" /></Pressable>
                  <Pressable onPress={scrollGrailRight} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800"><Ionicons name="chevron-forward" size={16} color="#f59e0b" /></Pressable>
                </View>
              </View>
              <View className="relative">
                <Image source={require('@/assets/images/thrift_background.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.8 }} contentFit="cover" />
                <ScrollView ref={grailRef} horizontal scrollEnabled={shelfDrag === null && inlineShelfReorder !== 'grail'} showsHorizontalScrollIndicator={false} style={{ height: 366 }} contentContainerStyle={{ paddingLeft: 24, paddingRight: 40 }} className="py-12">
                  {grailList.map((item: any, idx: number) => {
                    const isDraggingThis = shelfDrag?.type === 'grail' && shelfDrag.activeId === item.id;
                    const translateX = isDraggingThis && shelfDrag ? shelfDrag.dx - (idx - shelfDrag.startIndex) * 164 : 0;
                    const canDragWholeCard = inlineShelfReorder === 'grail';

                    return (
                      <View
                        key={item.id}
                        {...(canDragWholeCard ? makeShelfDragProps('grail', item.id, idx, false) : {})}
                        style={[
                          {
                            position: 'relative',
                            zIndex: isDraggingThis ? 999 : 1,
                            transform: isDraggingThis ? [{ translateX }, { scale: 1.05 }] : [],
                          },
                          canDragWholeCard && Platform.OS === 'web'
                            ? ({ touchAction: 'none', userSelect: 'none', cursor: isDraggingThis ? 'grabbing' : 'grab' } as any)
                            : null,
                        ]}
                      >
                        {!isGuest && grailList.length > 1 && (
                          <View
                            {...makeShelfDragProps('grail', item.id, idx, true)}
                            style={[
                              {
                                position: 'absolute',
                                top: -8,
                                left: 10,
                                zIndex: 50,
                              },
                              Platform.OS === 'web'
                                ? ({ touchAction: 'none', userSelect: 'none', cursor: 'grab' } as any)
                                : null,
                            ]}
                          >
                            <View className="bg-amber-500 border-2 border-black px-2 py-0.5 rounded-md shadow flex-row items-center gap-1">
                              <Text className="text-black font-black text-[10px]" style={{ fontFamily: 'VCR_OSD_MONO' }}>
                                #{idx + 1}
                              </Text>
                              <Ionicons name="reorder-two" size={11} color="#000" />
                            </View>
                          </View>
                        )}
                        <OnDisplayCard
                          item={item}
                          onSingleTapAction={() => {
                            if (canDragWholeCard || isDraggingThis) return;
                            navigateToDetail(item);
                          }}
                          onLongPressAction={() => {
                            if (canDragWholeCard) return;
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                            setQuickActionItem(item);
                          }}
                          onToggleFavorite={toggleFavorite}
                          onRatePress={(rating) => handleGridRate(item, rating)}
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          <View
            className="px-4 md:px-8 pb-4 max-w-7xl mx-auto w-full"
            onLayout={(e) => {
              const y = e.nativeEvent.layout.y;
              setStacksSectionY(y);
              if ((params.actor || params.director) && mainScrollRef.current && y > 0) {
                mainScrollRef.current.scrollTo({ y: Math.max(0, y - 16), animated: true });
              }
            }}
          >
            <View className="flex-row items-center justify-between mb-6 flex-wrap gap-4">
              <View className="flex-row items-center gap-4 flex-wrap flex-1 min-w-[200px]">
                <View>
                  <Text className="text-amber-500 font-bold text-2xl md:text-3xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>
                    {thriftMode ? 'WISH LIST' : 'THE STACKS'}
                  </Text>
                  <View className="flex-row items-center mt-0.5">
                    <Text className="text-neutral-500 font-mono text-[10px]">{filteredStacks.length} STACKS</Text>
                    <Text className="text-neutral-600 font-mono text-[8px] ml-1">/ {filteredCollection.length} ITEMS</Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable 
                    onPress={() => {
                      const itemsText = filteredStacks.map((stack: any, index: number) => {
                        const item = stack[0];
                        const m = item.movies || item.shows;
                        return `${index + 1}. ${m?.title || m?.name} (${item.format})`;
                      }).join('\n');
                      const tabName = thriftMode ? 'wishlist' : 'collection';
                      const shareUrl = userId ? `https://mediatracking.app/profile/${userId}?tab=${tabName}` : '';

                      if (!userId || isGuest) {
                        import('react-native').then(({ Share }) => {
                          Share.share({ message: `Check out my ${thriftMode ? 'Wishlist' : 'Collection'}:\n\n${itemsText}` });
                        });
                        return;
                      }

                      setShareTitle(`Share ${thriftMode ? 'Wishlist' : 'Collection'}`);
                      setShareLinkMessage(`Check out my ${thriftMode ? 'Wishlist' : 'Collection'} on Tracking!\n\n${shareUrl}`);
                      setShareTextMessage(`Check out my ${thriftMode ? 'Wishlist' : 'Collection'}:\n\n${itemsText}\n\nView here: ${shareUrl}`);
                      setShareModalVisible(true);
                      playSound('click');
                    }}
                    className="flex-row items-center justify-center p-2 rounded-full bg-neutral-900 border border-neutral-800"
                  >
                    <Ionicons name="share-outline" size={14} color="#f59e0b" />
                  </Pressable>
                  <Pressable
                    onPress={() => { setShowRouletteModal(true); playSound('click'); }}
                    className="flex-row items-center justify-center p-2 rounded-full bg-neutral-900 border border-neutral-800"
                  >
                    <Ionicons name="dice-outline" size={14} color="#f59e0b" />
                  </Pressable>
                  <Pressable
                    onPress={() => { setShowTipsModal(true); playSound('click'); }}
                    className="flex-row items-center justify-center p-2 rounded-full bg-neutral-900 border border-neutral-800"
                  >
                    <Ionicons name="help-circle-outline" size={14} color="#f59e0b" />
                  </Pressable>
                </View>
              </View>

              <View className="flex-row bg-neutral-900 rounded-md p-1 border border-neutral-800">
                <Pressable onPress={() => { setViewMode('list'); playSound('click'); }} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-neutral-800' : ''}`}><Ionicons name="list-outline" size={14} color={viewMode === 'list' ? '#fff' : '#666'} /></Pressable>
                <Pressable onPress={() => { setViewMode('grid2'); setNumColumns(2); playSound('click'); }} className={`p-1.5 rounded ${viewMode === 'grid2' || (viewMode === 'custom' && numColumns === 2) ? 'bg-neutral-800' : ''}`}><Ionicons name="apps-outline" size={14} color={(viewMode === 'grid2' || (viewMode === 'custom' && numColumns === 2)) ? '#fff' : '#666'} /></Pressable>
                <Pressable onPress={() => { setViewMode('grid4'); setNumColumns(4); playSound('click'); }} className={`p-1.5 rounded ${viewMode === 'grid4' || (viewMode === 'custom' && numColumns === 4) ? 'bg-neutral-800' : ''}`}><Ionicons name="grid-outline" size={14} color={(viewMode === 'grid4' || (viewMode === 'custom' && numColumns === 4)) ? '#fff' : '#666'} /></Pressable>
              </View>
            </View>

            <View className="pb-6 w-full">
              <View className="flex-row items-center mb-3">
                <View
                  className="flex-row items-center bg-neutral-900 rounded-lg border border-neutral-800 px-4 py-2.5 flex-1"
                  style={thriftMode ? { backgroundColor: 'rgba(5,150,105,0.08)', borderColor: 'rgba(5,150,105,0.35)' } : undefined}
                >
                  <Ionicons name="search" size={16} color={thriftMode ? '#059669' : '#444'} style={{ marginRight: 8 }} />
                  <TextInput 
                    placeholder={`SEARCH ${thriftMode ? 'WISH LIST BY ' : ''}${searchMode === 'title' ? 'TITLE' : (searchMode === 'actor' ? 'ACTOR' : 'DIRECTOR')}...`} 
                    placeholderTextColor="#444" 
                    value={searchQuery} 
                    onChangeText={(text) => {
                      setSelectedPersonId(null);
                      setSearchQuery(text);
                    }} 
                    className="flex-1 text-white font-mono text-xs" 
                    autoCapitalize="none" 
                    style={{ padding: 0 }} 
                  />
                  {isSearchingCredits && (
                    <ActivityIndicator size="small" color="#f59e0b" style={{ marginRight: 8 }} />
                  )}
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => { setSelectedPersonId(null); setSearchQuery(''); playSound('click'); }} className="p-1 -mr-2">
                      <Ionicons name="close-circle" size={16} color="#444" />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Search Mode Toggle */}
              <View className="flex-row gap-2 mb-4 bg-neutral-950 p-1 rounded-lg border border-neutral-900">
                {(['title', 'actor', 'director'] as const).map(mode => (
                  <Pressable
                    key={mode}
                    onPress={() => { setSearchMode(mode); setSelectedPersonId(null); setSearchQuery(''); setCreditTmdbIds(null); playSound('click'); }}
                    className={`flex-1 py-1.5 rounded-md items-center justify-center ${searchMode === mode ? 'bg-amber-500/10 border border-amber-500/30' : 'border border-transparent'}`}
                  >
                    <Text className={`font-mono text-[9px] font-bold uppercase tracking-widest ${searchMode === mode ? 'text-amber-500' : 'text-neutral-500'}`}>
                      {mode}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} className="mb-4">
                {['ALL', 'VHS', 'DVD', 'BluRay', '4K', 'Digital', 'MULTI-PACK', 'HAS EDITION', 'BOOTLEG', 'FOR SALE', 'FOR TRADE'].map(f => {
                  const isSelected = f === 'ALL' ? formatFilter === null : formatFilter === f;
                  const styles = getFormatPillStyles(f, isSelected);
                  return (
                    <Pressable key={f} onPress={() => { setFormatFilter(f === 'ALL' ? null : (isSelected ? null : f)); playSound('click'); }} className={`px-4 py-1.5 rounded-full border ${styles.container}`}>
                      <Text className={`font-mono text-[10px] uppercase font-bold ${styles.text}`}>{f === 'BluRay' ? 'Blu-ray' : f}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View className="bg-neutral-900 mb-8 p-4 rounded-xl border border-neutral-800 z-[100]" style={{ elevation: 10 }}>
                <View className="flex-row items-center gap-2 mb-6 flex-wrap">
                  <Text className="text-neutral-500 font-mono text-[10px] uppercase tracking-tighter mr-1">SORT:</Text>
                  {[{ id: 'recent', label: 'RECENT' }, { id: 'title', label: 'NAME' }, { id: 'release', label: 'YEAR' }, { id: 'rating', label: 'RATING' }, { id: 'value', label: 'VALUE' }].map((s: any) => (
                    <Pressable key={s.id} onPress={() => { if (sortBy === s.id) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy(s.id); setSortOrder(s.id === 'title' || s.id === 'release' ? 'asc' : 'desc'); } playSound('click'); }} className={`px-3 py-1.5 rounded border flex-row items-center gap-1.5 ${sortBy === s.id ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-950 border-neutral-800'}`}>
                      <Text className={`font-mono text-[10px] font-bold ${sortBy === s.id ? 'text-amber-500' : 'text-neutral-500'}`}>{s.label}</Text>
                      {sortBy === s.id && <Ionicons name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} size={10} color="#f59e0b" />}
                    </Pressable>
                  ))}
                  {(sortBy === 'title' || sortBy === 'recent') && (
                    <Pressable 
                      onPress={() => { setUseFranchiseSort(!useFranchiseSort); playSound('click'); }} 
                      className={`px-3 py-1.5 rounded border flex-row items-center gap-1.5 ${useFranchiseSort ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-950 border-neutral-800'}`}
                    >
                      <Ionicons name={useFranchiseSort ? "layers" : "layers-outline"} size={10} color={useFranchiseSort ? "#f59e0b" : "#666"} />
                      <Text className={`font-mono text-[10px] font-bold ${useFranchiseSort ? 'text-amber-500' : 'text-neutral-500'}`}>FRANCHISE</Text>
                    </Pressable>
                  )}
                  <View className="h-4 w-[1px] bg-neutral-800 mx-1" />
                  <Text className="text-neutral-500 font-mono text-[10px] uppercase tracking-tighter mr-1">TYPE:</Text>
                  <View className="flex-row bg-neutral-950 rounded border border-neutral-800 p-0.5 mr-2">
                    <Pressable onPress={() => { setMediaTypeFilter(null); playSound('click'); }} className={`px-2.5 py-1 rounded ${mediaTypeFilter === null ? 'bg-neutral-800' : ''}`}><Text className={`font-mono text-[10px] font-bold ${mediaTypeFilter === null ? 'text-amber-500' : 'text-neutral-500'}`}>ALL</Text></Pressable>
                    <Pressable onPress={() => { setMediaTypeFilter('movie'); playSound('click'); }} className={`px-2.5 py-1 rounded ${mediaTypeFilter === 'movie' ? 'bg-neutral-800' : ''}`}><Text className={`font-mono text-[10px] font-bold ${mediaTypeFilter === 'movie' ? 'text-amber-500' : 'text-neutral-500'}`}>FILM</Text></Pressable>
                    <Pressable onPress={() => { setMediaTypeFilter('tv'); playSound('click'); }} className={`px-2.5 py-1 rounded ${mediaTypeFilter === 'tv' ? 'bg-neutral-800' : ''}`}><Text className={`font-mono text-[10px] font-bold ${mediaTypeFilter === 'tv' ? 'text-amber-500' : 'text-neutral-500'}`}>TV</Text></Pressable>
                  </View>

                  <Pressable
                    onPress={() => { setHasEditionFilter(prev => !prev); playSound('click'); }}
                    className={`px-2.5 py-1.5 rounded border flex-row items-center gap-1 ${hasEditionFilter || formatFilter === 'HAS EDITION' ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-950 border-neutral-800'}`}
                  >
                    <Ionicons name="pricetag-outline" size={10} color={hasEditionFilter || formatFilter === 'HAS EDITION' ? '#f59e0b' : '#666'} />
                    <Text className={`font-mono text-[10px] font-bold ${hasEditionFilter || formatFilter === 'HAS EDITION' ? 'text-amber-500' : 'text-neutral-500'}`}>HAS EDITION</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => { setMultipackFilter(prev => !prev); playSound('click'); }}
                    className={`px-2.5 py-1.5 rounded border flex-row items-center gap-1 ${multipackFilter || formatFilter === 'MULTI-PACK' ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-950 border-neutral-800'}`}
                  >
                    <Ionicons name="albums-outline" size={10} color={multipackFilter || formatFilter === 'MULTI-PACK' ? '#f59e0b' : '#666'} />
                    <Text className={`font-mono text-[10px] font-bold ${multipackFilter || formatFilter === 'MULTI-PACK' ? 'text-amber-500' : 'text-neutral-500'}`}>MULTI-PACKS</Text>
                  </Pressable>

                  <View className="h-4 w-[1px] bg-neutral-800 mx-1" />
                  
                  {/* Genre Filter inside Sort section */}
                  <View className="relative">
                    <Pressable 
                       onPress={() => { setIsGenreDropdownOpen(true); playSound('click'); }}
                       className={`flex-row items-center gap-2 px-3 py-1.5 rounded border bg-neutral-950 ${genreFilter ? 'border-amber-500/50' : 'border-neutral-800'}`}
                    >
                       <Text className="text-neutral-500 font-mono text-[10px] uppercase tracking-tighter">GENRE:</Text>
                       <Text className={`font-mono text-[10px] font-bold uppercase ${genreFilter ? 'text-amber-500' : 'text-neutral-500'}`}>
                          {genreFilter || 'ALL'}
                       </Text>
                       <Ionicons name="chevron-down" size={10} color={genreFilter ? "#f59e0b" : "#444"} />
                    </Pressable>

                    <Modal
                      visible={isGenreDropdownOpen}
                      transparent
                      animationType="fade"
                      onRequestClose={() => setIsGenreDropdownOpen(false)}
                    >
                      <Pressable 
                        className="flex-1 bg-black/40 justify-center items-center p-6"
                        onPress={() => setIsGenreDropdownOpen(false)}
                      >
                        <Pressable 
                          className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
                          onPress={(e: any) => e.stopPropagation()}
                        >
                          <View className="p-4 border-b border-neutral-800 flex-row justify-between items-center bg-neutral-950">
                            <Text className="text-amber-500 font-mono text-xs font-bold tracking-widest">SELECT GENRE</Text>
                            <Pressable onPress={() => setIsGenreDropdownOpen(false)}>
                              <Ionicons name="close" size={20} color="#666" />
                            </Pressable>
                          </View>
                          <ScrollView style={{ maxHeight: 400 }} bounces={false}>
                            <Pressable 
                              onPress={() => { setGenreFilter(null); setIsGenreDropdownOpen(false); playSound('click'); }}
                              className={`px-6 py-4 border-b border-neutral-800/50 ${genreFilter === null ? 'bg-amber-500/10' : ''}`}
                            >
                              <View className="flex-row items-center justify-between">
                                <Text className={`font-mono text-xs uppercase font-bold ${genreFilter === null ? 'text-amber-500' : 'text-neutral-400'}`}>ALL GENRES</Text>
                                {genreFilter === null && <Ionicons name="checkmark" size={16} color="#f59e0b" />}
                              </View>
                            </Pressable>
                            {genres.map(g => (
                              <Pressable 
                                key={g} 
                                onPress={() => { setGenreFilter(g); setIsGenreDropdownOpen(false); playSound('click'); }}
                                className={`px-6 py-4 border-b border-neutral-800/50 ${genreFilter === g ? 'bg-amber-500/10' : ''}`}
                              >
                                <View className="flex-row items-center justify-between">
                                  <Text className={`font-mono text-xs uppercase font-bold ${genreFilter === g ? 'text-amber-500' : 'text-neutral-400'}`}>{g}</Text>
                                  {genreFilter === g && <Ionicons name="checkmark" size={16} color="#f59e0b" />}
                                </View>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </Pressable>
                      </Pressable>
                    </Modal>
                  </View>
                </View>
                <View className="flex-row items-center">
                  <Slider 
                    key={columnsHydrated ? 'h' : 'uh'} 
                    style={{ flex: 1, height: 30 }} 
                    minimumValue={1} 
                    maximumValue={isDesktop ? 8 : 4} 
                    step={1} 
                    value={resolvedColumns} 
                    onValueChange={(val) => { 
                      if (!isSliderLocked) {
                        setNumColumns(val); 
                        setViewMode('custom'); 
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                      }
                    }} 
                    minimumTrackTintColor={isSliderLocked ? "#666" : "#f59e0b"} 
                    maximumTrackTintColor="#333" 
                    thumbTintColor={isSliderLocked ? "#666" : "#f59e0b"} 
                    disabled={isSliderLocked}
                  />
                  <Pressable 
                    onPress={() => {
                        setIsSliderLocked(!isSliderLocked);
                        playSound('click');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }} 
                    className={`ml-3 p-1.5 rounded-full ${isSliderLocked ? 'bg-amber-900/30' : 'bg-neutral-800'}`}
                  >
                    <Ionicons name={isSliderLocked ? "lock-closed" : "lock-open-outline"} size={16} color={isSliderLocked ? "#f59e0b" : "#666"} />
                  </Pressable>
                </View>
            </View>

            {isGuest ? (
               <View className="items-center py-20 px-10">
                  <Ionicons name="lock-closed-outline" size={48} color="#333" />
                  <Text className="text-neutral-500 font-mono text-center mt-4 mb-6">LOGIN TO TRACK YOUR COLLECTION</Text>
                  <Pressable onPress={() => router.push('/auth' as any)} className="bg-amber-600 px-6 py-3 rounded-lg flex-row items-center">
                      <Ionicons name="log-in-outline" size={20} color="white" />
                      <Text className="text-white font-mono font-bold ml-2">LOGIN / SIGN UP</Text>
                  </Pressable>
               </View>
            ) : filteredStacks.length === 0 ? (
               <View className="items-center py-20 px-10">
                  <Ionicons name="search-outline" size={48} color="#333" />
                  <Text className="text-neutral-500 font-mono text-center mt-4">NO MATCHES FOUND</Text>
               </View>
            ) : (
                <View>
                  <View className="flex-row flex-wrap" style={{ marginHorizontal: -(CARD_GAP / 2) }}>
                    {filteredStacks.slice(0, displayLimit).map((stack: any) => {
                      const isPack = !!(stack[0] as any)?.__isMultipackStack;
                      const stackKey = isPack
                        ? `pack-${(stack[0] as any).__multipackTitle}`
                        : `item-${stack[0]?.id}`;
                      return (
                        <View key={stackKey} style={{ width: `${100 / resolvedColumns}%`, paddingHorizontal: CARD_GAP / 2, marginBottom: 20, alignItems: 'center' }}>
                          <StackCard
                            stack={stack}
                            onPress={() => {
                              if (isPack) {
                                playSound('click');
                                setActiveMultipackName((stack[0] as any).__multipackTitle);
                              } else {
                                navigateToDetail(stack[0]);
                              }
                            }}
                            onToggleFavorite={toggleFavorite}
                            onLongPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                              if (isPack) {
                                setActiveMultipackName((stack[0] as any).__multipackTitle);
                              } else {
                                setQuickActionItem(stack[0]);
                              }
                            }}
                            onRatePress={(rating) => handleGridRate(stack[0], rating)}
                            width={calculatedCardWidth}
                            mode={viewMode === 'list' ? 'list' : 'grid'}
                            activeFormatFilter={formatFilter}
                          />
                        </View>
                      );
                    })}
                  </View>
                  {displayLimit < filteredStacks.length && (
                    <Pressable 
                      onPress={() => {
                        setDisplayLimit(d => d + 50);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                      className="bg-neutral-900 border border-neutral-800 rounded-xl py-4 items-center justify-center mt-4 mb-10"
                    >
                      <Text className="text-amber-500 font-mono font-bold tracking-widest">LOAD MORE</Text>
                      <Text className="text-neutral-500 font-mono text-[10px] mt-1">{filteredStacks.length - displayLimit} REMAINING</Text>
                    </Pressable>
                  )}
                </View>
            )}
          </View>
        </View>
        </DesktopContainer>
      </ScrollView>

      {quickActionItem && <QuickActionModal item={quickActionItem} visible={!!quickActionItem} collection={collection || []} userId={userId || ''} onClose={() => setQuickActionItem(null)} />}
      <ReorderShelfModal 
        visible={reorderModalVisible} 
        onClose={() => setReorderModalVisible(false)} 
        type={reorderType} 
        items={reorderType === 'display' ? onDisplay : grailList}
        userId={userId || ''}
      />
      
      <RouletteModal
        visible={showRouletteModal}
        onClose={() => setShowRouletteModal(false)}
        collection={collection || []}
        genres={genres}
      />

      <ShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        title={shareTitle}
        messageLink={shareLinkMessage}
        messageText={shareTextMessage}
      />

      <WatchLogModal
        visible={showWatchLogModal}
        onClose={() => setShowWatchLogModal(false)}
        collection={collection || []}
        navigateToDetail={navigateToDetail}
      />

      <MultipackModal
        visible={!!activeMultipackName}
        packName={activeMultipackName}
        items={collection || []}
        userId={userId || undefined}
        isReadOnly={isGuest}
        onClose={() => setActiveMultipackName(null)}
        onSelectItem={(item) => navigateToDetail(item)}
      />

      <TipsAndTricksModal
        visible={showTipsModal}
        onClose={() => setShowTipsModal(false)}
      />

      {showRewind && (
        <View className="absolute inset-0 z-[100] items-center justify-center pointer-events-none">
          <View className="bg-amber-500/10 absolute inset-0" />
          <View className="bg-black/40 p-10 rounded-full border border-amber-500/20">
            <Ionicons name="reload" size={80} color="#f59e0b" />
            <Text className="text-amber-500 font-mono text-center mt-4 tracking-[10px]">REWINDING</Text>
          </View>
        </View>
      )}
    </View>
  );
}
