import React from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useProfile, useFollowers, useFollowing, useToggleFollow } from '@/hooks/useSocial';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/context/AuthContext';
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
  
  const [activeTab, setActiveTab] = React.useState<'grails' | 'collection' | 'wishlist'>('grails');

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

  return (
    <View className="flex-1 bg-neutral-950">
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header Area */}
      <View className="pt-16 pb-4 bg-black border-b border-neutral-800 flex-row items-center justify-between px-4">
        <Pressable onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#f59e0b" />
        </Pressable>
        <Text className="text-white font-bold text-lg font-mono">
          PROFILE
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 60 }}>
        {/* User Card */}
        <View className="items-center mt-6">
          <View className="w-24 h-24 rounded-full bg-neutral-900 border-2 border-neutral-700 items-center justify-center overflow-hidden mb-3">
            {profile.avatar_url ? (
               <Image source={{ uri: profile.avatar_url as string }} className="w-full h-full" />
            ) : (
               <Ionicons name="person" size={48} color="#525252" />
            )}
          </View>
          <Text className="text-amber-500 font-bold text-2xl font-mono">
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
            <Text className={`font-mono text-xs font-bold ${activeTab === 'grails' ? 'text-amber-500' : 'text-neutral-500'}`}>GRAILS</Text>
          </Pressable>
          <Pressable 
            onPress={() => setActiveTab('collection')} 
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'collection' ? 'border-white' : 'border-transparent'}`}
          >
            <Text className={`font-mono text-xs font-bold ${activeTab === 'collection' ? 'text-white' : 'text-neutral-500'}`}>COLLECTION</Text>
          </Pressable>
          <Pressable 
            onPress={() => setActiveTab('wishlist')} 
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'wishlist' ? 'border-pink-500' : 'border-transparent'}`}
          >
            <Text className={`font-mono text-xs font-bold ${activeTab === 'wishlist' ? 'text-pink-500' : 'text-neutral-500'}`}>WISHLIST</Text>
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
                        return (
                          <Pressable 
                            key={item.id} 
                            onPress={() => router.push({ pathname: isMovie ? `/movie/${item.movie_id}` as any : `/show/${item.show_id}` as any, params: { ownerId: id } })}
                            className="w-[31%] mb-4"
                          >
                            <Image 
                              source={{ uri: posterUrl as string }} 
                              className="w-full aspect-[2/3] rounded border border-neutral-800"
                            />
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
                  {collection?.filter((i: any) => i.status === 'owned').length! > 0 ? (
                    <View className="flex-row flex-wrap justify-between">
                      {collection?.filter((i: any) => i.status === 'owned').map((item: any) => {
                        const posterUrl = getPosterUrl(item.movies?.poster_path || item.shows?.poster_path);
                        const isMovie = !!item.movies;
                        return (
                          <Pressable 
                            key={item.id} 
                            onPress={() => router.push({ pathname: isMovie ? `/movie/${item.movie_id}` as any : `/show/${item.show_id}` as any, params: { ownerId: id } })}
                            className="w-[23%] mb-3"
                          >
                            <Image 
                              source={{ uri: posterUrl as string }} 
                              className="w-full aspect-[2/3] rounded border border-neutral-800"
                            />
                          </Pressable>
                        );
                      })}
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
                  {collection?.filter((i: any) => i.status === 'wishlist').length! > 0 ? (
                    <View className="flex-row flex-wrap justify-between">
                      {collection?.filter((i: any) => i.status === 'wishlist').map((item: any) => {
                        const posterUrl = getPosterUrl(item.movies?.poster_path || item.shows?.poster_path);
                        const isMovie = !!item.movies;
                        return (
                          <Pressable 
                            key={item.id} 
                            onPress={() => router.push({ pathname: isMovie ? `/movie/${item.movie_id}` as any : `/show/${item.show_id}` as any, params: { ownerId: id } })}
                            className="w-[23%] mb-3"
                          >
                            <Image 
                              source={{ uri: posterUrl as string }} 
                              className="w-full aspect-[2/3] rounded border border-neutral-800 opacity-60"
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <View className="p-6 items-center border-dashed border border-neutral-800 rounded-lg">
                      <Text className="text-neutral-500 font-mono text-center">Wishlist is empty.</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}
