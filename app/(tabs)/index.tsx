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
import { getGenres, getOnDisplayItems, getStacks } from '@/lib/collection-utils';
import type { CollectionItemWithMedia } from '@/types/database';

export default function HomeScreen() {
  const { userId, isLoading: authLoading, authPhase, showCaptcha, onCaptchaSuccess } = useAuth();
  const { thriftMode } = useThriftMode();
  const { playSound } = useSound();

  const { data: collection, isLoading: collectionLoading, isError: collectionError, refetch } = useCollection(userId) as any;
  const updateMutation = useUpdateCollectionItem(userId);
  const [quickActionItem, setQuickActionItem] = useState<CollectionItemWithMedia | null>(null);

  // Sync quickActionItem
  useEffect(() => {
    if (quickActionItem && collection) {
      const freshItem = (collection as CollectionItemWithMedia[]).find(i => i.id === quickActionItem.id);
      if (freshItem) {
        setQuickActionItem(freshItem);
      }
    }
  }, [collection]);

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

  const [refreshing, setRefreshing] = useState(false);
  const [showRewind, setShowRewind] = useState(false);
  const [showRetryFallback, setShowRetryFallback] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (refetch && !collectionLoading) refetch();
    }, [refetch, collectionLoading])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setShowRewind(true);
    playSound('rewind');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      if (refetch) refetch();
      setShowRewind(false);
      setRefreshing(false);
    }, 1500);
  };

  const scrollShelfRight = () => {
    if (shelfRef.current) {
      playSound('click');
      if (Platform.OS === 'web') {
        (shelfRef.current as any).scrollTo({ x: (shelfRef.current as any).scrollLeft + 400, animated: true });
      } else {
        shelfRef.current.scrollTo({ x: 500, animated: true });
      }
    }
  };

  const scrollShelfLeft = () => {
    if (shelfRef.current) {
      playSound('click');
      if (Platform.OS === 'web') {
        (shelfRef.current as any).scrollTo({ x: (shelfRef.current as any).scrollLeft - 400, animated: true });
      } else {
        shelfRef.current.scrollTo({ x: 0, animated: true });
      }
    }
  };

  const toggleFavorite = async (item: CollectionItemWithMedia) => {
    try {
      const isWishlist = item.status === 'wishlist';
      const updates = isWishlist
        ? { is_grail: !item.is_grail }
        : { is_on_display: !item.is_on_display };
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

  // V1.0.10 - THE "IF" STATEMENT REDEMPTION
  const filteredCollection = useMemo(() => {
    if (!collection) return [];
    
    // Status
    let items = collection.filter((i: any) => thriftMode ? i.status === 'wishlist' : i.status === 'owned');

    // Format (HARDCODED IF STATEMENTS)
    if (formatFilter) {
      const filterStr = formatFilter.replace(/[^a-z0-9]/g, '').toLowerCase();
      items = items.filter((item: any) => {
        if (formatFilter === 'BOOTLEG') return item.is_bootleg;
        if (formatFilter === 'FOR SALE') return item.for_sale;
        if (formatFilter === 'FOR TRADE') return item.for_trade;
        
        const itemFmt = (item.format || '').replace(/[^a-z0-9]/g, '').toLowerCase();
        
        // Literal Purge
        if (filterStr === 'vhs') {
            if (itemFmt === 'vhs') return true;
            return false;
        }
        if (filterStr === 'dvd') {
            if (itemFmt === 'dvd') return true;
            return false;
        }
        if (filterStr === 'bluray') {
            if (itemFmt === 'bluray') return true;
            return false;
        }
        if (filterStr === '4k') {
            if (itemFmt === '4k') return true;
            return false;
        }
        if (filterStr === 'digital') {
            return itemFmt.includes('digital');
        }
        return true;
      });
    }

    if (searchQuery) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter((item: any) => {
        const m = item.movies || item.shows;
        if (!m) return false;
        return (m.title || m.name || '').toLowerCase().includes(q);
      });
    }

    if (genreFilter) {
      items = items.filter((item: any) => (item.movies || item.shows)?.genres?.some((g: any) => g?.name === genreFilter));
    }

    if (mediaTypeFilter) {
      items = items.filter((item: any) => item.media_type === mediaTypeFilter);
    }

    return items;
  }, [collection, thriftMode, formatFilter, searchQuery, genreFilter, mediaTypeFilter]);

  const filteredStacks = useMemo(() => {
    return getStacks(filteredCollection, thriftMode, sortBy, sortOrder);
  }, [filteredCollection, thriftMode, sortBy, sortOrder]);

  const onDisplay = useMemo(() => {
    const raw = getOnDisplayItems(collection);
    if (!formatFilter) return raw;
    const filterStr = formatFilter.replace(/[^a-z0-9]/g, '').toLowerCase();
    return raw.filter((item: any) => {
        const itemFmt = (item.format || '').replace(/[^a-z0-9]/g, '').toLowerCase();
        if (filterStr === 'vhs') return itemFmt === 'vhs';
        if (filterStr === 'dvd') return itemFmt === 'dvd';
        return true;
    });
  }, [collection, formatFilter]);

  const hasCollection = (collection?.length ?? 0) > 0;
  const isEmpty = !hasCollection && onDisplay.length === 0;

  if (authPhase === 'checking' || authLoading) {
    return <View className="flex-1 bg-black items-center justify-center"><TrackingLoader label="SYNCHRONIZING..." /></View>;
  }

  return (
    <View className="flex-1 bg-neutral-950">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
      >
        <View className="w-full">
          
          {/* V1.0.10 DEBUG HEADER */}
          <View className="bg-red-600/20 p-2 border-b border-red-600/40">
             <Text className="text-red-500 font-mono text-[9px] text-center">
                 V1.0.10 | F:{formatFilter || 'OFF'} | S:{filteredStacks.length} | C:{collection?.length || 0}
             </Text>
          </View>

          <View className="flex-1">
            <View className="px-4 md:px-8 pb-4 max-w-7xl mx-auto w-full">
              <View className="flex-row items-center justify-between mb-6 mt-6">
                <View className="flex-row items-baseline gap-2">
                  <Text className="text-amber-500 font-bold text-3xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>
                    {thriftMode ? 'WISH LIST' : 'THE STACKS'}
                  </Text>
                  <Text className="text-neutral-500 font-mono text-xs ml-1">/ {filteredStacks.length}</Text>
                </View>
              </View>

              <View className="pb-6 w-full">
                <View className="flex-row items-center mb-4">
                  <View className="flex-row items-center bg-neutral-900 rounded-lg border border-neutral-800 px-4 py-2.5 flex-1">
                    <Ionicons name="search" size={16} color="#444" style={{ marginRight: 8 }} />
                    <TextInput
                      placeholder="SEARCH... [V1.0.10]"
                      placeholderTextColor="#333"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      className="flex-1 text-white font-mono text-xs"
                      autoCapitalize="none"
                      style={{ padding: 0 }}
                    />
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {['ALL', 'VHS', 'DVD', 'BluRay', '4K', 'DIGITAL', 'BOOTLEG', 'FOR SALE', 'FOR TRADE'].map(f => {
                    const isSelected = f === 'ALL' ? formatFilter === null : formatFilter === f;
                    const formatColor = f === 'VHS' ? 'bg-red-600/20 border-red-600/40' : f === 'DVD' ? 'bg-purple-600/20 border-purple-600/40' : 'bg-neutral-900';
                    const textStyle = isSelected ? 'text-amber-500' : 'text-neutral-500';
                    return (
                      <Pressable
                        key={f}
                        onPress={() => { setFormatFilter(f === 'ALL' ? null : (isSelected ? null : f)); playSound('click'); }}
                        className={`px-4 py-1.5 rounded-full border ${isSelected ? 'bg-amber-500/20 border-amber-500/50' : formatColor}`}
                      >
                        <Text className={`font-mono text-[10px] uppercase font-bold ${textStyle}`}>{f === 'BluRay' ? 'Blu-ray' : f}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
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
                      <StackCard
                        stack={stack}
                        onPress={() => navigateToDetail(stack[0])}
                        onToggleFavorite={toggleFavorite}
                        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setQuickActionItem(stack[0]); }}
                        onRatePress={(rating) => handleGridRate(stack[0], rating)}
                        width={(windowWidth - 48 - (resolvedColumns * 20)) / resolvedColumns}
                        mode={viewMode === 'list' ? 'list' : 'grid'}
                        activeFormatFilter={formatFilter}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {quickActionItem && <QuickActionModal item={quickActionItem} visible={!!quickActionItem} collection={collection || []} userId={userId} onClose={() => setQuickActionItem(null)} />}
    </View>
  );
}
