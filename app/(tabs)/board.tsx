import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, ImageBackground, Image, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PostCommentSection } from '@/components/PostCommentSection';
import { useAuth } from '@/context/AuthContext';
import { useBulletinFeed, useSearchUsers, useCreatePost, useSuggestedUsers, useUpdatePost, useDeletePost } from '@/hooks/useSocial';
import { StatusBar } from 'expo-status-bar';
import { searchMedia, TmdbMediaResult, getMovieById, getTvShowById } from '@/lib/tmdb';
import { supabase } from '@/lib/supabase';
import { ConfirmModal } from '@/components/ConfirmModal';

const CORK_BACKGROUND = 'https://www.transparenttextures.com/patterns/cork-board.png';
import { getPosterUrl } from '@/lib/dummy-data';

export default function BulletinBoardScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [postContent, setPostContent] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  
  // Editing State
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());

  // Media Search State
  const [mediaQuery, setMediaQuery] = useState('');
  const [mediaResults, setMediaResults] = useState<TmdbMediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<TmdbMediaResult | null>(null);
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);

  const { data: feed, isLoading: feedLoading } = useBulletinFeed(userId);
  const { data: searchResults, isLoading: searchLoading } = useSearchUsers(searchQuery);
  const { data: suggestedUsers } = useSuggestedUsers(userId);
  
  const createPostMutation = useCreatePost(userId);
  const updatePostMutation = useUpdatePost(userId);
  const deletePostMutation = useDeletePost(userId);

  // Debounced TMDB Search with native setTimeout
  useEffect(() => {
    if (!mediaQuery.trim()) {
      setMediaResults([]);
      return;
    }
    
    const handler = setTimeout(async () => {
      setIsSearchingMedia(true);
      try {
        const res = await searchMedia(mediaQuery);
        setMediaResults(res.results.slice(0, 5));
      } catch (e) {
        console.error('Media search error:', e);
      } finally {
        setIsSearchingMedia(false);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [mediaQuery]);

  const bridgeMediaToDb = async (media: TmdbMediaResult) => {
    try {
      const type = media.media_type;
      let fullDetails = media;
      
      // Fetch details if genres missing
      if (!media.genres) {
        if (type === 'movie') fullDetails = await getMovieById(media.id);
        else fullDetails = await getTvShowById(media.id);
      }

      if (type === 'movie') {
        const payload = {
          tmdb_id: fullDetails.id,
          title: fullDetails.title,
          poster_path: fullDetails.poster_path,
          backdrop_path: fullDetails.backdrop_path,
          release_date: fullDetails.release_date,
          genres: fullDetails.genres,
        } as any;
        const { data, error } = await supabase.from('movies').upsert(payload, { onConflict: 'tmdb_id' }).select().single();
        if (error) throw error;
        return { type: 'movie', id: (data as any).id };
      } else {
        const payload = {
          tmdb_id: fullDetails.id,
          name: fullDetails.name,
          poster_path: fullDetails.poster_path,
          backdrop_path: fullDetails.backdrop_path,
          first_air_date: fullDetails.first_air_date,
          genres: fullDetails.genres,
        } as any;
        const { data, error } = await supabase.from('shows').upsert(payload, { onConflict: 'tmdb_id' }).select().single();
        if (error) throw error;
        return { type: 'show', id: (data as any).id };
      }
    } catch (e) {
      console.error('Bridge failed:', e);
      return null;
    }
  };

  const resetPostState = () => {
    setPostContent('');
    setRating(undefined);
    setEditingPostId(null);
    setMediaQuery('');
    setMediaResults([]);
    setSelectedMedia(null);
  };

  const handlePost = async () => {
    if (!postContent.trim()) return;

    let mediaRefs: { movie_id?: number; show_id?: number } = {};
    if (selectedMedia) {
      const bridged = await bridgeMediaToDb(selectedMedia);
      if (bridged) {
        if (bridged.type === 'movie') mediaRefs.movie_id = bridged.id;
        else mediaRefs.show_id = bridged.id;
      }
    }

    if (editingPostId) {
      updatePostMutation.mutate({
        postId: editingPostId,
        content: postContent,
        rating,
        ...mediaRefs
      }, {
        onSuccess: resetPostState
      });
    } else {
      createPostMutation.mutate({ 
        content: postContent,
        rating,
        ...mediaRefs
      }, {
        onSuccess: resetPostState
      });
    }
  };

  const startEditing = (post: any) => {
    setEditingPostId(post.id);
    setPostContent(post.content);
    setRating(post.rating);
    if (post.movies) {
      setSelectedMedia({ ...post.movies, media_type: 'movie' } as any);
    } else if (post.shows) {
      setSelectedMedia({ ...post.shows, media_type: 'tv' } as any);
    } else {
      setSelectedMedia(null);
    }
    
    // Scroll to top so user sees the edit form
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const toggleComments = (postId: string) => {
    setExpandedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      deletePostMutation.mutate(showDeleteConfirm, {
        onSuccess: () => setShowDeleteConfirm(null)
      });
    }
  };

  return (
    <ImageBackground 
      source={{ uri: CORK_BACKGROUND }} 
      style={{ flex: 1, backgroundColor: '#8b5a2b' }}
      imageStyle={{ opacity: 0.3 }}
    >
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      
      <ConfirmModal
        visible={!!showDeleteConfirm}
        title="Delete Post?"
        message="Are you sure you want to remove this post from the board?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(null)}
      />

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

        <ScrollView 
          ref={scrollViewRef}
          className="flex-1 px-4" 
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 16 }}
        >
          
          {/* Quick Post Area */}
          <View className="bg-yellow-100/90 rounded p-3 mb-6 shadow-xl" style={{ transform: [{ rotate: editingPostId ? '0deg' : '-1deg' }] }}>
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="bg-red-500 w-3 h-3 rounded-full mr-2" />
                <Text className="font-mono text-xs font-bold text-neutral-800 uppercase">
                  {editingPostId ? 'EDITING NOTE' : 'NEW NOTE'}
                </Text>
              </View>
              {editingPostId && (
                <Pressable onPress={resetPostState} className="bg-neutral-800/10 px-2 py-1 rounded">
                   <Text className="font-mono text-[10px] text-neutral-600">CANCEL</Text>
                </Pressable>
              )}
            </View>

            <TextInput
              className="font-mono text-sm text-neutral-900 min-h-[60px]"
              placeholder="Write a recommendation or review..."
              placeholderTextColor="#78716c"
              multiline
              value={postContent}
              onChangeText={setPostContent}
            />

            {/* Rating Stars */}
            <View className="flex-row items-center mt-2 mb-3 border-t border-black/5 pt-2">
              <Text className="text-[10px] font-mono font-bold text-neutral-500 mr-2 uppercase">Rating:</Text>
              {[1, 2, 3, 4, 5].map(star => (
                <Pressable key={star} onPress={() => setRating(star === rating ? undefined : star)} className="mr-1">
                  <Ionicons 
                    name={star <= (rating || 0) ? "star" : "star-outline"} 
                    size={16} 
                    color={star <= (rating || 0) ? '#f59e0b' : '#78716c'} 
                  />
                </Pressable>
              ))}
            </View>

            {/* Attached Media */}
            <View className="border-t border-black/5 pt-2">
              <Text className="text-[10px] font-mono font-bold text-neutral-500 mb-2 uppercase">ATTACH MEDIA:</Text>
              
              {selectedMedia ? (
                <View className="flex-row items-center bg-black/10 p-2 rounded justify-between mb-2">
                  <View className="flex-row items-center flex-1">
                    <Ionicons name="film-outline" size={14} color="#171717" className="mr-2" />
                    <Text className="font-mono text-xs text-neutral-900 flex-1" numberOfLines={1}>
                      {selectedMedia.title || selectedMedia.name}
                    </Text>
                  </View>
                  <Pressable onPress={() => setSelectedMedia(null)}>
                    <Ionicons name="close-circle" size={18} color="#ef4444" />
                  </Pressable>
                </View>
              ) : (
                <View>
                  <View className="flex-row items-center bg-black/5 rounded px-2 border border-black/10">
                    <Ionicons name="search" size={14} color="#78716c" />
                    <TextInput
                      className="flex-1 font-mono text-xs text-neutral-800 p-2"
                      placeholder="Search films to attach..."
                      value={mediaQuery}
                      onChangeText={setMediaQuery}
                      placeholderTextColor="#78716c"
                    />
                  </View>
                  
                  {isSearchingMedia && <ActivityIndicator size="small" color="#525252" className="mt-2" />}
                  
                  {mediaResults.length > 0 && (
                    <View className="mt-2 bg-white/50 rounded overflow-hidden">
                      {mediaResults.map(item => (
                        <Pressable 
                          key={`${item.media_type}-${item.id}`} 
                          onPress={() => {
                            setSelectedMedia(item);
                            setMediaQuery('');
                            setMediaResults([]);
                          }}
                          className="p-2 border-b border-black/5 flex-row items-center"
                        >
                          <Ionicons name="film" size={12} color="#525252" className="mr-2" />
                          <Text className="font-mono text-[10px] text-neutral-800 flex-1" numberOfLines={1}>
                            {item.title || item.name} ({new Date(item.release_date || item.first_air_date || '').getFullYear() || 'N/A'})
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              ) }
            </View>

            <View className="items-end mt-4">
              <Pressable 
                onPress={handlePost}
                disabled={createPostMutation.isPending || updatePostMutation.isPending || !postContent.trim()}
                className={`px-6 py-2 bg-neutral-900 rounded ${!postContent.trim() ? 'opacity-50' : ''}`}
              >
                <Text className="text-white font-mono font-bold text-xs">
                  {editingPostId 
                    ? (updatePostMutation.isPending ? 'UPDATING...' : 'UPDATE PIN') 
                    : (createPostMutation.isPending ? 'PINNING...' : 'PIN TO BOARD')
                  }
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

          {/* Suggested Users Horizontal Strip */}
          {searchQuery.length <= 2 && suggestedUsers && suggestedUsers.length > 0 && (
            <View className="mb-6 bg-black/60 p-4 rounded-lg border border-neutral-800">
              <Text className="text-amber-500 font-bold mb-3 font-mono">RECOMMENDED MEMBERS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {suggestedUsers.map(user => (
                  <Pressable 
                    key={user.id} 
                    onPress={() => router.push(`/profile/${user.id}`)}
                    className="mr-3 bg-neutral-900 rounded border border-neutral-800 p-3 items-center w-28"
                  >
                    <View className="w-10 h-10 rounded-full overflow-hidden bg-neutral-800 items-center justify-center mb-2">
                        {user.avatar_url ? (
                            <Image source={{ uri: user.avatar_url as string }} className="w-full h-full" />
                        ) : (
                            <Ionicons name="person" size={16} color="#737373" />
                        )}
                    </View>
                    <Text className="text-white font-mono text-[10px] font-bold text-center" numberOfLines={1}>{user.username || 'Anonymous'}</Text>
                  </Pressable>
                ))}
              </ScrollView>
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
                    <View className="w-8 h-8 rounded-full bg-neutral-200 border border-neutral-300 items-center justify-center mr-2 overflow-hidden">
                       {post.profiles?.avatar_url ? (
                         <Image source={{ uri: post.profiles.avatar_url }} className="w-full h-full" />
                       ) : (
                         <Ionicons name="person" size={14} color="#525252" />
                       )}
                    </View>
                    <View>
                      <Text className="font-bold text-neutral-900 font-mono text-sm">
                        {post.profiles?.username || 'Unknown Member'}
                      </Text>
                      <Text className="text-neutral-500 font-mono text-[10px]">
                        {new Date(post.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    {/* Actions if owner */}
                    {post.user_id === userId && (
                      <View className="flex-row ml-auto">
                        <Pressable 
                          onPress={() => startEditing(post)}
                          className="p-3 mr-2 bg-neutral-200/50 rounded-full"
                          hitSlop={15}
                        >
                          <Ionicons name="pencil" size={18} color="#525252" />
                        </Pressable>
                        <Pressable 
                          onPress={() => setShowDeleteConfirm(post.id)}
                          className="p-3 bg-red-100/50 rounded-full"
                          hitSlop={15}
                        >
                          <Ionicons name="trash" size={18} color="#ef4444" />
                        </Pressable>
                      </View>
                    )}
                  </Pressable>

                  {/* Attached Media Context */}
                  {(post.movies || post.shows) && (
                    <Pressable 
                      onPress={() => {
                        const mediaId = post.movies?.id || post.shows?.id;
                        const mediaType = post.movies ? 'movie' : 'show';
                        router.push(`/(tabs)/${mediaType}/${mediaId}`);
                      }}
                      className="flex-row items-center bg-black/5 p-2 rounded mb-3 border border-black/10"
                    >
                      <Image 
                        source={{ uri: getPosterUrl((post.movies?.poster_path || post.shows?.poster_path) || null) || '' }} 
                        className="w-10 h-14 rounded mr-3 bg-neutral-200"
                      />
                      <View className="flex-1">
                        <Text className="font-mono text-[10px] text-neutral-500 uppercase font-bold mb-0.5">
                          {post.movies ? 'MOVIE' : 'TV SHOW'}
                        </Text>
                        <Text className="font-mono text-xs text-neutral-900" numberOfLines={1}>
                          {post.movies?.title || post.shows?.name}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#525252" />
                    </Pressable>
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

                  <Text className="text-neutral-800 font-mono text-sm leading-5 mt-2">
                    {post.content}
                  </Text>

                  {/* Comment Toggle and Section */}
                  <View className="mt-4 flex-row items-center border-t border-neutral-200/50 pt-3">
                    <Pressable 
                       onPress={() => toggleComments(post.id)}
                       className="flex-row items-center"
                    >
                      <Ionicons 
                        name={expandedPostIds.has(post.id) ? "chatbubble" : "chatbubble-outline"} 
                        size={16} 
                        color="#737373" 
                      />
                      <Text className="text-neutral-500 font-mono text-[10px] ml-1 uppercase font-bold tracking-tighter">
                        {expandedPostIds.has(post.id) ? "Hide Replies" : "View Replies"}
                      </Text>
                    </Pressable>
                  </View>

                  {expandedPostIds.has(post.id) && (
                    <PostCommentSection postId={post.id} />
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </ImageBackground>
  );
}
