import { ScrambledChannel } from '@/components/ScrambledChannel';
import { TrackingLoader } from '@/components/TrackingLoader';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { router, Stack, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { AcquiredModal } from '@/components/AcquiredModal';
import { EmptyState } from '@/components/EmptyState';
import { OnDisplayCard } from '@/components/OnDisplayCard';
import { StackCard } from '@/components/StackCard';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { useCollection, useUpdateCollectionItem } from '@/hooks/useCollection';
import { usePersistedState } from '@/hooks/usePersistedState';
import { getGenres, getOnDisplayItems, getStacks } from '@/lib/collection-utils';
import type { CollectionItemWithMedia } from '@/types/database';
import ViewShot from 'react-native-view-shot';

export default function HomeScreen() {
  const { userId, isLoading: authLoading, authPhase, showCaptcha, onCaptchaSuccess } = useAuth();
  const { thriftMode } = useThriftMode();
  const { playSound } = useSound();

  const { data: collection, isLoading: collectionLoading, isError: collectionError, refetch } = useCollection(userId) as any;
  const updateMutation = useUpdateCollectionItem(userId);
  const [acquiredItem, setAcquiredItem] = useState<CollectionItemWithMedia | null>(null);

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
  const [showShareModal, setShowShareModal] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);
  const shelfRef = useRef<ScrollView>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [showRewind, setShowRewind] = useState(false);
  const [showRetryFallback, setShowRetryFallback] = useState(false);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const isActuallyLoading = authLoading || (userId && collectionLoading && !collectionError);
    if (isActuallyLoading) {
      if (!loadingTimerRef.current) {
        loadingTimerRef.current = setTimeout(() => {
          setShowRetryFallback(true);
        }, 6000) as any;
      }
    } else {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setShowRetryFallback(false);
    }
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [authLoading, userId, collectionLoading, collectionError]);

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

  const onDisplay = thriftMode
    ? collection?.filter((item: any) => item.is_grail) ?? []
    : getOnDisplayItems(collection);

  const genres = getGenres(collection);
  const stacks = getStacks(collection, thriftMode, sortBy, sortOrder);

  // Filter Logic
  let filteredStacks = stacks || [];
  if (searchQuery || formatFilter || genreFilter || mediaTypeFilter) {
    filteredStacks = filteredStacks.filter((stack: any) => {
      const media = stack[0]?.movies || stack[0]?.shows;
      if (!media) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
        const title = (stack[0]?.movies?.title || stack[0]?.shows?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchesTitle = title.includes(query);
        const cast = (stack[0]?.movies?.movie_cast || stack[0]?.shows?.show_cast || []);
        const matchesCast = cast.some((c: any) => c.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(query));
        if (!matchesTitle && !matchesCast) return false;
      }
      if (formatFilter) {
        const hasFormat = stack.some((item: any) => item.format === formatFilter);
        if (!hasFormat) return false;
      }
      if (genreFilter) {
        const hasGenre = media.genres?.some((g: any) => g.name === genreFilter);
        if (!hasGenre) return false;
      }
      if (mediaTypeFilter) {
        if (stack[0].media_type !== mediaTypeFilter) return false;
      }
      return true;
    });
  }

  const hasCollection = (collection?.length ?? 0) > 0;
  const isEmpty = !hasCollection && onDisplay.length === 0;

  const handleLongPress = (item: CollectionItemWithMedia) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setAcquiredItem(item);
  };

  const toggleFavorite = async (item: CollectionItemWithMedia) => {
    try {
      const isWishlist = item.status === 'wishlist';
      const updates = isWishlist
        ? { is_grail: !item.is_grail }
        : { is_on_display: !item.is_on_display };

      await updateMutation.mutateAsync({
        itemId: item.id,
        updates
      });
      if (refetch) refetch();
    } catch (e) {
      console.error('Failed to toggle status', e);
    }
  };

  const scrollShelfRight = () => {
    if (shelfRef.current) {
      playSound('click');
      shelfRef.current.scrollTo({ x: 500, animated: true });
    }
  };

  const scrollShelfLeft = () => {
    if (shelfRef.current) {
      playSound('click');
      shelfRef.current.scrollTo({ x: 0, animated: true });
    }
  };

  const handleAcquire = async () => {
    if (!acquiredItem) return;
    try {
      await updateMutation.mutateAsync({
        itemId: acquiredItem.id,
        updates: { status: 'owned' }
      });
      if (refetch) refetch();
    } catch (e) {
      console.error('Failed to acquire', e);
    }
  };

  const navigateToDetail = (item: CollectionItemWithMedia) => {
    if (item.media_type === 'tv') {
      router.push(`/show/${item.show_id}?season=${item.season_number}`);
    } else {
      router.push(`/movie/${item.movie_id}`);
    }
  };

  if (authPhase === 'checking' || authLoading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <TrackingLoader label="SYNCHRONIZING..." />
      </View>
    );
  }

  if (!userId) {
    return (
      <View className="flex-1 bg-neutral-950 items-center justify-center p-6">
        <Text className="text-amber-500 font-mono text-xl mb-4 italic">SIGNAL LOST</Text>
        <Text className="text-neutral-500 font-mono text-center">Enable Anonymous Auth or check your network connection.</Text>
        <Pressable onPress={() => onRefresh()} className="bg-neutral-900 px-6 py-3 rounded-md mt-8 border border-neutral-800 active:bg-neutral-800">
          <Text className="text-white font-mono text-xs tracking-widest uppercase">RETRY FETCH</Text>
        </Pressable>
      </View>
    );
  }

  if (showCaptcha) {
    return (
      <View className="flex-1 bg-black items-center justify-center p-6">
        <ScrambledChannel onRetry={() => onCaptchaSuccess('')} />
      </View>
    );
  }

  if (showRetryFallback && !hasCollection) {
    return (
      <View className="flex-1 bg-neutral-950 items-center justify-center p-6">
        <Text className="text-red-500 font-mono text-xl mb-4 italic">LOAD TIMEOUT</Text>
        <Text className="text-neutral-500 font-mono text-center mb-8">The tapes are stuck! Check your connection or retry.</Text>
        <Pressable onPress={() => onRefresh()} className="bg-neutral-900 border border-neutral-800 px-8 py-3 rounded active:bg-neutral-800">
          <Text className="text-white font-mono uppercase tracking-widest text-xs">TRY AGAIN</Text>
        </Pressable>
      </View>
    );
  }

  if (collectionError) {
    return (
      <View className="flex-1 bg-neutral-950 items-center justify-center p-6">
        <Text className="text-red-500 font-mono text-xl mb-4">COLLECTION ERROR</Text>
        <Text className="text-neutral-400 font-mono text-center">We couldn't retrieve your collection.</Text>
        <Pressable onPress={() => onRefresh()} className="bg-neutral-900 px-6 py-3 rounded-md mt-6 border border-neutral-800">
          <Text className="text-white font-mono text-xs uppercase tracking-widest">RETRY FETCH</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-950">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <View className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#f59e0b"
            />
          }
        >
          {/* Header/Search Bar */}
          <View className="px-6 pt-4 pb-4 border-b border-neutral-900">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center bg-neutral-950 rounded-full border border-neutral-800 p-1 flex-1 mr-4">
                <Pressable
                  onPress={() => { setMediaTypeFilter(null); playSound('click'); }}
                  className={`px-4 py-2 rounded-full ${mediaTypeFilter === null ? 'bg-neutral-800' : ''}`}
                >
                  <Text className={`font-mono text-[10px] ${mediaTypeFilter === null ? 'text-amber-500 font-bold' : 'text-neutral-500'}`}>ALL</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setMediaTypeFilter('movie'); playSound('click'); }}
                  className={`px-4 py-2 rounded-full ${mediaTypeFilter === 'movie' ? 'bg-neutral-800' : ''}`}
                >
                  <Text className={`font-mono text-[10px] ${mediaTypeFilter === 'movie' ? 'text-amber-500 font-bold' : 'text-neutral-500'}`}>FILM</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setMediaTypeFilter('tv'); playSound('click'); }}
                  className={`px-4 py-2 rounded-full ${mediaTypeFilter === 'tv' ? 'bg-neutral-800' : ''}`}
                >
                  <Text className={`font-mono text-[10px] ${mediaTypeFilter === 'tv' ? 'text-amber-500 font-bold' : 'text-neutral-500'}`}>TV</Text>
                </Pressable>
              </View>

              <View className="flex-row items-center bg-neutral-900 rounded-lg border border-neutral-800 px-4 py-2.5 flex-1 ml-2">
                <Ionicons name="search" size={16} color="#444" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="SEARCH..."
                  placeholderTextColor="#333"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  className="flex-1 text-white font-mono text-[10px]"
                  autoCapitalize="none"
                  style={{ padding: 0 }}
                />
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {['VHS', 'DVD', 'BluRay', '4K'].map(f => (
                <Pressable
                  key={f}
                  onPress={() => setFormatFilter(formatFilter === f ? null : f)}
                  className={`px-4 py-1.5 rounded-full border ${formatFilter === f ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-900 border-neutral-800'}`}
                >
                  <Text className={`font-mono text-[10px] ${formatFilter === f ? 'text-amber-500' : 'text-neutral-500'}`}>{f}</Text>
                </Pressable>
              ))}

              <Pressable
                onPress={() => setIsGenreDropdownOpen(true)}
                className={`px-4 py-1.5 rounded-full border flex-row items-center gap-2 ${genreFilter ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-900 border-neutral-800'}`}
              >
                <Text className={`font-mono text-[10px] ${genreFilter ? 'text-amber-500' : 'text-neutral-500'}`}>
                  {genreFilter || 'GENRE'}
                </Text>
                <Ionicons name="chevron-down" size={10} color={genreFilter ? '#f59e0b' : '#666'} />
              </Pressable>
            </ScrollView>
          </View>

          <View className="flex-1">
            {onDisplay.length > 0 && (
              <View className="mb-4 mt-4">
                <View className="px-6 flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-amber-500 font-mono text-[10px] uppercase font-bold tracking-widest">{thriftMode ? 'MY GRAILS' : 'ON DISPLAY'}</Text>
                    <Text className="text-neutral-600 font-mono text-[10px]">/ {onDisplay.length}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable onPress={scrollShelfLeft} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800">
                      <Ionicons name="chevron-back" size={16} color="#f59e0b" />
                    </Pressable>
                    <Pressable onPress={scrollShelfRight} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800">
                      <Ionicons name="chevron-forward" size={16} color="#f59e0b" />
                    </Pressable>
                  </View>
                </View>

                <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
                  <ScrollView
                    ref={shelfRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingLeft: 24, paddingRight: 40 }}
                    className="py-4"
                  >
                    {onDisplay.map((item: any) => (
                      <OnDisplayCard
                        key={item.id}
                        item={item}
                        onSingleTapAction={() => navigateToDetail(item)}
                        onLongPressAction={() => handleLongPress(item)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </ScrollView>
                </ViewShot>
              </View>
            )}

            <View className="px-6 pb-4">
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-neutral-600 font-mono text-[10px] tracking-tighter uppercase italic">
                  {thriftMode ? 'Wanted List' : 'The Stacks'}
                </Text>

                <View className="flex-row bg-neutral-900 rounded-md p-1 border border-neutral-800">
                  <Pressable
                    onPress={() => { setViewMode('grid2'); setNumColumns(2); }}
                    className={`p-1.5 rounded ${viewMode === 'grid2' ? 'bg-neutral-800' : ''}`}
                  >
                    <Ionicons name="apps-outline" size={14} color={viewMode === 'grid2' ? '#fff' : '#666'} />
                  </Pressable>
                  <Pressable
                    onPress={() => { setViewMode('grid4'); setNumColumns(4); }}
                    className={`p-1.5 rounded ${viewMode === 'grid4' ? 'bg-neutral-800' : ''}`}
                  >
                    <Ionicons name="grid-outline" size={14} color={viewMode === 'grid4' ? '#fff' : '#666'} />
                  </Pressable>
                  <Pressable
                    onPress={() => setViewMode('custom')}
                    className={`p-1.5 rounded ${viewMode === 'custom' ? 'bg-neutral-800' : ''}`}
                  >
                    <Ionicons name="options-outline" size={14} color={viewMode === 'custom' ? '#fff' : '#666'} />
                  </Pressable>
                </View>
              </View>

              {viewMode === 'custom' && (
                <View className="bg-neutral-900 mb-8 p-6 rounded-xl border border-neutral-800">
                  <View className="flex-row justify-between mb-4">
                    <Text className="text-neutral-400 font-mono text-[10px] tracking-widest">COLUMN DENSITY ({numColumns})</Text>
                    <Pressable onPress={() => setNumColumns(2)}><Text className="text-amber-500/50 font-mono text-[10px]">RESET</Text></Pressable>
                  </View>
                  <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={1}
                    maximumValue={6}
                    step={1}
                    value={numColumns}
                    onValueChange={(val) => {
                      setNumColumns(val);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    minimumTrackTintColor="#f59e0b"
                    maximumTrackTintColor="#333"
                    thumbTintColor="#f59e0b"
                  />
                </View>
              )}

              {isEmpty ? (
                <EmptyState />
              ) : (
                <View className="flex-row flex-wrap" style={{ marginHorizontal: -10 }}>
                  {filteredStacks.map((stack: any, idx: number) => (
                    <View
                      key={`${stack[0].media_type}-${stack[0].movie_id}-${stack[0].show_id}-${idx}`}
                      style={{
                        width: `${100 / resolvedColumns}%`,
                        paddingHorizontal: 10,
                        marginBottom: 32
                      }}
                    >
                      <StackCard
                        stack={stack}
                        onPress={() => navigateToDetail(stack[0])}
                        onToggleFavorite={toggleFavorite}
                        onLongPress={() => handleLongPress(stack[0])}
                        width={(windowWidth - 48 - (resolvedColumns * 20)) / resolvedColumns}
                      />
                      <View className="mt-3">
                        <Text
                          className="text-white font-medium text-[11px] uppercase tracking-wide"
                          numberOfLines={1}
                          style={{ fontFamily: 'VCR_OSD_MONO' }}
                        >
                          {stack[0].movies?.title || stack[0].shows?.name}
                        </Text>
                        {stack[0].media_type === 'tv' && (
                          <Text className="text-neutral-500 font-mono text-[9px] mt-0.5">
                            SEASON {stack[0].season_number}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      {acquiredItem && (
        <AcquiredModal
          item={acquiredItem}
          visible={!!acquiredItem}
          onClose={() => setAcquiredItem(null)}
          onAcquired={handleAcquire}
        />
      )}

      <Modal visible={isGenreDropdownOpen} transparent animationType="fade">
        <Pressable className="flex-1 bg-black/80 items-center justify-center p-6" onPress={() => setIsGenreDropdownOpen(false)}>
          <View className="bg-neutral-900 w-full max-w-sm rounded-2xl border border-neutral-800 p-6 overflow-hidden">
            <Text className="text-white font-bold text-lg mb-4 text-center">FILTER BY GENRE</Text>
            <ScrollView className="max-h-80">
              <Pressable
                onPress={() => { setGenreFilter(null); setIsGenreDropdownOpen(false); }}
                className="py-3 border-b border-neutral-800"
              >
                <Text className={`text-center font-mono ${genreFilter === null ? 'text-amber-500' : 'text-neutral-400'}`}>ALL GENRES</Text>
              </Pressable>
              {genres.map(g => (
                <Pressable
                  key={g}
                  onPress={() => {
                    setGenreFilter(g);
                    setIsGenreDropdownOpen(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className="py-3 border-b border-neutral-800"
                >
                  <Text className={`text-center font-mono ${genreFilter === g ? 'text-amber-500' : 'text-neutral-400'}`}>{g}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setIsGenreDropdownOpen(false)} className="mt-6 bg-neutral-800 py-3 rounded-lg">
              <Text className="text-white text-center font-bold">CLOSE</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
