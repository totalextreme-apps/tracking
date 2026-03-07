import { ScrambledChannel } from '@/components/ScrambledChannel';
import { TrackingLoader } from '@/components/TrackingLoader';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, Stack, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';

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
import * as Sharing from 'expo-sharing';
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
  const [isSharing, setIsSharing] = useState(false);
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

  const handleShare = async () => {
    if (viewShotRef.current) {
      try {
        setIsSharing(true);
        // Add a small delay for UI state to reflect isSharing
        setTimeout(async () => {
          try {
            const uri = await (viewShotRef.current as any).capture();
            await Sharing.shareAsync(uri);
          } catch (err) {
            console.error('Capture/Share failed:', err);
            Alert.alert('Share Error', 'Failed to generate share image.');
          } finally {
            setIsSharing(false);
          }
        }, 150);
      } catch (e) {
        console.error('Failed to initiate share', e);
        setIsSharing(false);
      }
    }
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

  const navigateToDetail = (item: CollectionItemWithMedia) => {
    if (item.media_type === 'tv') {
      const showId = item.show_id || item.shows?.id;
      if (showId) {
        router.push({
          pathname: "/show/[id]",
          params: { id: showId, season: item.season_number || 1 }
        } as any);
      }
    } else {
      const movieId = item.movie_id || item.movies?.id;
      if (movieId) {
        router.push({
          pathname: "/movie/[id]",
          params: { id: movieId }
        } as any);
      }
    }
  };

  const onDisplay = thriftMode
    ? collection?.filter((item: any) => item && item.is_grail) ?? []
    : getOnDisplayItems(collection);

  const genres = getGenres(collection);
  const stacks = getStacks(collection, thriftMode, sortBy, sortOrder);

  let filteredStacks = stacks || [];
  if (searchQuery || formatFilter || genreFilter || mediaTypeFilter) {
    filteredStacks = filteredStacks.filter((stack: any) => {
      if (!stack || !stack[0]) return false;
      const media = stack[0].movies || stack[0].shows;
      if (!media) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
        const title = (stack[0].movies?.title || stack[0].shows?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchesTitle = title.includes(query);
        const cast = (stack[0].movies?.movie_cast || stack[0].shows?.show_cast || []);
        const matchesCast = cast.some((c: any) => c?.name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(query));
        if (!matchesTitle && !matchesCast) return false;
      }
      if (formatFilter) {
        if (formatFilter === 'BOOTLEG') {
          if (!stack.some((item: any) => item?.is_bootleg)) return false;
        } else {
          if (!stack.some((item: any) => item?.format === formatFilter)) return false;
        }
      }
      if (genreFilter) {
        if (!media.genres?.some((g: any) => g?.name === genreFilter)) return false;
      }
      if (mediaTypeFilter && stack[0].media_type !== mediaTypeFilter) return false;
      return true;
    });
  }

  const hasCollection = (collection?.length ?? 0) > 0;
  const isEmpty = !hasCollection && onDisplay.length === 0;

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
        <Pressable onPress={onRefresh} className="bg-neutral-900 px-6 py-3 rounded-md mt-8 border border-neutral-800 active:bg-neutral-800">
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
        <Pressable onPress={onRefresh} className="bg-neutral-900 border border-neutral-800 px-8 py-3 rounded active:bg-neutral-800">
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
        <Pressable onPress={onRefresh} className="bg-neutral-900 px-6 py-3 rounded-md mt-6 border border-neutral-800">
          <Text className="text-white font-mono text-xs uppercase tracking-widest">RETRY FETCH</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-950">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />
        }
      >
        <View className="w-full">
          {/* Header/Search Bar */}
          <View className="pt-4 pb-4 border-b border-neutral-900 px-4 md:px-8 max-w-7xl mx-auto w-full">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center bg-neutral-950 rounded-full p-1 flex-1 mr-4">
                <Pressable
                  onPress={() => { setMediaTypeFilter(null); playSound('click'); }}
                  className={`px-4 py-2 rounded-full ${mediaTypeFilter === null ? 'bg-neutral-800' : ''}`}
                >
                  <Text className={`font-bold text-xs ${mediaTypeFilter === null ? 'text-amber-500' : 'text-neutral-500'}`}>ALL</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setMediaTypeFilter('movie'); playSound('click'); }}
                  className={`px-4 py-2 rounded-full ${mediaTypeFilter === 'movie' ? 'bg-neutral-800' : ''}`}
                >
                  <Text className={`font-bold text-xs ${mediaTypeFilter === 'movie' ? 'text-amber-500' : 'text-neutral-500'}`}>FILM</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setMediaTypeFilter('tv'); playSound('click'); }}
                  className={`px-4 py-2 rounded-full ${mediaTypeFilter === 'tv' ? 'bg-neutral-800' : ''}`}
                >
                  <Text className={`font-bold text-xs ${mediaTypeFilter === 'tv' ? 'text-amber-500' : 'text-neutral-500'}`}>TV</Text>
                </Pressable>
              </View>

              <View className="flex-row items-center bg-neutral-900 rounded-lg border border-neutral-800 px-4 py-2.5 flex-1 ml-2">
                <Ionicons name="search" size={16} color="#444" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="SEARCH..."
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
              {['VHS', 'DVD', 'BluRay', '4K', 'BOOTLEG'].map(f => {
                const isSelected = formatFilter === f;
                const formatColor = f === 'VHS' ? 'bg-red-600/20 border-red-600/40' :
                  f === 'DVD' ? 'bg-purple-600/20 border-purple-600/40' :
                    f === 'BluRay' ? 'bg-blue-600/20 border-blue-600/40' :
                      f === '4K' ? 'bg-yellow-600/20 border-yellow-600/40' :
                        f === 'BOOTLEG' ? 'bg-orange-600/20 border-orange-600/40' :
                          'bg-neutral-900 border-neutral-800';
                const textStyle = isSelected ? 'text-amber-500' :
                  f === 'VHS' ? 'text-red-500' :
                    f === 'DVD' ? 'text-purple-400' :
                      f === 'BluRay' ? 'text-blue-400' :
                        f === '4K' ? 'text-yellow-400' :
                          f === 'BOOTLEG' ? 'text-orange-400' :
                            'text-neutral-500';

                return (
                  <Pressable
                    key={f}
                    onPress={() => { setFormatFilter(isSelected ? null : f); playSound('click'); }}
                    className={`px-4 py-1.5 rounded-full border ${isSelected ? 'bg-amber-500/20 border-amber-500/50' : formatColor}`}
                  >
                    <Text className={`font-mono text-[10px] uppercase font-bold ${textStyle}`}>{f}</Text>
                  </Pressable>
                );
              })}

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
                <View className="px-4 md:px-8 flex-row items-center justify-between mb-2 max-w-7xl mx-auto w-full">
                  <View className="flex-row items-baseline gap-2">
                    <Text className="text-amber-500 font-bold text-3xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>
                      {thriftMode ? 'GRAILS' : 'ON DISPLAY'}
                    </Text>
                    <Text className="text-neutral-600 font-mono text-xs opacity-50 ml-1">/ {onDisplay.length}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => { handleShare(); playSound('click'); }}
                      className={`p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800 mr-2 ${isSharing ? 'opacity-50' : ''}`}
                      disabled={isSharing}
                    >
                      <Ionicons name={isSharing ? "hourglass-outline" : "share-outline"} size={16} color="#f59e0b" />
                    </Pressable>
                    <Pressable onPress={scrollShelfLeft} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800">
                      <Ionicons name="chevron-back" size={16} color="#f59e0b" />
                    </Pressable>
                    <Pressable onPress={scrollShelfRight} className="p-2 bg-neutral-900 rounded-full border border-neutral-800 active:bg-neutral-800">
                      <Ionicons name="chevron-forward" size={16} color="#f59e0b" />
                    </Pressable>
                  </View>
                </View>

                <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }} style={{ backgroundColor: '#0a0a0a' }}>
                  <View className="relative">
                    <Image
                      source={thriftMode ? require('@/assets/images/thrift_background.png') : require('@/assets/images/shelf_background.png')}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.8 }}
                      contentFit="cover"
                    />
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
                          onLongPressAction={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setAcquiredItem(item); }}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </ScrollView>
                  </View>
                </ViewShot>
              </View>
            )}

            <View className="px-4 md:px-8 pb-4 max-w-7xl mx-auto w-full">
              <View className="flex-row items-center justify-between mb-6">
                <View className="flex-row items-baseline gap-2">
                  <Text className="text-amber-500 font-bold text-3xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>
                    {thriftMode ? 'WISH LIST' : 'THE STACKS'}
                  </Text>
                  <Text className="text-neutral-600 font-mono text-xs opacity-50 ml-1">
                    / {thriftMode ? collection?.filter((i: any) => i.status === 'wishlist').length : filteredStacks.length}
                  </Text>
                </View>

                <View className="flex-row bg-neutral-900 rounded-md p-1 border border-neutral-800">
                  <Pressable
                    onPress={() => { setViewMode('list'); playSound('click'); }}
                    className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-neutral-800' : ''}`}
                  >
                    <Ionicons name="list-outline" size={14} color={viewMode === 'list' ? '#fff' : '#666'} />
                  </Pressable>
                  <Pressable
                    onPress={() => { setViewMode('grid2'); setNumColumns(2); playSound('click'); }}
                    className={`p-1.5 rounded ${viewMode === 'grid2' || (viewMode === 'custom' && numColumns === 2) ? 'bg-neutral-800' : ''}`}
                  >
                    <Ionicons name="apps-outline" size={14} color={(viewMode === 'grid2' || (viewMode === 'custom' && numColumns === 2)) ? '#fff' : '#666'} />
                  </Pressable>
                  <Pressable
                    onPress={() => { setViewMode('grid4'); setNumColumns(4); playSound('click'); }}
                    className={`p-1.5 rounded ${viewMode === 'grid4' || (viewMode === 'custom' && numColumns === 4) ? 'bg-neutral-800' : ''}`}
                  >
                    <Ionicons name="grid-outline" size={14} color={(viewMode === 'grid4' || (viewMode === 'custom' && numColumns === 4)) ? '#fff' : '#666'} />
                  </Pressable>
                </View>
              </View>

              <View className="bg-neutral-900 mb-8 p-4 rounded-xl border border-neutral-800">
                <View className="flex-row items-center gap-2 mb-6 flex-wrap">
                  <Text className="text-neutral-500 font-mono text-[10px] uppercase tracking-tighter mr-1">SORT:</Text>
                  {[
                    { id: 'recent', label: 'RECENT' },
                    { id: 'title', label: 'NAME' },
                    { id: 'release', label: 'YEAR' },
                    { id: 'rating', label: 'RATING' }
                  ].map((s: any) => (
                    <Pressable
                      key={s.id}
                      onPress={() => {
                        if (sortBy === s.id) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy(s.id);
                          setSortOrder(s.id === 'title' || s.id === 'release' ? 'asc' : 'desc');
                        }
                        playSound('click');
                      }}
                      className={`px-3 py-1.5 rounded border flex-row items-center gap-1.5 ${sortBy === s.id ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-950 border-neutral-800'}`}
                    >
                      <Text className={`font-mono text-[10px] font-bold ${sortBy === s.id ? 'text-amber-500' : 'text-neutral-500'}`}>
                        {s.label}
                      </Text>
                      {sortBy === s.id && (
                        <Ionicons name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} size={10} color="#f59e0b" />
                      )}
                    </Pressable>
                  ))}
                </View>

                <View className="flex-row justify-between mb-2">
                  <Text className="text-neutral-400 font-mono text-[9px] tracking-widest">DENSITY: {numColumns} COLUMNS</Text>
                  <Pressable onPress={() => { setNumColumns(2); setViewMode('grid2'); playSound('click'); }}>
                    <Text className="text-amber-500/50 font-mono text-[9px]">RESET</Text>
                  </Pressable>
                </View>
                <Slider
                  style={{ width: '100%', height: 30 }}
                  minimumValue={1}
                  maximumValue={isDesktop ? 8 : 4}
                  step={1}
                  value={numColumns}
                  onValueChange={(val) => {
                    setNumColumns(val);
                    setViewMode('custom');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  minimumTrackTintColor="#f59e0b"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#f59e0b"
                />
              </View>

              {isEmpty ? (
                <EmptyState />
              ) : (
                <View className="flex-row flex-wrap" style={{ marginHorizontal: -10 }}>
                  {filteredStacks.map((stack: any) => {
                    if (!stack || !stack[0]) return null;
                    const topItem = stack[0];
                    return (
                      <View
                        key={topItem.id}
                        style={{
                          width: `${100 / resolvedColumns}%`,
                          paddingHorizontal: 10,
                          marginBottom: 32
                        }}
                      >
                        <StackCard
                          stack={stack}
                          onPress={() => navigateToDetail(topItem)}
                          onToggleFavorite={toggleFavorite}
                          onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setAcquiredItem(topItem); }}
                          width={(windowWidth - 48 - (resolvedColumns * 20)) / resolvedColumns}
                          mode={viewMode === 'list' ? 'list' : 'grid'}
                        />
                        {viewMode !== 'list' && (
                          <View className="mt-3">
                            <Text
                              className="text-white font-medium text-[11px] uppercase tracking-wide"
                              numberOfLines={1}
                              style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                              {topItem.movies?.title || topItem.shows?.name}
                            </Text>
                            {topItem.media_type === 'tv' && (
                              <Text className="text-neutral-500 font-mono text-[9px] mt-0.5">
                                SEASON {topItem.season_number}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {acquiredItem && (
        <AcquiredModal
          item={acquiredItem}
          visible={!!acquiredItem}
          onClose={() => setAcquiredItem(null)}
          onAcquired={async () => {
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
          }}
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
