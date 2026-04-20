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

  // V1.0.11 - THE PURGE
  const filteredCollection = useMemo(() => {
    if (!collection) return [];
    let items = collection.filter((i: any) => thriftMode ? i.status === 'wishlist' : i.status === 'owned');

    if (formatFilter) {
      const filterStr = formatFilter.replace(/[^a-z0-9]/g, '').toLowerCase();
      items = items.filter((item: any) => {
        if (formatFilter === 'BOOTLEG') return item.is_bootleg;
        if (formatFilter === 'FOR SALE') return item.for_sale;
        if (formatFilter === 'FOR TRADE') return item.for_trade;
        
        const itemFmt = (item.format || '').replace(/[^a-z0-9]/g, '').toLowerCase();
        
        // PHYSICAL LOCK
        if (filterStr === 'vhs') return itemFmt === 'vhs';
        if (filterStr === 'dvd') return itemFmt === 'dvd';
        if (filterStr === 'bluray') return itemFmt === 'bluray';
        if (filterStr === '4k') return itemFmt === '4k';
        if (filterStr === 'digital') return itemFmt.includes('digital');
        return true;
      });
    }

    if (searchQuery) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter((item: any) => (item.movies || item.shows)?.title?.toLowerCase().includes(q));
    }

    return items;
  }, [collection, thriftMode, formatFilter, searchQuery, genreFilter, mediaTypeFilter]);

  const filteredStacks = useMemo(() => {
    return getStacks(filteredCollection, thriftMode, sortBy, sortOrder);
  }, [filteredCollection, thriftMode, sortBy, sortOrder]);

  const hasCollection = (collection?.length ?? 0) > 0;

  if (authPhase === 'checking' || authLoading) return <View className="flex-1 bg-black items-center justify-center"><TrackingLoader label="SYNCHRONIZING..." /></View>;

  return (
    <View className="flex-1 bg-neutral-950">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      {/* V1.0.11 NUCLEAR HEADER */}
      <View className="bg-yellow-500 p-1 flex-row justify-center items-center gap-4">
         <Text className="text-black font-bold font-mono text-[10px]">NUCLEAR V1.0.11</Text>
         <Text className="text-black font-mono text-[10px]">FILT:{formatFilter || 'NONE'}</Text>
         <Text className="text-black font-mono text-[10px]">STACKS:{filteredStacks.length}</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
      >
        <View className="px-4 md:px-8 max-w-7xl mx-auto w-full">
            <View className="flex-row items-center justify-between mb-6 mt-6">
                <Text className="text-amber-500 font-bold text-3xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>
                {thriftMode ? 'WISH LIST' : 'THE STACKS'}
                </Text>
                <Text className="text-neutral-500 font-mono text-xs ml-1">/ {filteredStacks.length}</Text>
            </View>

            <View className="pb-6 w-full">
            <View className="flex-row items-center mb-4">
                <View className="flex-row items-center bg-neutral-900 rounded-lg border border-neutral-800 px-4 py-2.5 flex-1">
                <Ionicons name="search" size={16} color="#444" style={{ marginRight: 8 }} />
                <TextInput
                    placeholder="SEARCH... [V1.0.11]"
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
                return (
                    <Pressable
                    key={f}
                    onPress={() => { setFormatFilter(f === 'ALL' ? null : (isSelected ? null : f)); playSound('click'); }}
                    className={`px-4 py-1.5 rounded-full border ${isSelected ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-900 border-neutral-800'}`}
                    >
                    <Text className={`font-mono text-[10px] uppercase font-bold ${isSelected ? 'text-amber-500' : 'text-neutral-500'}`}>{f === 'BluRay' ? 'Blu-ray' : f}</Text>
                    </Pressable>
                );
                })}
            </ScrollView>
            </View>

            {filteredStacks.length === 0 ? (
            <View className="items-center py-20 px-10">
                <Ionicons name="search-outline" size={48} color="#333" />
                <Text className="text-neutral-500 font-mono text-center mt-4">NO MATCHES</Text>
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
      </ScrollView>

      {quickActionItem && <QuickActionModal item={quickActionItem} visible={!!quickActionItem} collection={collection || []} userId={userId} onClose={() => setQuickActionItem(null)} />}
    </View>
  );
}
