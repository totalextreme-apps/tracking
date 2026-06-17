import { ScrambledChannel } from '@/components/ScrambledChannel';
import { TrackingLoader } from '@/components/TrackingLoader';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, Stack, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { EmptyState } from '@/components/EmptyState';
import { OnDisplayCard } from '@/components/OnDisplayCard';
import { ReorderShelfModal } from '@/components/ReorderShelfModal';
import { QuickActionModal } from '@/components/QuickActionModal';
import { StackCard } from '@/components/StackCard';
import { RouletteModal } from '@/components/RouletteModal';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { useCollection, useUpdateCollectionItem } from '@/hooks/useCollection';
import { usePersistedState } from '@/hooks/usePersistedState';
import { getGenres, getOnDisplayItems, getGrailItems, getStacks } from '@/lib/collection-utils';
import type { CollectionItemWithMedia } from '@/types/database';

export default function HomeScreen() {
  const { userId, session, isLoading: authLoading, authPhase, showCaptcha, onCaptchaSuccess } = useAuth();
  const isGuest = !userId || session?.user?.is_anonymous;
  const { thriftMode } = useThriftMode();
  const { playSound } = useSound();

  const { data: collection, isLoading: collectionLoading, isError: collectionError, refetch } = useCollection(userId) as any;
  const updateMutation = useUpdateCollectionItem(userId);
  const [quickActionItem, setQuickActionItem] = useState<CollectionItemWithMedia | null>(null);

  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'release' | 'rating' | 'genre'>('recent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && windowWidth > 1024;
  const [viewMode, setViewMode] = usePersistedState<'list' | 'grid2' | 'grid4' | 'custom'>('stacks_viewMode', isDesktop ? 'grid4' : 'grid2');
  const [numColumns, setNumColumns, columnsHydrated] = usePersistedState<number>('stacks_numColumns', isDesktop ? 4 : 2);

  const resolvedColumns = viewMode === 'list' ? 1 : viewMode === 'grid2' ? 2 : viewMode === 'grid4' ? 4 : numColumns;
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'movie' | 'tv' | null>(null);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50);

  useEffect(() => {
    setDisplayLimit(50);
  }, [searchQuery, formatFilter, genreFilter, mediaTypeFilter, sortBy, sortOrder, thriftMode]);
  
  const shelfRef = useRef<ScrollView>(null);
  const grailRef = useRef<ScrollView>(null);
  const recentlyWatchedRef = useRef<ScrollView>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [showRewind, setShowRewind] = useState(false);
  const [reorderModalVisible, setReorderModalVisible] = useState(false);
  const [reorderType, setReorderType] = useState<'display' | 'grail'>('display');
  const [showRouletteModal, setShowRouletteModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (refetch && !collectionLoading) refetch();
    }, [refetch, collectionLoading])
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
      if (refetch) refetch();
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
      await Promise.all(relatedItems.map((i: any) => updateMutation.mutateAsync({ itemId: i.id, updates: { rating } })));
      if (refetch) refetch();
    } catch (e) {
      console.error('Failed to save rating', e);
    }
  };

  const navigateToDetail = (item: CollectionItemWithMedia) => {
    if (item.media_type === 'tv') {
      const showId = item.show_id || item.shows?.id;
      if (showId) router.push({ pathname: "/show/[id]", params: { id: showId, season: item.season_number || 1 } } as any);
    } else {
      const movieId = item.movie_id || item.movies?.id;
      if (movieId) router.push({ pathname: "/movie/[id]", params: { id: movieId } } as any);
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
        return item.format === formatFilter;
      });
    }

    if (searchQuery) {
      const noiseWords = new Set(['remake', 'original', 'reboot', 'sequel', 'movie', 'tv', 'show', 'series', 'film', 'version', 'cut', 'edition']);
      const tokens = searchQuery
        .toLowerCase()
        .split(/[\s,()]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0 && !noiseWords.has(t));

      if (tokens.length > 0) {
        items = items.filter((item: any) => {
          const m = item.movies || item.shows;
          if (!m) return false;

          const title = (m.title || m.name || '').toLowerCase();
          const year = (m.release_date || m.first_air_date || '').slice(0, 4);
          const format = (item.format || '').toLowerCase();
          const edition = (item.edition || '').toLowerCase();
          
          const searchableTexts: string[] = [title, year, format, edition];
          
          if (m.genres && Array.isArray(m.genres)) {
            m.genres.forEach((g: any) => {
              if (g?.name) searchableTexts.push(g.name.toLowerCase());
            });
          }

          const cast = m.movie_cast || m.show_cast;
          if (cast && Array.isArray(cast)) {
            cast.forEach((c: any) => {
              if (c?.name) searchableTexts.push(c.name.toLowerCase());
              if (c?.character) searchableTexts.push(c.character.toLowerCase());
            });
          }

          return tokens.every(token => 
            searchableTexts.some(text => text.includes(token))
          );
        });
      }
    }

    if (genreFilter) items = items.filter((item: any) => (item.movies || item.shows)?.genres?.some((g: any) => g?.name === genreFilter));
    if (mediaTypeFilter) items = items.filter((item: any) => item.media_type === mediaTypeFilter);

    return items;
  }, [collection, thriftMode, formatFilter, searchQuery, genreFilter, mediaTypeFilter]);

  const filteredStacks = useMemo(() => {
    return getStacks(filteredCollection, thriftMode, sortBy, sortOrder);
  }, [filteredCollection, thriftMode, sortBy, sortOrder]);

  const onDisplay = useMemo(() => {
    const raw = getOnDisplayItems(collection);
    if (!formatFilter || formatFilter === 'ALL') return raw;
    return raw.filter((item: any) => item.format === formatFilter);
  }, [collection, formatFilter]);

  const grailList = useMemo(() => {
    const raw = getGrailItems(collection);
    if (!formatFilter || formatFilter === 'ALL') return raw;
    return raw.filter((item: any) => item.format === formatFilter);
  }, [collection, formatFilter]);

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
    if (fmt === 'BOOTLEG') return { container: 'bg-orange-600/10 border-orange-600/40', text: baseText };
    if (fmt === 'FOR SALE') return { container: 'bg-red-600/10 border-red-600/40', text: baseText };
    if (fmt === 'FOR TRADE') return { container: 'bg-sky-600/10 border-sky-600/40', text: baseText };
    return { container: 'bg-neutral-900 border-neutral-800', text: baseText };
  };

  if (authPhase === 'checking' || authLoading) return <View className="flex-1 bg-black items-center justify-center"><TrackingLoader label="SYNCHRONIZING..." /></View>;

  return (
    <View className="flex-1 bg-neutral-950">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 160 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
      >
        <View className="flex-1">
          {/* ON DISPLAY SECTION (OWNED) - ONLY IN STACKS MODE */}
          {onDisplay.length > 0 && !thriftMode && (
            <View className="mb-8 mt-6">
              <View className="px-4 md:px-8 flex-row items-center justify-between mb-2 max-w-7xl mx-auto w-full gap-2 flex-wrap">
                <View className="flex-row items-baseline gap-2 flex-wrap flex-1 min-w-[200px]">
                  <Text className="text-amber-500 font-bold text-2xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>ON DISPLAY</Text>
                  <Text className="text-neutral-500 font-mono text-xs ml-1">/ {onDisplay.length}</Text>
                  <Pressable 
                    onPress={() => {
                      import('react-native').then(({ Share }) => {
                        const itemsText = onDisplay.map((item: any, index: number) => {
                          const m = item.movies || item.shows;
                          return `${index + 1}. ${m?.title || m?.name} (${item.format})`;
                        }).join('\n');
                        Share.share({ message: `Check out what I have On Display:\n\n${itemsText}` });
                      });
                    }}
                    className="ml-2 flex-row items-center justify-center p-1.5 rounded-full bg-neutral-900 border border-neutral-800"
                  >
                    <Ionicons name="share-outline" size={14} color="#f59e0b" />
                  </Pressable>
                  {onDisplay.length > 1 && !isGuest && (
                    <Pressable 
                      onPress={() => { setReorderType('display'); setReorderModalVisible(true); }}
                      className="ml-3 px-2 py-1 bg-neutral-900 border border-neutral-800 rounded flex-row items-center"
                    >
                      <Ionicons name="list" size={10} color="#f59e0b" style={{ marginRight: 4 }} />
                      <Text className="text-amber-500 font-mono text-[10px] font-bold">REORDER</Text>
                    </Pressable>
                  )}
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={scrollShelfLeft} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800"><Ionicons name="chevron-back" size={16} color="#f59e0b" /></Pressable>
                  <Pressable onPress={scrollShelfRight} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800"><Ionicons name="chevron-forward" size={16} color="#f59e0b" /></Pressable>
                </View>
              </View>
              <View className="relative">
                <Image source={require('@/assets/images/shelf_background.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.8 }} contentFit="cover" />
                <ScrollView ref={shelfRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 24, paddingRight: 40 }} className="py-12">
                  {onDisplay.map((item: any) => (
                    <OnDisplayCard key={item.id} item={item} onSingleTapAction={() => navigateToDetail(item)} onLongPressAction={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setQuickActionItem(item); }} onToggleFavorite={toggleFavorite} onRatePress={(rating) => handleGridRate(item, rating)} />
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {/* RECENTLY WATCHED SECTION (OWNED) - ONLY IN STACKS MODE */}
          {recentlyWatched.length > 0 && !thriftMode && (
            <View className="mb-8 mt-2">
              <View className="px-4 md:px-8 flex-row items-center justify-between mb-2 max-w-7xl mx-auto w-full gap-2 flex-wrap">
                <View className="flex-row items-baseline gap-2 flex-wrap flex-1 min-w-[200px]">
                  <Text className="text-emerald-500 font-bold text-2xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>RECENTLY WATCHED</Text>
                  <Text className="text-neutral-500 font-mono text-xs ml-1">/ {recentlyWatched.length}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={scrollRecentlyWatchedLeft} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800"><Ionicons name="chevron-back" size={16} color="#10b981" /></Pressable>
                  <Pressable onPress={scrollRecentlyWatchedRight} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800"><Ionicons name="chevron-forward" size={16} color="#10b981" /></Pressable>
                </View>
              </View>
              <View className="relative">
                <Image source={require('@/assets/images/shelf_background.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.8 }} contentFit="cover" />
                <ScrollView ref={recentlyWatchedRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 24, paddingRight: 40 }} className="py-12">
                  {recentlyWatched.map((item: any) => (
                    <OnDisplayCard key={item.id} item={item} onSingleTapAction={() => navigateToDetail(item)} onLongPressAction={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setQuickActionItem(item); }} onToggleFavorite={toggleFavorite} onRatePress={(rating) => handleGridRate(item, rating)} />
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
                      import('react-native').then(({ Share }) => {
                        const itemsText = grailList.map((item: any, index: number) => {
                          const m = item.movies || item.shows;
                          return `${index + 1}. ${m?.title || m?.name} (${item.format})`;
                        }).join('\n');
                        Share.share({ message: `Check out my Grails:\n\n${itemsText}` });
                      });
                    }}
                    className="ml-2 flex-row items-center justify-center p-1.5 rounded-full bg-neutral-900 border border-neutral-800"
                  >
                    <Ionicons name="share-outline" size={14} color="#f59e0b" />
                  </Pressable>
                  {grailList.length > 1 && !isGuest && (
                    <Pressable 
                      onPress={() => { setReorderType('grail'); setReorderModalVisible(true); }}
                      className="ml-3 px-2 py-1 bg-neutral-900 border border-neutral-800 rounded flex-row items-center"
                    >
                      <Ionicons name="list" size={10} color="#f59e0b" style={{ marginRight: 4 }} />
                      <Text className="text-amber-500 font-mono text-[10px] font-bold">REORDER</Text>
                    </Pressable>
                  )}
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={scrollGrailLeft} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800"><Ionicons name="chevron-back" size={16} color="#f59e0b" /></Pressable>
                  <Pressable onPress={scrollGrailRight} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800"><Ionicons name="chevron-forward" size={16} color="#f59e0b" /></Pressable>
                </View>
              </View>
              <View className="relative">
                <Image source={require('@/assets/images/thrift_background.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.8 }} contentFit="cover" />
                <ScrollView ref={grailRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 24, paddingRight: 40 }} className="py-12">
                  {grailList.map((item: any) => (
                    <OnDisplayCard key={item.id} item={item} onSingleTapAction={() => navigateToDetail(item)} onLongPressAction={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setQuickActionItem(item); }} onToggleFavorite={toggleFavorite} onRatePress={(rating) => handleGridRate(item, rating)} />
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          <View className="px-4 md:px-8 pb-4 max-w-7xl mx-auto w-full">
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
                      import('react-native').then(({ Share }) => {
                        const itemsText = filteredStacks.map((stack: any, index: number) => {
                          const item = stack[0];
                          const m = item.movies || item.shows;
                          return `${index + 1}. ${m?.title || m?.name} (${item.format})`;
                        }).join('\n');
                        Share.share({ message: `Check out my ${thriftMode ? 'Wishlist' : 'Collection'}:\n\n${itemsText}` });
                      });
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
                </View>
              </View>

              <View className="flex-row bg-neutral-900 rounded-md p-1 border border-neutral-800">
                <Pressable onPress={() => { setViewMode('list'); playSound('click'); }} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-neutral-800' : ''}`}><Ionicons name="list-outline" size={14} color={viewMode === 'list' ? '#fff' : '#666'} /></Pressable>
                <Pressable onPress={() => { setViewMode('grid2'); setNumColumns(2); playSound('click'); }} className={`p-1.5 rounded ${viewMode === 'grid2' || (viewMode === 'custom' && numColumns === 2) ? 'bg-neutral-800' : ''}`}><Ionicons name="apps-outline" size={14} color={(viewMode === 'grid2' || (viewMode === 'custom' && numColumns === 2)) ? '#fff' : '#666'} /></Pressable>
                <Pressable onPress={() => { setViewMode('grid4'); setNumColumns(4); playSound('click'); }} className={`p-1.5 rounded ${viewMode === 'grid4' || (viewMode === 'custom' && numColumns === 4) ? 'bg-neutral-800' : ''}`}><Ionicons name="grid-outline" size={14} color={(viewMode === 'grid4' || (viewMode === 'custom' && numColumns === 4)) ? '#fff' : '#666'} /></Pressable>
              </View>
            </View>

            <View className="pb-6 w-full">
              <View className="flex-row items-center mb-4">
                <View className="flex-row items-center bg-neutral-900 rounded-lg border border-neutral-800 px-4 py-2.5 flex-1">
                  <Ionicons name="search" size={16} color="#444" style={{ marginRight: 8 }} />
                  <TextInput placeholder="SEARCH TITLE..." placeholderTextColor="#444" value={searchQuery} onChangeText={setSearchQuery} className="flex-1 text-white font-mono text-xs" autoCapitalize="none" style={{ padding: 0 }} />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => { setSearchQuery(''); playSound('click'); }} className="p-1 -mr-2">
                      <Ionicons name="close-circle" size={16} color="#444" />
                    </Pressable>
                  )}
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} className="mb-4">
                {['ALL', 'VHS', 'DVD', 'BluRay', '4K', 'Digital', 'BOOTLEG', 'FOR SALE', 'FOR TRADE'].map(f => {
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
                  {[{ id: 'recent', label: 'RECENT' }, { id: 'title', label: 'NAME' }, { id: 'release', label: 'YEAR' }, { id: 'rating', label: 'RATING' }, { id: 'genre', label: 'GENRE' }].map((s: any) => (
                    <Pressable key={s.id} onPress={() => { if (sortBy === s.id) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy(s.id); setSortOrder(s.id === 'title' || s.id === 'release' ? 'asc' : 'desc'); } playSound('click'); }} className={`px-3 py-1.5 rounded border flex-row items-center gap-1.5 ${sortBy === s.id ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-950 border-neutral-800'}`}>
                      <Text className={`font-mono text-[10px] font-bold ${sortBy === s.id ? 'text-amber-500' : 'text-neutral-500'}`}>{s.label}</Text>
                      {sortBy === s.id && <Ionicons name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} size={10} color="#f59e0b" />}
                    </Pressable>
                  ))}
                  <View className="h-4 w-[1px] bg-neutral-800 mx-1" />
                  <Text className="text-neutral-500 font-mono text-[10px] uppercase tracking-tighter mr-1">TYPE:</Text>
                  <View className="flex-row bg-neutral-950 rounded border border-neutral-800 p-0.5 mr-2">
                    <Pressable onPress={() => { setMediaTypeFilter(null); playSound('click'); }} className={`px-2.5 py-1 rounded ${mediaTypeFilter === null ? 'bg-neutral-800' : ''}`}><Text className={`font-mono text-[10px] font-bold ${mediaTypeFilter === null ? 'text-amber-500' : 'text-neutral-500'}`}>ALL</Text></Pressable>
                    <Pressable onPress={() => { setMediaTypeFilter('movie'); playSound('click'); }} className={`px-2.5 py-1 rounded ${mediaTypeFilter === 'movie' ? 'bg-neutral-800' : ''}`}><Text className={`font-mono text-[10px] font-bold ${mediaTypeFilter === 'movie' ? 'text-amber-500' : 'text-neutral-500'}`}>FILM</Text></Pressable>
                    <Pressable onPress={() => { setMediaTypeFilter('tv'); playSound('click'); }} className={`px-2.5 py-1 rounded ${mediaTypeFilter === 'tv' ? 'bg-neutral-800' : ''}`}><Text className={`font-mono text-[10px] font-bold ${mediaTypeFilter === 'tv' ? 'text-amber-500' : 'text-neutral-500'}`}>TV</Text></Pressable>
                  </View>

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
                <Slider key={columnsHydrated ? 'h' : 'uh'} style={{ width: '100%', height: 30 }} minimumValue={1} maximumValue={isDesktop ? 8 : 4} step={1} value={resolvedColumns} onValueChange={(val) => { setNumColumns(val); setViewMode('custom'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} minimumTrackTintColor="#f59e0b" maximumTrackTintColor="#333" thumbTintColor="#f59e0b" />
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
                  <View className="flex-row flex-wrap" style={{ marginHorizontal: -10 }}>
                    {filteredStacks.slice(0, displayLimit).map((stack: any) => (
                      <View key={stack[0]?.id} style={{ width: `${100 / resolvedColumns}%`, paddingHorizontal: 10, marginBottom: 32 }}>
                        <StackCard stack={stack} onPress={() => navigateToDetail(stack[0])} onToggleFavorite={toggleFavorite} onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setQuickActionItem(stack[0]); }} onRatePress={(rating) => handleGridRate(stack[0], rating)} width={(windowWidth - 48 - (resolvedColumns * 20)) / resolvedColumns} mode={viewMode === 'list' ? 'list' : 'grid'} activeFormatFilter={formatFilter} />
                      </View>
                    ))}
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
