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
import { QuickActionModal } from '@/components/QuickActionModal';
import { StackCard } from '@/components/StackCard';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { useCollection, useUpdateCollectionItem } from '@/hooks/useCollection';
import { usePersistedState } from '@/hooks/usePersistedState';
import { getGenres, getOnDisplayItems, getGrailItems, getStacks } from '@/lib/collection-utils';
import type { CollectionItemWithMedia } from '@/types/database';

export default function HomeScreen() {
  const { userId, isLoading: authLoading, authPhase, showCaptcha, onCaptchaSuccess } = useAuth();
  const { thriftMode } = useThriftMode();
  const { playSound } = useSound();

  const { data: collection, isLoading: collectionLoading, isError: collectionError, refetch } = useCollection(userId) as any;
  const updateMutation = useUpdateCollectionItem(userId);
  const [quickActionItem, setQuickActionItem] = useState<CollectionItemWithMedia | null>(null);

  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'release' | 'rating'>('recent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && windowWidth > 1024;
  const [viewMode, setViewMode] = usePersistedState<'list' | 'grid2' | 'grid4' | 'custom'>('stacks_viewMode', isDesktop ? 'grid4' : 'grid2');
  const [numColumns, setNumColumns] = usePersistedState<number>('stacks_numColumns', isDesktop ? 4 : 2);

  const resolvedColumns = viewMode === 'list' ? 1 : viewMode === 'grid2' ? 2 : viewMode === 'grid4' ? 4 : numColumns;
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'movie' | 'tv' | null>(null);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  
  const shelfRef = useRef<ScrollView>(null);
  const grailRef = useRef<ScrollView>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [showRewind, setShowRewind] = useState(false);

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
      const q = searchQuery.trim().toLowerCase();
      items = items.filter((item: any) => {
        const m = item.movies || item.shows;
        return (m?.title || m?.name || '').toLowerCase().includes(q);
      });
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
              <View className="px-4 md:px-8 flex-row items-center justify-between mb-2 max-w-7xl mx-auto w-full">
                <View className="flex-row items-baseline gap-2">
                  <Text className="text-amber-500 font-bold text-3xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>ON DISPLAY</Text>
                  <Text className="text-neutral-500 font-mono text-xs ml-1">/ {onDisplay.length}</Text>
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

          {/* THE GRAILS SECTION (WISHLIST) - ONLY IN THRIFT MODE */}
          {grailList.length > 0 && thriftMode && (
            <View className="mb-8 mt-6">
              <View className="px-4 md:px-8 flex-row items-center justify-between mb-2 max-w-7xl mx-auto w-full">
                <View className="flex-row items-baseline gap-2">
                  <Text className="text-amber-500 font-bold text-3xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>THE GRAILS</Text>
                  <Text className="text-neutral-500 font-mono text-xs ml-1">/ {grailList.length}</Text>
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
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-baseline gap-2">
                <Text className="text-amber-500 font-bold text-3xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>
                  {thriftMode ? 'WISH LIST' : 'THE STACKS'}
                </Text>
                <Text className="text-neutral-500 font-mono text-xs ml-1">/ {filteredStacks.length}</Text>
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
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
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

            <View className="bg-neutral-900 mb-8 p-4 rounded-xl border border-neutral-800">
                <View className="flex-row items-center gap-2 mb-6 flex-wrap">
                  <Text className="text-neutral-500 font-mono text-[10px] uppercase tracking-tighter mr-1">SORT:</Text>
                  {[{ id: 'recent', label: 'RECENT' }, { id: 'title', label: 'NAME' }, { id: 'release', label: 'YEAR' }, { id: 'rating', label: 'RATING' }].map((s: any) => (
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
                </View>
                <Slider style={{ width: '100%', height: 30 }} minimumValue={1} maximumValue={isDesktop ? 8 : 4} step={1} value={numColumns} onValueChange={(val) => { setNumColumns(val); setViewMode('custom'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} minimumTrackTintColor="#f59e0b" maximumTrackTintColor="#333" thumbTintColor="#f59e0b" />
            </View>

            {filteredStacks.length === 0 ? (
               <View className="items-center py-20 px-10">
                  <Ionicons name="search-outline" size={48} color="#333" />
                  <Text className="text-neutral-500 font-mono text-center mt-4">NO MATCHES FOUND</Text>
               </View>
            ) : (
                <View className="flex-row flex-wrap" style={{ marginHorizontal: -10 }}>
                  {filteredStacks.map((stack: any) => (
                    <View key={stack[0]?.id} style={{ width: `${100 / resolvedColumns}%`, paddingHorizontal: 10, marginBottom: 32 }}>
                      <StackCard stack={stack} onPress={() => navigateToDetail(stack[0])} onToggleFavorite={toggleFavorite} onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setQuickActionItem(stack[0]); }} onRatePress={(rating) => handleGridRate(stack[0], rating)} width={(windowWidth - 48 - (resolvedColumns * 20)) / resolvedColumns} mode={viewMode === 'list' ? 'list' : 'grid'} activeFormatFilter={formatFilter} />
                    </View>
                  ))}
                </View>
            )}
          </View>
        </View>
      </ScrollView>

      {quickActionItem && <QuickActionModal item={quickActionItem} visible={!!quickActionItem} collection={collection || []} userId={userId} onClose={() => setQuickActionItem(null)} />}

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
