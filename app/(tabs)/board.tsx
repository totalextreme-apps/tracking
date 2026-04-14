import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, ImageBackground } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useBulletinFeed, useSearchUsers, useCreatePost } from '@/hooks/useSocial';
import { StatusBar } from 'expo-status-bar';

// A retro corkboard background for the Bulletin Board
// You can replace this with an actual image asset of a corkboard if desired.
const CORK_BACKGROUND = 'https://www.transparenttextures.com/patterns/cork-board.png';

export default function BulletinBoardScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [postContent, setPostContent] = useState('');

  const { data: feed, isLoading: feedLoading } = useBulletinFeed(userId);
  const { data: searchResults, isLoading: searchLoading } = useSearchUsers(searchQuery);
  const createPostMutation = useCreatePost(userId);

  const handlePost = () => {
    if (!postContent.trim()) return;
    createPostMutation.mutate({ content: postContent }, {
      onSuccess: () => setPostContent('')
    });
  };

  return (
    <ImageBackground 
      source={{ uri: CORK_BACKGROUND }} 
      style={{ flex: 1, backgroundColor: '#8b5a2b' }}
      imageStyle={{ opacity: 0.3 }}
    >
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      
      <View className="flex-1 bg-black/40">
        <View className="pt-16 pb-4 px-4 bg-black/80 border-b border-neutral-800">
          <Text className="text-amber-500 font-bold text-2xl font-mono tracking-widest text-center">
            BULLETIN BOARD
          </Text>
          <Text className="text-neutral-400 font-mono text-xs text-center mt-1">
            STAFF PICKS & RECOMMENDATIONS
          </Text>

          {/* User Search Bar */}
          <View className="mt-4 flex-row items-center bg-neutral-900 rounded-lg p-2 border border-neutral-700">
            <Ionicons name="search" size={16} color="#737373" className="ml-2" />
            <TextInput
              className="flex-1 text-white ml-2 font-mono text-sm py-1"
              placeholder="Find friends..."
              placeholderTextColor="#737373"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100, paddingTop: 16 }}>
          
          {/* Quick Post Area */}
          <View className="bg-yellow-100/90 rounded p-3 mb-6 shadow-xl" style={{ transform: [{ rotate: '-1deg' }] }}>
            <View className="flex-row items-center justify-between mb-2">
              <View className="bg-red-500 w-3 h-3 rounded-full" />
              <Text className="font-mono text-xs font-bold text-neutral-800">NEW NOTE</Text>
            </View>
            <TextInput
              className="font-mono text-sm text-neutral-900 min-h-[60px]"
              placeholder="Write a recommendation or review..."
              placeholderTextColor="#78716c"
              multiline
              value={postContent}
              onChangeText={setPostContent}
            />
            <View className="items-end mt-2">
              <Pressable 
                onPress={handlePost}
                disabled={createPostMutation.isPending || !postContent.trim()}
                className={`px-4 py-2 bg-neutral-900 rounded ${!postContent.trim() ? 'opacity-50' : ''}`}
              >
                <Text className="text-white font-mono font-bold text-xs">
                  {createPostMutation.isPending ? 'PINNING...' : 'PIN TO BOARD'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Search Results Display */}
          {searchQuery.length > 2 && (
            <View className="mb-6 bg-black/60 p-4 rounded-lg border border-neutral-800">
              <Text className="text-amber-500 font-bold mb-3 font-mono">USER DIRECTORY</Text>
              {searchLoading ? (
                <ActivityIndicator color="#f59e0b" />
              ) : searchResults?.length ? (
                searchResults.map(user => (
                  <Pressable 
                    key={user.id} 
                    onPress={() => router.push(`/profile/${user.id}`)}
                    className="flex-row items-center justify-between p-3 bg-neutral-900 mb-2 rounded border border-neutral-800"
                  >
                    <View className="flex-row items-center">
                      <View className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center mr-3">
                        <Ionicons name="person" size={14} color="#737373" />
                      </View>
                      <Text className="text-white font-mono font-bold">{user.username || 'Anonymous'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#737373" />
                  </Pressable>
                ))
              ) : (
                <Text className="text-neutral-500 font-mono text-sm">No members found.</Text>
              )}
            </View>
          )}

          {/* The Feed */}
          {feedLoading ? (
            <ActivityIndicator color="#f59e0b" size="large" className="mt-10" />
          ) : feed?.length === 0 ? (
            <View className="items-center mt-10 p-6 bg-black/50 rounded-lg border border-neutral-800 border-dashed">
              <Ionicons name="people-outline" size={32} color="#737373" />
              <Text className="text-neutral-400 font-mono text-center mt-4">
                The board is empty.{'\n'}Follow more members to see their posts!
              </Text>
            </View>
          ) : (
            feed?.map((post, index) => {
              // Creating a pseudo-random rotation for index cards to look messy
              const rotations = ['rotate-1', '-rotate-2', 'rotate-0', 'rotate-2', '-rotate-1'];
              const rotationClass = rotations[index % rotations.length];
              const cardColors = ['bg-white', 'bg-blue-50', 'bg-red-50', 'bg-green-50', 'bg-yellow-50'];
              const colorClass = cardColors[index % cardColors.length];

              return (
                <View 
                  key={post.id} 
                  className={`${colorClass} rounded-sm p-4 mb-4 shadow-xl border border-neutral-300 ${rotationClass}`}
                >
                  {/* Push Pin */}
                  <View className="absolute top-2 left-1/2 -ml-2 bg-red-600 w-4 h-4 rounded-full shadow-sm z-10 border border-red-800" />
                  
                  <Pressable 
                    onPress={() => router.push(`/profile/${post.user_id}`)}
                    className="flex-row items-center mb-3 mt-2"
                  >
                    <View className="w-8 h-8 rounded-full bg-neutral-200 border border-neutral-300 items-center justify-center mr-2">
                       <Ionicons name="person" size={14} color="#525252" />
                    </View>
                    <View>
                      <Text className="font-bold text-neutral-900 font-mono text-sm">
                        {post.profiles?.username || 'Unknown Member'}
                      </Text>
                      <Text className="text-neutral-500 font-mono text-[10px]">
                        {new Date(post.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Attached Media Context */}
                  {(post.movies || post.shows) && (
                    <View className="flex-row items-center bg-black/5 p-2 rounded mb-3 border border-black/10">
                      <Ionicons name="film-outline" size={16} color="#525252" className="mr-2" />
                      <Text className="font-mono text-xs text-neutral-700 flex-1" numberOfLines={1}>
                        Attached: {post.movies?.title || post.shows?.name}
                      </Text>
                    </View>
                  )}

                  {/* Rating snippet */}
                  {post.rating !== undefined && post.rating !== null && (
                    <View className="flex-row mb-2">
                      {[1,2,3,4,5].map(star => (
                        <Ionicons 
                          key={star} 
                          name="star" 
                          size={14} 
                          color={star <= post.rating! ? '#f59e0b' : '#d4d4d8'} 
                        />
                      ))}
                    </View>
                  )}

                  <Text className="text-neutral-800 font-mono text-sm leading-5">
                    {post.content}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </ImageBackground>
  );
}
