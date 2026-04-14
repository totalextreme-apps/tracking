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

        {/* User's Grails showcase */}
        <View className="mt-10 px-4">
          <Text className="text-neutral-500 font-bold font-mono tracking-widest mb-4">
            SHOWCASE GRAILS
          </Text>
          
          {collectionLoading ? (
            <ActivityIndicator color="#f59e0b" />
          ) : grails.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-1 py-2">
              {grails.slice(0, 5).map((item: any) => {
                const posterUrl = getPosterUrl(item.movies?.poster_path || item.shows?.poster_path);
                return (
                  <View key={item.id} className="mr-4 w-28">
                    <Image 
                      source={{ uri: posterUrl as string }} 
                      className="w-28 h-40 rounded border border-neutral-800"
                    />
                    <Text className="text-white font-mono text-xs mt-2 numberOfLines={1}">
                      {item.movies?.title || item.shows?.name}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 items-center border-dashed">
              <Text className="text-neutral-500 font-mono text-center">No Grails on display.</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}
