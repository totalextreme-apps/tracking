import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useCommunityFeed, useFollowing, useSearchUsers, useToggleFollow, useSuggestedUsers } from '@/hooks/useSocial';
import { getPosterUrl } from '@/lib/dummy-data';
import { PostCommentSection } from '@/components/PostCommentSection';
import { StatusBar } from 'expo-status-bar';

export default function SocialFeedScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  
  const toggleComments = (id: string) => {
    setExpandedComments(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  const { data: feed, isLoading: feedLoading } = useCommunityFeed(userId ?? undefined);
  const { data: following } = useFollowing(userId ?? undefined);
  const { data: suggestedUsers } = useSuggestedUsers(userId ?? undefined);
  const { data: searchResults, isLoading: searchLoading } = useSearchUsers(searchQuery);
  const toggleFollowMutation = useToggleFollow(userId ?? undefined);

  const isFollowing = (id: string) => following?.some((f: any) => f.following_id === id);

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <Stack.Screen options={{ 
        headerShown: true,
        headerTitle: 'SOCIAL FEED',
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#f59e0b',
        headerTitleStyle: { fontFamily: 'SpaceMono', fontWeight: 'bold' },
        headerLeft: () => (
          <Pressable onPress={() => router.back()} className="ml-2">
            <Ionicons name="arrow-back" size={24} color="#f59e0b" />
          </Pressable>
        )
      }} />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Search / Discovery */}
        <View className="p-4 bg-neutral-900/50 border-b border-neutral-800">
           <View className="flex-row items-center bg-black rounded-lg p-2 px-3 border border-neutral-700">
              <Ionicons name="search" size={16} color="#737373" />
              <TextInput
                className="flex-1 text-white ml-2 font-mono text-sm py-1"
                placeholder="Find more members..."
                placeholderTextColor="#525252"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#525252" />
                </Pressable>
              )}
           </View>

           {/* Search Results Dropdown */}
           {searchQuery.length > 2 && (
             <View className="mt-2 bg-neutral-900 rounded-lg border border-neutral-700 overflow-hidden">
               {searchLoading ? (
                 <ActivityIndicator color="#f59e0b" className="p-4" />
               ) : searchResults?.length ? (
                 searchResults.map((user: any) => (
                    <Pressable 
                      key={user.id} 
                      onPress={() => {
                        setSearchQuery('');
                        router.push(`/profile/${user.id}`);
                      }}
                      className="flex-row items-center justify-between p-3 border-b border-neutral-800 last:border-0"
                    >
                      <View className="flex-row items-center">
                        <View className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden mr-3">
                          {user.avatar_url ? (
                            <Image source={{ uri: user.avatar_url }} className="w-full h-full" />
                          ) : (
                            <View className="w-full h-full items-center justify-center">
                               <Ionicons name="person" size={14} color="#525252" />
                            </View>
                          )}
                        </View>
                        <Text className="text-white font-mono text-sm">{user.username || 'Anonymous'}</Text>
                      </View>
                      <Pressable 
                        onPress={(e) => {
                          e.stopPropagation();
                          toggleFollowMutation.mutate({ targetUserId: user.id, isFollowing: !!isFollowing(user.id) });
                        }}
                        className={`px-3 py-1 rounded-full ${isFollowing(user.id) ? 'bg-neutral-800' : 'bg-amber-500'}`}
                      >
                        <Text className={`font-mono text-[10px] font-bold ${isFollowing(user.id) ? 'text-neutral-500' : 'text-black'}`}>
                          {isFollowing(user.id) ? 'TRACKING' : 'TRACK'}
                        </Text>
                      </Pressable>
                    </Pressable>
                 ))
               ) : (
                 <Text className="text-neutral-500 font-mono text-xs p-4 text-center">No members found.</Text>
               )}
             </View>
           )}
        </View>

        {/* Following Strip */}
        <View className="p-4 border-b border-neutral-900">
          <Text className="text-neutral-500 font-mono text-[10px] uppercase font-bold mb-3 tracking-widest">Members You Track</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {following?.length ? (
              following.map((f: any) => (
                <Pressable 
                  key={f.following_id} 
                  onPress={() => router.push(`/profile/${f.following_id}`)}
                  className="mr-4 items-center"
                >
                  <View className="w-12 h-12 rounded-full border-2 border-amber-500/30 p-0.5 mb-1">
                    <View className="w-full h-full rounded-full bg-neutral-800 overflow-hidden">
                      {f.profiles?.avatar_url ? (
                        <Image source={{ uri: f.profiles.avatar_url }} className="w-full h-full" />
                      ) : (
                        <View className="w-full h-full items-center justify-center">
                           <Ionicons name="person" size={18} color="#525252" />
                        </View>
                      )}
                    </View>
                  </View>
                  <Text className="text-white font-mono text-[9px] w-12 text-center" numberOfLines={1}>
                    {f.profiles?.username || 'Member'}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text className="text-neutral-600 font-mono text-xs italic py-2">Not tracking anyone yet.</Text>
            )}
          </ScrollView>
        </View>

        {/* Discovery / Suggested Strip */}
        {(!following || following.length < 3) && (
          <View className="p-4 border-b border-neutral-900 bg-neutral-900/20">
            <Text className="text-neutral-500 font-mono text-[10px] uppercase font-bold mb-3 tracking-widest">Suggested Discovery</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {suggestedUsers?.filter((u: any) => !isFollowing(u.id)).map((u: any) => (
                <Pressable 
                  key={u.id} 
                  onPress={() => router.push(`/profile/${u.id}`)}
                  className="mr-3 bg-neutral-900 p-2 rounded-lg border border-neutral-800 items-center w-28"
                >
                  <View className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden mb-2">
                    {u.avatar_url ? (
                      <Image source={{ uri: u.avatar_url }} className="w-full h-full" />
                    ) : (
                      <View className="w-full h-full items-center justify-center">
                        <Ionicons name="person" size={14} color="#525252" />
                      </View>
                    )}
                  </View>
                  <Text className="text-white font-mono text-[9px] text-center mb-2" numberOfLines={1}>{u.username || 'Anonymous'}</Text>
                  <Pressable 
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleFollowMutation.mutate({ targetUserId: u.id, isFollowing: false });
                    }}
                    className="bg-amber-500 px-3 py-1 rounded"
                  >
                    <Text className="text-black font-mono text-[8px] font-bold">TRACK</Text>
                  </Pressable>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* The Feed */}
        <View className="p-4">
          <Text className="text-amber-500 font-mono text-[10px] uppercase font-bold mb-4 tracking-widest">Community Pulse</Text>
          
          {feedLoading ? (
            <ActivityIndicator color="#f59e0b" className="mt-10" />
          ) : feed?.length === 0 ? (
            <View className="mt-10 items-center opacity-40">
              <Ionicons name="radio-outline" size={48} color="#525252" />
              <Text className="text-white font-mono text-center mt-4">
                No recent activity.{'\n'}Track more members to see what's happening!
              </Text>
            </View>
          ) : (
            feed?.map((item: any, idx: number) => {
              const profile = item.profiles || item.profiles_user_id; // Handle the joined alias
              const isPost = item.activity_type === 'post';
              
              return (
                <View key={item.id + idx} className="mb-8 border-b border-neutral-900 pb-6">
                  <View className="flex-row items-center mb-4">
                    <Pressable 
                      onPress={() => router.push(`/profile/${item.user_id}`)}
                      className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden mr-3 border border-neutral-700"
                    >
                      {profile?.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                      ) : (
                        <View className="w-full h-full items-center justify-center">
                           <Ionicons name="person" size={16} color="#525252" />
                        </View>
                      )}
                    </Pressable>
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between">
                         <Text className="text-white font-bold font-mono text-sm lowercase">@{profile?.username || 'unknown'}</Text>
                         <Text className="text-neutral-600 font-mono text-[9px] uppercase">
                           {new Date(item.created_at).toLocaleDateString()}
                         </Text>
                      </View>
                      <Text className="text-neutral-500 font-mono text-[10px] uppercase">
                        {isPost ? 'Pinned a new note' : `Added to ${item.format} collection`}
                      </Text>
                    </View>
                  </View>

                  {isPost ? (
                    <View className="bg-neutral-900/50 p-4 rounded-lg border border-neutral-800">
                      <Text className="text-neutral-300 font-mono text-sm leading-5 italic">"{item.content}"</Text>
                      
                      <View className="flex-row items-center mt-3 gap-4">
                        <Pressable 
                          onPress={() => toggleComments(item.id)}
                          className="flex-row items-center gap-1.5"
                        >
                          <Ionicons name="chatbubble-outline" size={14} color={expandedComments[item.id] ? "#f59e0b" : "#525252"} />
                          <Text className={`font-mono text-[10px] uppercase font-bold ${expandedComments[item.id] ? 'text-amber-500' : 'text-neutral-600'}`}>
                            {expandedComments[item.id] ? 'Hide Replies' : 'Reply'}
                          </Text>
                        </Pressable>
                      </View>

                      {expandedComments[item.id] && (
                        <PostCommentSection postId={item.id} />
                      )}

                      {(item.movies || item.shows) && (
                        <Pressable 
                          onPress={() => {
                            const mId = item.movies?.id || item.shows?.id;
                            const type = item.movies ? 'movie' : 'show';
                            router.push(`/(tabs)/${type}/${mId}`);
                          }}
                          className="flex-row items-center mt-4 bg-black/40 p-2 rounded border border-neutral-800"
                        >
                          <Image 
                            source={{ uri: getPosterUrl(item.movies?.poster_path || item.shows?.poster_path) || '' }} 
                            className="w-8 h-12 rounded mr-3 bg-neutral-900"
                          />
                          <View className="flex-1">
                             <Text className="text-white font-mono text-xs" numberOfLines={1}>{item.movies?.title || item.shows?.name}</Text>
                             <Text className="text-neutral-600 font-mono text-[9px] uppercase">{item.movies ? 'Movie' : 'Show'}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={14} color="#525252" />
                        </Pressable>
                      )}
                    </View>
                  ) : (
                    <Pressable 
                      onPress={() => {
                        const mId = item.movies?.id || item.shows?.id;
                        const type = item.movies ? 'movie' : 'show';
                        router.push(`/(tabs)/${type}/${mId}?ownerId=${item.user_id}`);
                      }}
                      className="flex-row items-center bg-amber-500/5 p-3 rounded-lg border border-amber-500/10"
                    >
                      <Image 
                        source={{ uri: getPosterUrl(item.movies?.poster_path || item.shows?.poster_path) || '' }} 
                        className="w-12 h-18 rounded-sm mr-4 bg-neutral-900 border border-neutral-800"
                      />
                      <View className="flex-1">
                        <Text className="text-white font-bold font-mono text-sm" numberOfLines={1}>{item.movies?.title || item.shows?.name}</Text>
                        <View className="flex-row items-center mt-1">
                           <View className="bg-amber-500 px-1.5 py-0.5 rounded mr-2">
                             <Text className="text-black font-bold font-mono text-[8px]">{item.format}</Text>
                           </View>
                           <Text className="text-neutral-500 font-mono text-[9px]">ENRICHED THE STACKS</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#525252" />
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
