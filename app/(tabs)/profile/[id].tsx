import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
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

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId: currentUserId } = useAuth();
  const router = useRouter();

  const { data: profile, isLoading: profileLoading } = useProfile(id);
  const { data: followers } = useFollowers(id);
  const { data: following } = useFollowing(id);
  const { data: collection, isLoading: collectionLoading } = useCollection(id);
  
  const [activeTab, setActiveTab] = useState<'grails' | 'collection' | 'wishlist' | 'analytics'>('grails');
  const [sortBy, setSortBy] = useState<'added' | 'name' | 'format' | 'year'>('added');

  const sortedCollection = useMemo(() => {
    if (!collection) return [];
    let items = [...collection];
    if (sortBy === 'name') {
      items.sort((a, b) => (a.movies?.title || a.shows?.name || '').localeCompare(b.movies?.title || b.shows?.name || ''));
    } else if (sortBy === 'format') {
      items.sort((a, b) => (a.format || '').localeCompare(b.format || ''));
    } else if (sortBy === 'year') {
      items.sort((a, b) => {
        const yearA = a.movies?.release_date || a.shows?.first_air_date || '0000';
        const yearB = b.movies?.release_date || b.shows?.first_air_date || '0000';
        return yearB.localeCompare(yearA);
      });
    }
    return items;
  }, [collection, sortBy]);

  const stackedCollection = useMemo(() => {
    const owned = sortedCollection.filter((i: any) => i.status === 'owned');
    const stacks: Record<string, any[]> = {};
    owned.forEach(item => {
      const key = item.movies ? `movie-${item.movie_id}` : `show-${item.show_id}-${item.season_number || 1}`;
      if (!stacks[key]) stacks[key] = [];
      stacks[key].push(item);
    });
    return Object.values(stacks);
  }, [sortedCollection]);

  const stackedWishlist = useMemo(() => {
    const wishlist = sortedCollection.filter((i: any) => i.status === 'wishlist');
    const stacks: Record<string, any[]> = {};
    wishlist.forEach(item => {
      const key = item.movies ? `movie-${item.movie_id}` : `show-${item.show_id}-${item.season_number || 1}`;
      if (!stacks[key]) stacks[key] = [];
      stacks[key].push(item);
    });
    return Object.values(stacks);
  }, [sortedCollection]);

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

  const grails = collection?.filter((item: any) => item.is_grail) || [];
  const totalItems = collection?.length || 0;
  const totalGrails = grails.length;
  const uniqueFormats = new Set(collection?.map((i: any) => i.format)).size || 0;

  return (
    <View className="flex-1 bg-neutral-950">
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header Area */}
      <View className="pt-16 pb-4 bg-black border-b border-neutral-800 flex-row items-center justify-between px-4">
        <Pressable onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#f59e0b" />
        </Pressable>
        <Text className="text-white font-bold text-lg font-mono uppercase" numberOfLines={1}>
          {profile.username ? `${profile.username} PROFILE` : 'PROFILE'}
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 60 }}>
        {/* User Card */}
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
            <Text className="text-neutral-400 font-mono text-center mt-2 px-6">
              {profile.bio}
            </Text>
          )}

          {/* Social Stats */}
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

          {/* Follow Button */}
          {!isOwnProfile && (
            <Pressable 
              onPress={handleToggleFollow}
              disabled={toggleFollowMutation.isPending}
              className={`mt-6 px-10 py-3 rounded-full border-2 ${isFollowing ? 'border-neutral-700 bg-transparent' : 'border-amber-500 bg-amber-500/20'}`}
            >
              <Text className={`font-mono font-bold text-sm ${isFollowing ? 'text-neutral-400' : 'text-amber-500'}`}>
                {isFollowing ? 'UNFOLLOW' : 'FOLLOW'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Profile Tabs Config */}
        <View className="flex-row border-b border-neutral-800 mt-8 mb-4">
          <Pressable 
            onPress={() => setActiveTab('grails')} 
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'grails' ? 'border-amber-500' : 'border-transparent'}`}
          >
            <Text className={`font-mono text-[10px] font-bold ${activeTab === 'grails' ? 'text-amber-500' : 'text-neutral-500'}`}>GRAILS</Text>
          </Pressable>
          <Pressable 
            onPress={() => setActiveTab('collection')} 
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'collection' ? 'border-white' : 'border-transparent'}`}
          >
            <Text className={`font-mono text-[10px] font-bold ${activeTab === 'collection' ? 'text-white' : 'text-neutral-500'}`}>COLLECTION</Text>
          </Pressable>
          <Pressable 
            onPress={() => setActiveTab('wishlist')} 
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'wishlist' ? 'border-pink-500' : 'border-transparent'}`}
          >
            <Text className={`font-mono text-[10px] font-bold ${activeTab === 'wishlist' ? 'text-pink-500' : 'text-neutral-500'}`}>WISHLIST</Text>
          </Pressable>
          <Pressable 
            onPress={() => setActiveTab('analytics')} 
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'analytics' ? 'border-blue-500' : 'border-transparent'}`}
          >
            <Text className={`font-mono text-[10px] font-bold ${activeTab === 'analytics' ? 'text-blue-500' : 'text-neutral-500'}`}>STATS</Text>
          </Pressable>
        </View>

        {/* Tab View Logic */}
        <View className="px-4">
          {collectionLoading ? (
            <ActivityIndicator color="#f59e0b" className="mt-8" />
          ) : (
            <View>
              {activeTab === 'grails' && (
                <View>
                  {grails.length > 0 ? (
                    <View className="flex-row flex-wrap justify-between">
                      {grails.map((item: any) => {
                        const posterUrl = getPosterUrl(item.movies?.poster_path || item.shows?.poster_path);
                        const isMovie = !!item.movies;
                        const formatSource = item.format === '4K' ? require('@/assets/images/overlays/formats/4K Ultra.png') :
                                            item.format === 'BluRay' ? require('@/assets/images/overlays/formats/BluRay.png') :
                                            item.format === 'DVD' ? require('@/assets/images/overlays/formats/DVD.png') :
                                            item.format === 'VHS' ? require('@/assets/images/overlays/formats/VHS.png') :
                                            item.format === 'Digital' ? require('@/assets/images/overlays/formats/Digital.png') : null;
                        
                        return (
                          <Pressable 
                            key={item.id} 
                            onPress={() => router.push({ pathname: isMovie ? `/movie/${item.movie_id}` as any : `/show/${item.show_id}` as any, params: { ownerId: id } })}
                            className="w-[31%] mb-4"
                          >
                            <View className="relative">
                              <Image 
                                source={{ uri: posterUrl as string }} 
                                className="w-full aspect-[2/3] rounded border border-neutral-800"
                              />
                              {formatSource && (
                                <Image 
                                  source={formatSource} 
                                  style={{ position: 'absolute', bottom: 4, right: 4, width: 24, height: 14 }} 
                                  contentFit="contain" 
                                />
                              )}
                            </View>
                            <Text className="text-white font-mono text-[9px] mt-1 text-center" numberOfLines={1}>
                              {item.movies?.title || item.shows?.name}
                            </Text>
                          </Pressable>
                        );
                      })}
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
                  {/* Sort Selection */}
                  <View className="flex-row items-center justify-end mb-4 gap-4">
                    <Text className="text-neutral-500 font-mono text-[10px] uppercase font-bold">Sort By:</Text>
                    <Pressable onPress={() => setSortBy('added')} className={`px-2 py-1 rounded ${sortBy === 'added' ? 'bg-amber-500' : 'bg-neutral-800'}`}>
                      <Text className={`font-mono text-[9px] font-bold ${sortBy === 'added' ? 'text-black' : 'text-neutral-400'}`}>RECENT</Text>
                    </Pressable>
                    <Pressable onPress={() => setSortBy('name')} className={`px-2 py-1 rounded ${sortBy === 'name' ? 'bg-amber-500' : 'bg-neutral-800'}`}>
                      <Text className={`font-mono text-[9px] font-bold ${sortBy === 'name' ? 'text-black' : 'text-neutral-400'}`}>A-Z</Text>
                    </Pressable>
                    <Pressable onPress={() => setSortBy('format')} className={`px-2 py-1 rounded ${sortBy === 'format' ? 'bg-amber-500' : 'bg-neutral-800'}`}>
                      <Text className={`font-mono text-[9px] font-bold ${sortBy === 'format' ? 'text-black' : 'text-neutral-400'}`}>FORMAT</Text>
                    </Pressable>
                    <Pressable onPress={() => setSortBy('year')} className={`px-2 py-1 rounded ${sortBy === 'year' ? 'bg-amber-500' : 'bg-neutral-800'}`}>
                      <Text className={`font-mono text-[9px] font-bold ${sortBy === 'year' ? 'text-black' : 'text-neutral-400'}`}>YEAR</Text>
                    </Pressable>
                  </View>

                  {stackedCollection.length > 0 ? (
                    <View className="flex-row flex-wrap">
                      {stackedCollection.map((stack: any) => (
                        <View key={stack[0].id} style={{ width: '25%', padding: 4 }}>
                          <StackCard 
                            stack={stack} 
                            width={80} 
                            height={120}
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
