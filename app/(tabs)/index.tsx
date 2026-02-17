import { TrackingLoader } from '@/components/TrackingLoader';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { AcquiredModal } from '@/components/AcquiredModal'; // Restore Component
import { EmptyState } from '@/components/EmptyState';
import { OnDisplayCard } from '@/components/OnDisplayCard';
import { ShareableShelf } from '@/components/ShareableShelf';
import { StackCard } from '@/components/StackCard';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { useCollection, useUpdateCollectionItem } from '@/hooks/useCollection';
import { getGenres, getOnDisplayItems, getStacks } from '@/lib/collection-utils';
import { supabase } from '@/lib/supabase'; // Restore Supabase
import type { CollectionItemWithMovie } from '@/types/database';
import { Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import { useRef } from 'react';
import { Modal } from 'react-native';
import ViewShot from 'react-native-view-shot';

export default function HomeScreen() {
  const { userId, isLoading: authLoading } = useAuth();
  const { thriftMode } = useThriftMode();
  const { playSound } = useSound();
  // Ensure refetch is destructured
  // Using 'any' cast for useCollection result to prevent strict typing issues with refetch if definitions mismatch
  const { data: collection, isLoading: collectionLoading, refetch } = useCollection(userId) as any;
  const updateMutation = useUpdateCollectionItem(userId);
  const [acquiredItem, setAcquiredItem] = useState<CollectionItemWithMovie | null>(null);
  const router = useRouter();

  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'release' | 'rating'>('recent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'list' | 'grid2' | 'grid4'>('grid2');
  const { width: windowWidth } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  // Rewind State
  const [refreshing, setRefreshing] = useState(false);
  const [showRewind, setShowRewind] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setShowRewind(true);
    // Play rewind sound
    const { sound } = await Audio.Sound.createAsync(require('@/assets/sounds/rewind.mp3'));
    await sound.playAsync();

    // Haptics
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      if (refetch) refetch();
      setShowRewind(false);
      setRefreshing(false);
      sound.unloadAsync();
    }, 1500);
  };


  const handleSort = (option: 'recent' | 'title' | 'release' | 'rating') => {
    if (sortBy === option) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      playSound('click');
    } else {
      setSortBy(option);
      // Default orders: Title -> ASC, others -> DESC
      setSortOrder(option === 'title' ? 'asc' : 'desc');
      playSound('click');
    }
  };

  const onDisplay = getOnDisplayItems(collection);
  const genres = getGenres(collection);
  const stacks = getStacks(collection, thriftMode, sortBy, sortOrder);

  // Filter Logic
  let filteredStacks = stacks || [];
  try {
    if (searchQuery || formatFilter || genreFilter) {
      filteredStacks = filteredStacks.filter((stack: any) => {
        const movie = stack[0]?.movies;
        if (!movie) return false;

        if (searchQuery) {
          if (!movie.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        }
        if (formatFilter) {
          if (!stack.some((i: any) => i.format === formatFilter)) return false;
        }
        if (genreFilter) {
          const movieGenres = movie.genres?.map((g: any) => g.name) ?? [];
          console.log(`Filtering ${movie.title}: movieGenres=${JSON.stringify(movieGenres)}, filter=${genreFilter}`);
          if (!movieGenres.includes(genreFilter)) return false;
        }
        return true;
      });
    }
  } catch (e) {
    console.error('Filter error', e);
  }

  // On Display Logic:
  // Standard Mode: random selection of "is_on_display" items.
  // Thrift Mode: ONLY items that are "is_grail" AND "wishlist".
  const displayItems = thriftMode
    ? collection?.filter(i => i.status === 'wishlist' && i.is_grail) ?? []
    : getOnDisplayItems(collection);

  const hasCollection = (collection?.length ?? 0) > 0;
  const isEmpty = !hasCollection && displayItems.length === 0;

  const handleAcquiredPress = (item: CollectionItemWithMovie) => {
    setAcquiredItem(item);
  };

  const handleAcquired = async () => {
    if (!acquiredItem) return;
    try {
      await updateMutation.mutateAsync({
        itemId: acquiredItem.id,
        updates: { status: 'owned' },
      });
      setAcquiredItem(null);
      if (refetch) refetch();
    } catch (e) {
      console.error('Error acquiring item:', e);
      alert('Failed to acquire item');
    }
  };

  const handleToggleFavorite = async (item: CollectionItemWithMovie) => {
    try {
      await updateMutation.mutateAsync({
        itemId: item.id,
        updates: { is_on_display: !item.is_on_display },
      });
    } catch (e) {
      Alert.alert('Could not update favorite', (e as Error).message);
    }
  };

  const handleToggleGrail = async (item: CollectionItemWithMovie) => {
    try {
      const isGrail = !item.is_grail;

      // Using 'as any' to bypass the build error "Argument of type ... not assignable to never"
      const { error } = await supabase
        .from('collection_items')
        .update({ is_grail: isGrail } as any)
        .eq('id', item.id);

      if (error) throw error;

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Force Refetch to ensure UI updates
      if (refetch) refetch();

    } catch (e) {
      console.error('Error toggling grail:', e);
      alert('Failed to update grail status');
    }
  };

  if (authLoading || (userId && collectionLoading && !thriftMode)) {
    return (
      <View className="flex-1 bg-neutral-950 items-center justify-center">
        <TrackingLoader />
      </View>
    );
  }

  return (
    <>
      <AcquiredModal
        visible={!!acquiredItem}
        item={acquiredItem}
        onClose={() => setAcquiredItem(null)}
        onAcquired={handleAcquired}
        isPending={updateMutation.isPending}
      />

      <ScrollView
        className="flex-1 bg-neutral-950"
        contentContainerStyle={{
          paddingBottom: 120, // INCREASED padding to clear the 100px tab bar
          paddingHorizontal: isEmpty ? 0 : 16,
          flexGrow: 1
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f59e0b" // Amber
            title="REWINDING..."
            titleColor="#f59e0b"
          />
        }
      >
        {/* Header Share Button */}
        {!isEmpty && (
          <Pressable
            onPress={() => setShowShareModal(true)}
            className="absolute top-14 right-4 z-50 bg-black/50 p-2 rounded-full border border-white/10"
          >
            <FontAwesome name="share-square-o" size={18} color="white" />
          </Pressable>
        )}

        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            <View className="pt-12 pb-10 relative">
              <Image
                source={thriftMode
                  ? require('@/assets/images/thrift_background.png')
                  : require('@/assets/images/shelf_background.png')
                }
                style={{
                  position: 'absolute',
                  top: 0,
                  left: -16,
                  right: -16,
                  bottom: 0,
                  opacity: 0.5,
                }}
                contentFit="cover"
                pointerEvents="none" // Ensure background doesn't steal touches
              />
              <Text className="text-amber-500/90 font-mono text-sm font-bold tracking-widest mb-3 px-4">
                {thriftMode ? 'GRAILS' : 'ON DISPLAY'}
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ zIndex: 10 }}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  // alignItems: 'center', // Removed to prevent vertical clipping of scaled items
                  paddingTop: 10, // Additional internal padding
                  paddingBottom: 20 // Additional internal padding
                }}
              >
                {displayItems.map((item: any) => (
                  <OnDisplayCard
                    key={item.id}
                    item={item}
                    scale={1.2}
                    onSingleTapAction={() => {
                      playSound('click');
                      router.push(`/movie/${item.movie_id}`);
                    }}
                    onLongPressAction={thriftMode ? () => {
                      handleAcquiredPress(item);
                    } : undefined}
                    onToggleFavorite={(item: any) => {
                      if (thriftMode) {
                        handleToggleGrail(item);
                      } else {
                        handleToggleFavorite(item);
                      }
                      playSound('click');
                    }}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Divider */}
            <View className="h-px bg-neutral-800" />
            <View className="h-px opacity-30 -mt-px" style={{ backgroundColor: 'rgba(0,255,136,0.2)' }} />

            {/* Search Bar (Simplified Re-implementation could go here, omitting for safety in this critical step if not needed, but user uses it. I will restore basic search UI) */}
            {/* Minimal Search & Filter UI Restoration */}
            <View className="mt-6 mb-2">
              <View className="flex-row items-center bg-neutral-900 rounded-lg px-3 py-2 border border-neutral-800">
                <FontAwesome name="search" size={14} color="#737373" />
                <TextInput
                  className="flex-1 ml-2 font-mono text-white text-sm"
                  placeholder="Search collection..."
                  placeholderTextColor="#737373"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <FontAwesome name="times-circle" size={14} color="#737373" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Format Filters - Ensure scrollable */}
            <View className="h-10 mb-4">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="pl-4"
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {['VHS', 'DVD', 'BluRay', '4K', 'Digital'].map((fmt) => (
                  <Pressable
                    key={fmt}
                    onPress={() => {
                      setFormatFilter(prev => prev === fmt ? null : fmt);
                      playSound('click');
                    }}
                    className={`px-4 py-2 mr-3 rounded-full border ${formatFilter === fmt
                      ? 'bg-amber-500 border-amber-500'
                      : 'bg-neutral-900 border-neutral-800'
                      }`}
                  >
                    <Text className={`font-mono text-xs ${formatFilter === fmt ? 'text-black font-bold' : 'text-neutral-400'}`}>
                      {fmt}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Genre Filter Dropdown Trigger */}
            <View className="px-4 mb-4 z-50">
              <Pressable
                onPress={() => {
                  setIsGenreDropdownOpen(!isGenreDropdownOpen);
                  playSound('click');
                }}
                className={`flex-row justify-between items-center px-4 py-2 rounded-lg border ${genreFilter
                  ? 'bg-amber-900/40 border-amber-500'
                  : 'bg-neutral-900 border-neutral-800'
                  }`}
              >
                <Text className={`font-mono text-xs ${genreFilter ? 'text-amber-500' : 'text-neutral-400'}`}>
                  {genreFilter || 'All Genres'}
                </Text>
                <FontAwesome name={isGenreDropdownOpen ? 'chevron-up' : 'chevron-down'} size={12} color={genreFilter ? '#f59e0b' : '#737373'} />
              </Pressable>

              {/* Dropdown Menu */}
              {isGenreDropdownOpen && (
                <View className="absolute top-full left-4 right-4 mt-1 bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden shadow-lg z-50" style={{ maxHeight: 200 }}>
                  <ScrollView nestedScrollEnabled className="max-h-48">
                    <Pressable
                      onPress={() => {
                        setGenreFilter(null);
                        setIsGenreDropdownOpen(false);
                        playSound('click');
                      }}
                      className="px-4 py-3 border-b border-neutral-800"
                    >
                      <Text className="text-neutral-400 font-mono text-xs">All Genres</Text>
                    </Pressable>
                    {genres.map((genre: any) => (
                      <Pressable
                        key={genre}
                        onPress={() => {
                          setGenreFilter(genre);
                          setIsGenreDropdownOpen(false);
                          playSound('click');
                        }}
                        className={`px-4 py-3 border-b border-neutral-800 ${genreFilter === genre ? 'bg-amber-900/20' : ''}`}
                      >
                        <Text className={`font-mono text-xs ${genreFilter === genre ? 'text-amber-500 font-bold' : 'text-neutral-300'}`}>
                          {genre}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Sort Options */}
            <View className="h-10 mb-6">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="pl-4"
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {[
                  { id: 'recent', label: 'Recent' },
                  { id: 'title', label: 'A-Z' },
                  { id: 'release', label: 'Year' },
                  ...(thriftMode ? [] : [{ id: 'rating', label: 'Rated' }]),
                ].map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => handleSort(opt.id as any)}
                    className={`px-3 py-1.5 mr-2 rounded-lg border flex-row items-center gap-1 ${sortBy === opt.id
                      ? 'bg-neutral-800 border-neutral-700'
                      : 'bg-transparent border-transparent'
                      }`}
                  >
                    <Text className={`font-mono text-[10px] ${sortBy === opt.id ? 'text-amber-500 font-bold' : 'text-neutral-500'}`}>
                      {opt.label.toUpperCase()}
                    </Text>
                    {sortBy === opt.id && (
                      <FontAwesome
                        name={sortOrder === 'asc' ? 'caret-up' : 'caret-down'}
                        size={10}
                        color="#f59e0b"
                      />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>



            <View className="pb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-amber-500/90 font-mono text-sm font-bold tracking-widest">
                  {thriftMode ? 'WISHLIST' : 'THE STACKS'}
                </Text>

                {/* View Mode Toggle */}
                <View className="flex-row bg-neutral-900 rounded-lg p-1 border border-neutral-800">
                  <Pressable
                    onPress={() => { setViewMode('list'); playSound('click'); }}
                    className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-neutral-800' : ''}`}
                  >
                    <FontAwesome name="list" size={14} color={viewMode === 'list' ? '#f59e0b' : '#525252'} />
                  </Pressable>
                  <Pressable
                    onPress={() => { setViewMode('grid2'); playSound('click'); }}
                    className={`p-1.5 rounded ${viewMode === 'grid2' ? 'bg-neutral-800' : ''}`}
                  >
                    <FontAwesome name="th-large" size={14} color={viewMode === 'grid2' ? '#f59e0b' : '#525252'} />
                  </Pressable>
                  <Pressable
                    onPress={() => { setViewMode('grid4'); playSound('click'); }}
                    className={`p-1.5 rounded ${viewMode === 'grid4' ? 'bg-neutral-800' : ''}`}
                  >
                    <FontAwesome name="th" size={14} color={viewMode === 'grid4' ? '#f59e0b' : '#525252'} />
                  </Pressable>
                </View>
              </View>

              {/* Show Empty State if Filtering Yields No Results */}
              {filteredStacks.length === 0 ? (
                <View className="px-4">
                  <EmptyState />
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {filteredStacks.map((stack: any, idx: number) => {
                    // Adjust width based on View Mode
                    let itemWidth = (windowWidth - 48) / 2; // grid2 default

                    if (viewMode === 'grid4') {
                      itemWidth = (windowWidth - 64) / 4;
                    } else if (viewMode === 'list') {
                      itemWidth = windowWidth - 32;
                    }



                    // Fix for List Mode Height
                    const itemHeight = viewMode === 'list'
                      ? 76 // Slender height for List Mode
                      : itemWidth * 1.5;

                    return (
                      <View key={idx} style={{ width: itemWidth, marginBottom: viewMode === 'list' ? 8 : 16 }}>
                        <StackCard
                          stack={stack}
                          mode={viewMode === 'list' ? 'list' : 'grid'} // Pass mode prop
                          onAcquiredPress={thriftMode ? handleAcquiredPress : undefined}
                          onLongPress={thriftMode ? handleAcquiredPress : undefined}
                          onToggleFavorite={thriftMode ? handleToggleGrail : handleToggleFavorite}
                          onPress={() => router.push(`/movie/${stack[0].movie_id}`)}
                          width={itemWidth}
                          height={itemHeight}
                          // Lower offset for tighter grids
                          stackOffset={viewMode === 'grid4' ? 2 : 4}
                        />
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View className="flex-1 bg-black/90 items-center justify-center p-4">
          <Text className="text-white font-mono text-lg mb-8">SHARE ON DISPLAY</Text>

          {/* We capture the On Display card of the first item for now as a demo, 
                    or ideally we'd capture the whole shelf. 
                    Capturing the whole shelf is hard because it's in a ScrollView.
                    For now, let's share a 'Card' representation of the first On Display item.
                */}
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
            {displayItems.length > 0 ? (
              <ShareableShelf
                items={displayItems}
                mode={thriftMode ? 'thrift' : 'display'}
              />
            ) : (
              <View className="p-4 bg-neutral-800"><Text className="text-white">Nothing to share</Text></View>
            )}
          </ViewShot>

          <View className="flex-row gap-4 mt-8">
            <Pressable
              onPress={() => setShowShareModal(false)}
              className="bg-neutral-800 px-6 py-3 rounded-full border border-neutral-700"
            >
              <Text className="text-white font-mono">Close</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                if (viewShotRef.current?.capture) {
                  try {
                    const uri = await viewShotRef.current.capture();
                    await Sharing.shareAsync(uri);
                  } catch (e) {
                    Alert.alert('Error', 'Could not share image');
                  }
                }
              }}
              className="bg-amber-600 px-6 py-3 rounded-full"
            >
              <Text className="text-white font-mono font-bold">Share Image</Text>
            </Pressable>
          </View>
        </View>
      </Modal>


      {/* REWIND OVERLAY */}
      {
        showRewind && (
          <View className="absolute inset-0 z-[100] bg-[#0000AA] items-center justify-center">
            {/* Scanlines */}
            <View className="absolute inset-0 opacity-20" style={{
              backgroundImage: 'linear-gradient(transparent 50%, black 50%)',
              backgroundSize: '100% 4px'
            }} />
            {/* Using simply repeated views for native scanlines if web gradient fails */}
            {/* Text */}
            <Text className="text-white font-mono text-4xl font-bold tracking-widest animate-pulse">
              {'<< REWIND'}
            </Text>
            <Text className="text-white font-mono text-xl mt-4">
              TRACKING...
            </Text>
          </View>
        )
      }
    </>
  );
}
