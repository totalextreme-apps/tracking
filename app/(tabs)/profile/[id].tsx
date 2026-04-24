import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useProfile, useFollowers, useFollowing, useToggleFollow } from '@/hooks/useSocial';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/context/AuthContext';
import { MemberCard } from '@/components/MemberCard';
import { StatsSection } from '@/components/StatsSection';
import { StackCard } from '@/components/StackCard';
import { Ionicons } from '@expo/vector-icons';
import { getPosterUrl } from '@/lib/dummy-data';
import { StatusBar } from 'expo-status-bar';
import { OnDisplayCard } from '@/components/OnDisplayCard';

type TabType = 'on-display' | 'grails' | 'collection' | 'wishlist' | 'bin' | 'analytics';
export type SortOption = 'recent' | 'title' | 'release' | 'rating' | 'genre' | 'format';

export default function UserProfileScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { userId: currentUserId } = useAuth();
  const router = useRouter();

  const { data: profile, isLoading: profileLoading } = useProfile(id);
  const { data: followers } = useFollowers(id);
  const { data: following } = useFollowing(id);
  const { data: collection, isLoading: collectionLoading } = useCollection(id);
  
  const [activeTab, setActiveTab] = useState<TabType>('on-display');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'movie' | 'tv' | null>(null);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);

  const genres = useMemo(() => getGenres(collection), [collection]);
  const FORMAT_ORDER: Record<string, number> = { '4K': 5, 'Blu-ray': 4, 'BluRay': 4, 'DVD': 3, 'VHS': 2, 'Digital': 1 };

  const filterAndSortItems = (items: any[]) => {
    let result = [...(items || [])];

    if (searchQuery) {
       const q = searchQuery.toLowerCase();
       result = result.filter(item => 
         item.movies?.title?.toLowerCase().includes(q) || 
         item.shows?.name?.toLowerCase().includes(q) ||
         item.edition?.toLowerCase().includes(q)
       );
    }

    if (formatFilter && formatFilter !== 'ALL') {
      result = result.filter(item => {
        if (formatFilter === 'BOOTLEG') return item.is_bootleg;
        return item.format === formatFilter;
      });
    }

    if (genreFilter) {
      result = result.filter(item => (item.movies || item.shows)?.genres?.some((g: any) => g?.name === genreFilter));
    }

    if (mediaTypeFilter) {
      result = result.filter(item => item.media_type === mediaTypeFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      const mediaA = a.movies || a.shows;
      const mediaB = b.movies || b.shows;

      switch (sortBy) {
        case 'title':
          comparison = (mediaA?.title || mediaA?.name || '').localeCompare(mediaB?.title || mediaB?.name || '');
          break;
        case 'release':
          const dateA = mediaA?.release_date || mediaA?.first_air_date || '';
          const dateB = mediaB?.release_date || mediaB?.first_air_date || '';
          comparison = dateA.localeCompare(dateB);
          break;
        case 'rating':
          comparison = (a.rating || 0) - (b.rating || 0);
          break;
        case 'genre':
          const gA = mediaA?.genres?.[0]?.name || 'ZZZ';
          const gB = mediaB?.genres?.[0]?.name || 'ZZZ';
          comparison = gA.localeCompare(gB);
          break;
        case 'format':
          comparison = (FORMAT_ORDER[a.format] || 0) - (FORMAT_ORDER[b.format] || 0);
          break;
        case 'recent':
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  };

  const stackItems = (items: any[]) => {
    const sorted = filterAndSortItems(items);
    const stacks: any[][] = [];
    const seen = new Set();

    sorted.forEach((item: any) => {
      const itemId = item.movie_id || item.show_id;
      if (seen.has(itemId)) return;
      
      const itemGroup = sorted.filter((i: any) => (i.movie_id || i.show_id) === itemId);
      stacks.push(itemGroup);
      seen.add(itemId);
    });

    return stacks;
  };

  const onDisplayItems = filterAndSortItems(collection?.filter((item: any) => item.is_on_display) || []);
  const grails = filterAndSortItems(collection?.filter((item: any) => item.is_grail) || []);
  const stackedCollection = stackItems(collection?.filter((item: any) => item.status === 'owned') || []);
  const stackedWishlist = stackItems(collection?.filter((item: any) => item.status === 'wishlist') || []);
  const binItems = filterAndSortItems(collection?.filter((item: any) => item.for_sale || item.for_trade) || []);

  const toggleFollowMutation = useToggleFollow(currentUserId);
  const isFollowing = currentUserId && followers?.some((f: any) => f.follower_id === currentUserId);
  const isOwnProfile = currentUserId === id;

  const handleToggleFollow = () => {
    if (!currentUserId || !id || isOwnProfile) return;
    toggleFollowMutation.mutate({ targetUserId: id, isFollowing: !!isFollowing });
  };

  if (profileLoading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-black items-center justify-center p-6">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="text-white font-mono mt-4 font-bold">PROFILE CORRUPTED</Text>
        <Pressable onPress={() => router.back()} className="mt-4 bg-neutral-800 p-3 rounded">
          <Text className="text-white font-mono text-sm">GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const totalItems = collection?.length || 0;
  const totalGrails = collection?.filter((i: any) => i.is_grail).length || 0;
  const uniqueFormats = new Set(collection?.map((i: any) => i.format)).size || 0;

  return (
    <View className="flex-1 bg-neutral-950">
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      
      <View className="pt-16 pb-4 bg-black border-b border-neutral-800 flex-row items-center justify-between px-4">
        <Pressable 
          onPress={() => {
            if (from === 'community') {
              router.push('/(tabs)/community');
            } else if (fromStack) {
              router.push('/(tabs)/');
            } else {
              router.back();
            }
          }} 
          className="p-2"
        >
          <Ionicons name="arrow-back" size={24} color="#f59e0b" />
        </Pressable>
        <Text className="text-white font-bold text-lg font-mono uppercase" numberOfLines={1}>
          {profile.username ? `${profile.username} PROFILE` : 'PROFILE'}
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="items-center mt-6 px-4">
          <MemberCard
             userId={id}
             profile={profile}
             onEditPress={() => console.log('Edit profile pressed')}
             onAvatarPress={() => console.log('Avatar pressed')}
          />
          <Text className="text-amber-500 font-bold text-2xl font-mono mt-6">
            {profile.username || 'Anonymous User'}
          </Text>
          {profile.bio && (
            <Text className="text-neutral-400 font-mono text-center mt-3 px-6 text-sm leading-5">
              {profile.bio}
            </Text>
          )}

          {/* Preferences / Tags */}
          {(profile.movie_preferences?.length || profile.format_preferences?.length) && (
            <View className="flex-row flex-wrap justify-center gap-2 mt-4 px-6">
              {profile.movie_preferences?.map((pref: string) => (
                <View key={pref} className="bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded">
                  <Text className="text-amber-500 font-mono text-[8px] font-bold uppercase">{pref}</Text>
                </View>
              ))}
              {profile.format_preferences?.map((pref: string) => (
                <View key={pref} className="bg-neutral-800 border border-neutral-700 px-2 py-1 rounded">
                  <Text className="text-neutral-400 font-mono text-[8px] font-bold uppercase">{pref}</Text>
                </View>
              ))}
            </View>
          )}

          <View className="flex-row items-center gap-8 mt-6">
            <View className="items-center">
              <Text className="text-white font-bold text-lg font-mono">{totalItems}</Text>
              <Text className="text-neutral-600 font-mono text-xs">TITLES</Text>
            </View>
            <View className="items-center">
              <Text className="text-white font-bold text-lg font-mono">{followers?.length || 0}</Text>
              <Text className="text-neutral-600 font-mono text-xs">FOLLOWERS</Text>
            </View>
            <View className="items-center">
              <Text className="text-white font-bold text-lg font-mono">{following?.length || 0}</Text>
              <Text className="text-neutral-600 font-mono text-xs">FOLLOWING</Text>
            </View>
          </View>

          {!isOwnProfile && (
            <View className="flex-row gap-3 mt-8 px-6 w-full max-w-sm">
              <Pressable 
                onPress={handleToggleFollow}
                disabled={toggleFollowMutation.isPending}
                className={`flex-1 flex-row h-12 rounded-xl border-2 items-center justify-center ${isFollowing ? 'border-neutral-800 bg-neutral-900/40' : 'border-amber-500 bg-amber-500/10'}`}
              >
                <Ionicons 
                  name={isFollowing ? "person-remove-outline" : "person-add-outline"} 
                  size={16} 
                  color={isFollowing ? "#525252" : "#f59e0b"} 
                  className="mr-2"
                />
                <Text className={`font-mono font-bold text-xs tracking-tighter ${isFollowing ? 'text-neutral-500' : 'text-amber-500'}`}>
                  {isFollowing ? 'UNFOLLOW' : 'FOLLOW'}
                </Text>
              </Pressable>
              
              <Pressable 
                onPress={() => router.push(`/(tabs)/profile/chat/${id}`)}
                className="flex-1 flex-row h-12 rounded-xl border-2 border-neutral-800 bg-neutral-900 items-center justify-center gap-2"
              >
                <Ionicons name="chatbubbles-outline" size={16} color="#f59e0b" />
                <Text className="font-mono font-bold text-xs tracking-tighter text-amber-500">MESSAGE</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View className="flex-row border-b border-neutral-800 mt-8 mb-4">
          <Pressable onPress={() => setActiveTab('on-display')} className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'on-display' ? 'border-amber-500' : 'border-transparent'}`}>
            <Text className={`font-mono text-[10px] font-bold ${activeTab === 'on-display' ? 'text-amber-500' : 'text-neutral-500'}`}>ON DISPLAY</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('grails')} className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'grails' ? 'border-white' : 'border-transparent'}`}>
            <Text className={`font-mono text-[10px] font-bold ${activeTab === 'grails' ? 'text-white' : 'text-neutral-500'}`}>GRAILS</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('collection')} className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'collection' ? 'border-neutral-400' : 'border-transparent'}`}>
            <Text className={`font-mono text-[10px] font-bold ${activeTab === 'collection' ? 'text-neutral-200' : 'text-neutral-500'}`}>COLLECTION</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('wishlist')} className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'wishlist' ? 'border-pink-500' : 'border-transparent'}`}>
            <Text className={`font-mono text-[10px] font-bold ${activeTab === 'wishlist' ? 'text-pink-500' : 'text-neutral-500'}`}>WISHLIST</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('bin')} className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'bin' ? 'border-emerald-500' : 'border-transparent'}`}>
            <Text className={`font-mono text-[10px] font-bold ${activeTab === 'bin' ? 'text-emerald-500' : 'text-neutral-500'}`}>THE BIN</Text>
          </Pressable>
        </View>

        {activeTab !== 'analytics' && (
          <View className="px-4">
            <View className="mb-4">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {['ALL', 'VHS', 'DVD', 'BluRay', '4K', 'Digital', 'BOOTLEG'].map(f => {
                   const isSelected = f === 'ALL' ? formatFilter === null : formatFilter === f;
                   return (
                     <Pressable 
                       key={f} 
                       onPress={() => setFormatFilter(f === 'ALL' ? null : f)} 
                       className={`px-3 py-1 rounded-full border ${isSelected ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-900 border-neutral-800'}`}
                     >
                       <Text className={`font-mono text-[10px] uppercase font-bold ${isSelected ? 'text-amber-500' : 'text-neutral-500'}`}>{f === 'BluRay' ? 'Blu-ray' : f}</Text>
                     </Pressable>
                   );
                })}
              </ScrollView>
            </View>

            <View className="bg-neutral-900 mb-6 p-4 rounded-xl border border-neutral-800 z-50">
                <View className="flex-row items-center gap-2 mb-2 flex-wrap">
                  <Text className="text-neutral-500 font-mono text-[9px] uppercase tracking-tighter mr-1">SORT:</Text>
                  {[{ id: 'recent', label: 'RECENT' }, { id: 'title', label: 'NAME' }, { id: 'release', label: 'YEAR' }, { id: 'rating', label: 'RATING' }, { id: 'genre', label: 'GENRE' }].map((s: any) => (
                    <Pressable key={s.id} onPress={() => { if (sortBy === s.id) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy(s.id); setSortOrder(s.id === 'title' || s.id === 'release' ? 'asc' : 'desc'); } }} className={`px-2 py-1 rounded border flex-row items-center gap-1 ${sortBy === s.id ? 'bg-amber-500/10 border-amber-500/40' : 'bg-neutral-950 border-neutral-800'}`}>
                      <Text className={`font-mono text-[8px] font-bold ${sortBy === s.id ? 'text-amber-500' : 'text-neutral-500'}`}>{s.label}</Text>
                      {sortBy === s.id && <Ionicons name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} size={8} color="#f59e0b" />}
                    </Pressable>
                  ))}
                </View>

                <View className="flex-row items-center gap-2 mt-2 flex-wrap">
                  <Text className="text-neutral-500 font-mono text-[9px] uppercase tracking-tighter mr-1">FILTERS:</Text>
                  <View className="flex-row bg-neutral-950 rounded border border-neutral-800 p-0.5 mr-2">
                    <Pressable onPress={() => setMediaTypeFilter(null)} className={`px-2 py-1 rounded ${mediaTypeFilter === null ? 'bg-neutral-800' : ''}`}><Text className={`font-mono text-[8px] font-bold ${mediaTypeFilter === null ? 'text-amber-500' : 'text-neutral-500'}`}>ALL</Text></Pressable>
                    <Pressable onPress={() => setMediaTypeFilter('movie')} className={`px-2 py-1 rounded ${mediaTypeFilter === 'movie' ? 'bg-neutral-800' : ''}`}><Text className={`font-mono text-[8px] font-bold ${mediaTypeFilter === 'movie' ? 'text-amber-500' : 'text-neutral-500'}`}>FILM</Text></Pressable>
                    <Pressable onPress={() => setMediaTypeFilter('tv')} className={`px-2 py-1 rounded ${mediaTypeFilter === 'tv' ? 'bg-neutral-800' : ''}`}><Text className={`font-mono text-[8px] font-bold ${mediaTypeFilter === 'tv' ? 'text-amber-500' : 'text-neutral-500'}`}>TV</Text></Pressable>
                  </View>

                  <Pressable 
                       onPress={() => setIsGenreDropdownOpen(true)}
                       className={`flex-row items-center gap-2 px-2 py-1 rounded border bg-neutral-950 ${genreFilter ? 'border-amber-500/50' : 'border-neutral-800'}`}
                    >
                       <Text className="text-neutral-500 font-mono text-[8px] uppercase tracking-tighter">GENRE:</Text>
                       <Text className={`font-mono text-[8px] font-bold uppercase ${genreFilter ? 'text-amber-500' : 'text-neutral-500'}`}>
                          {genreFilter || 'ALL'}
                       </Text>
                       <Ionicons name="chevron-down" size={8} color={genreFilter ? "#f59e0b" : "#444"} />
                  </Pressable>
                </View>
            </View>

            <Modal visible={isGenreDropdownOpen} transparent animationType="fade" onRequestClose={() => setIsGenreDropdownOpen(false)}>
              <Pressable className="flex-1 bg-black/60 justify-center items-center p-6" onPress={() => setIsGenreDropdownOpen(false)}>
                <View className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm overflow-hidden" onPress={(e: any) => e.stopPropagation()}>
                  <View className="p-4 border-b border-neutral-800 flex-row justify-between items-center bg-neutral-950">
                    <Text className="text-amber-500 font-mono text-[10px] font-bold tracking-widest uppercase">Select Genre</Text>
                    <Pressable onPress={() => setIsGenreDropdownOpen(false)}><Ionicons name="close" size={18} color="#525252" /></Pressable>
                  </View>
                  <ScrollView style={{ maxHeight: 350 }}>
                    <Pressable onPress={() => { setGenreFilter(null); setIsGenreDropdownOpen(false); }} className={`px-5 py-3 border-b border-neutral-800/50 ${genreFilter === null ? 'bg-amber-500/10' : ''}`}><Text className={`font-mono text-[10px] font-bold ${genreFilter === null ? 'text-amber-500' : 'text-neutral-400'}`}>ALL GENRES</Text></Pressable>
                    {genres.map(g => (
                      <Pressable key={g} onPress={() => { setGenreFilter(g); setIsGenreDropdownOpen(false); }} className={`px-5 py-3 border-b border-neutral-800/50 ${genreFilter === g ? 'bg-amber-500/10' : ''}`}>
                        <Text className={`font-mono text-[10px] font-bold ${genreFilter === g ? 'text-amber-500' : 'text-neutral-400'}`}>{g}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </Pressable>
            </Modal>
          </View>
        )}

        <View className="px-4">
          {collectionLoading ? (
            <ActivityIndicator color="#f59e0b" className="mt-8" />
          ) : (
            <View>
              {activeTab === 'on-display' && (
                <View>
                  {onDisplayItems.length > 0 ? (
                    <View className="flex-row flex-wrap justify-between">
                      {onDisplayItems.map((item: any) => (
                        <View key={item.id} className="w-[31%] mb-4">
                          <OnDisplayCard 
                            item={item} 
                            scale={0.9} 
                            isReadOnly={id !== currentUserId}
                            onSingleTapAction={() => router.push({ pathname: item.movies ? `/movie/${item.movie_id}` as any : `/show/${item.show_id}` as any, params: { ownerId: id } })}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 items-center border-dashed">
                      <Text className="text-neutral-500 font-mono text-center">Nothing currently on display.</Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'grails' && (
                <View>
                  {grails.length > 0 ? (
                    <View className="flex-row flex-wrap justify-between">
                      {grails.map((item: any) => (
                        <View key={item.id} className="w-[31%] mb-4">
                          <OnDisplayCard 
                            item={item} 
                            scale={0.9} 
                            isReadOnly={id !== currentUserId}
                            onSingleTapAction={() => router.push({ pathname: item.movies ? `/movie/${item.movie_id}` as any : `/show/${item.show_id}` as any, params: { ownerId: id } })}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 items-center border-dashed">
                      <Text className="text-neutral-500 font-mono text-center">No Grails on display.</Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'collection' && (
                <View>
                  {stackedCollection.length > 0 ? (
                    <View className="flex-row flex-wrap">
                      {stackedCollection.map((stack: any) => (
                        <View key={stack[0].id} style={{ width: '25%', padding: 4 }}>
                          <StackCard 
                            stack={stack} 
                            width={80} 
                            height={120}
                            isReadOnly={id !== currentUserId}
                            onPress={() => {
                              const item = stack[0];
                              const isMovie = !!item.movies;
                              router.push({ 
                                pathname: isMovie ? `/movie/${item.movie_id}` as any : `/show/${item.show_id}` as any, 
                                params: { ownerId: id } 
                              });
                            }}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View className="p-6 items-center border-dashed border border-neutral-800 rounded-lg">
                      <Text className="text-neutral-500 font-mono text-center">Collection is empty.</Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'wishlist' && (
                <View>
                  {stackedWishlist.length > 0 ? (
                    <View className="flex-row flex-wrap">
                      {stackedWishlist.map((stack: any) => (
                        <View key={stack[0].id} style={{ width: '25%', padding: 4 }}>
                          <StackCard 
                            stack={stack} 
                            width={80} 
                            height={120}
                            isReadOnly={id !== currentUserId}
                            onPress={() => {
                              const item = stack[0];
                              const isMovie = !!item.movies;
                              router.push({ 
                                pathname: isMovie ? `/movie/${item.movie_id}` as any : `/show/${item.show_id}` as any, 
                                params: { ownerId: id } 
                              });
                            }}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View className="p-6 items-center border-dashed border border-neutral-800 rounded-lg">
                      <Text className="text-neutral-500 font-mono text-center">Wishlist is empty.</Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'bin' && (
                <View>
                  {binItems.length > 0 ? (
                    <View className="flex-row flex-wrap justify-between">
                      {binItems.map((item: any) => {
                        const posterUrl = getPosterUrl(item.movies?.poster_path || item.shows?.poster_path);
                        return (
                          <Pressable 
                            key={item.id} 
                            onPress={() => router.push({ pathname: item.movies ? `/movie/${item.movie_id}` as any : `/show/${item.show_id}` as any, params: { ownerId: id } })}
                            className="w-[48%] mb-4 bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800"
                          >
                            <View className="relative">
                              <Image source={{ uri: posterUrl as string }} className="w-full aspect-[2/3]" />
                              <View className="absolute top-2 left-2 flex-row gap-1">
                                {item.for_sale && (
                                  <View className="bg-emerald-500 px-2 py-0.5 rounded shadow-sm">
                                    <Text className="text-black font-mono text-[8px] font-bold">SALE</Text>
                                  </View>
                                )}
                                {item.for_trade && (
                                  <View className="bg-blue-500 px-2 py-0.5 rounded shadow-sm">
                                    <Text className="text-white font-mono text-[8px] font-bold">TRADE</Text>
                                  </View>
                                )}
                              </View>
                              {item.for_sale && item.price && (
                                <View className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded border border-emerald-500/30">
                                  <Text className="text-emerald-400 font-mono text-[10px] font-bold">${item.price}</Text>
                                </View>
                              )}
                            </View>
                            <View className="p-2">
                              <Text className="text-white font-mono text-[10px] font-bold" numberOfLines={1}>{item.movies?.title || item.shows?.name}</Text>
                              <Text className="text-neutral-500 font-mono text-[8px] uppercase">{item.format}</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <View className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 items-center border-dashed">
                      <Ionicons name="cart-outline" size={32} color="#262626" />
                      <Text className="text-neutral-500 font-mono text-center mt-2">The bin is empty.</Text>
                      <Text className="text-neutral-700 font-mono text-[9px] text-center mt-1">Designate items for sale or trade to see them here.</Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'analytics' && (
                <View>
                  <View className="flex-row gap-3 mb-6">
                    <View className="flex-1 bg-neutral-900 p-3 rounded-lg border border-neutral-800 items-center">
                      <Text className="text-2xl font-bold text-white font-mono">{totalItems}</Text>
                      <Text className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase mt-1">Movies</Text>
                    </View>
                    <View className="flex-1 bg-neutral-900 p-3 rounded-lg border border-neutral-800 items-center">
                      <Text className="text-2xl font-bold text-amber-500 font-mono">{totalGrails}</Text>
                      <Text className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase mt-1">Grails</Text>
                    </View>
                    <View className="flex-1 bg-neutral-900 p-3 rounded-lg border border-neutral-800 items-center">
                      <Text className="text-2xl font-bold text-white font-mono">{uniqueFormats}</Text>
                      <Text className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase mt-1">Formats</Text>
                    </View>
                  </View>
                  <StatsSection collection={collection} />
                </View>
              )}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}
