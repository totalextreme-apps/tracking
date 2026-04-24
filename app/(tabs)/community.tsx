import React, { useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Image, ImageBackground, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { 
  useBulletinFeed, 
  useCommunityFeed, 
  useSearchUsers, 
  useToggleFollow, 
  useFollowing, 
  useNotifications, 
  useMarkNotificationRead, 
  useConversations,
  useSuggestedUsers,
  useCreatePost,
  useDeletePost,
  useUpdatePost,
  usePostComments,
  useCreatePostComment,
  useMarketplaceFeed,
  useAllUsers
} from '@/hooks/useSocial';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { ConfirmModal } from '@/components/ConfirmModal';
import { searchMedia, TmdbMediaResult, getMovieById, getTvShowById } from '@/lib/tmdb';
import { MemberCard } from '@/components/MemberCard';

const CORK_BG = 'https://www.transparenttextures.com/patterns/cork-board.png';

type Tab = 'activity' | 'directory' | 'board' | 'inbox' | 'alerts';

function PostCommentSection({ postId }: { postId: string }) {
  const { userId } = useAuth();
  const { data: comments, isLoading } = usePostComments(postId);
  const createComment = useCreatePostComment(userId);
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    createComment.mutate({ postId, content: text }, {
      onSuccess: () => {
        setText('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
  };

  if (isLoading) return <ActivityIndicator size="small" color="#8a7060" style={{ marginTop: 10 }} />;

  return (
    <View style={{ marginTop: 10, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 6, padding: 8 }}>
      {(comments || []).map((c: any) => (
        <View key={c.id} style={{ marginBottom: 6, borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.1)', paddingLeft: 8 }}>
          <Text style={{ fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', color: '#4a3728' }}>@{c.profiles?.username}</Text>
          <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, color: '#2d2016' }}>{c.content}</Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <TextInput
          style={{ flex: 1, backgroundColor: '#fff', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, fontFamily: 'SpaceMono', fontSize: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }}
          placeholder="Reply..."
          value={text}
          onChangeText={setText}
        />
        <Pressable onPress={handleSend} disabled={createComment.isPending || !text.trim()} style={{ marginLeft: 6 }}>
          <Ionicons name="send" size={16} color={text.trim() ? '#8a7060' : '#ccc'} />
        </Pressable>
      </View>
    </View>
  );
}

function MarketplaceSection() {
  const router = useRouter();
  const { data: marketplace, isLoading } = useMarketplaceFeed();
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'movie' | 'tv' | null>(null);

  if (isLoading || !marketplace?.length) return null;

  const filteredMarketplace = (marketplace || []).filter((item: any) => {
    if (formatFilter && item.format !== formatFilter) return false;
    if (typeFilter) {
      const isMovie = !!item.movies;
      if (typeFilter === 'movie' && !isMovie) return false;
      if (typeFilter === 'tv' && isMovie) return false;
    }
    return true;
  });

  const getPosterUrl = (path: string | null) => path ? `https://image.tmdb.org/t/p/w200${path}` : null;

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 }}>
        <View>
          <Text style={{ color: '#2a2a2a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>Community Bin</Text>
          <Text style={{ color: '#525252', fontFamily: 'SpaceMono', fontSize: 7, textTransform: 'uppercase' }}>{filteredMarketplace.length} Items</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable onPress={() => setTypeFilter(typeFilter === 'movie' ? null : 'movie')} style={{ backgroundColor: typeFilter === 'movie' ? '#f59e0b22' : '#111', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: typeFilter === 'movie' ? '#f59e0b' : '#1a1a1a' }}>
            <Text style={{ color: typeFilter === 'movie' ? '#f59e0b' : '#444', fontFamily: 'SpaceMono', fontSize: 8, fontWeight: 'bold' }}>FILM</Text>
          </Pressable>
          <Pressable onPress={() => setTypeFilter(typeFilter === 'tv' ? null : 'tv')} style={{ backgroundColor: typeFilter === 'tv' ? '#f59e0b22' : '#111', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: typeFilter === 'tv' ? '#f59e0b' : '#1a1a1a' }}>
            <Text style={{ color: typeFilter === 'tv' ? '#f59e0b' : '#444', fontFamily: 'SpaceMono', fontSize: 8, fontWeight: 'bold' }}>TV</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, marginBottom: 12, gap: 8 }}>
        {['VHS', 'DVD', 'BluRay', '4K', 'Digital'].map(f => (
          <Pressable 
            key={f} 
            onPress={() => setFormatFilter(formatFilter === f ? null : f)}
            style={{ 
              backgroundColor: formatFilter === f ? '#f59e0b' : '#0a0a0a', 
              paddingHorizontal: 10, 
              paddingVertical: 4, 
              borderRadius: 4, 
              borderWidth: 1, 
              borderColor: formatFilter === f ? '#f59e0b' : '#1a1a1a' 
            }}
          >
            <Text style={{ color: formatFilter === f ? '#000' : '#444', fontFamily: 'SpaceMono', fontSize: 8, fontWeight: 'bold' }}>{f === 'BluRay' ? 'Blu-ray' : f}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {filteredMarketplace.length === 0 ? (
        <View style={{ height: 140, justifyContent: 'center', alignItems: 'center', opacity: 0.3 }}>
           <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 10 }}>No matches in the bin.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {filteredMarketplace.map((item: any) => (
            <Pressable 
              key={item.id} 
              onPress={() => {
                const id = item.movies?.id || item.shows?.id;
                const type = item.movies ? 'movie' : 'show';
                router.push(`/(tabs)/${type}/${id}?ownerId=${item.user_id}`);
              }}
              style={{ width: 100 }}
            >
              <View style={{ position: 'relative', width: 100, height: 140, backgroundColor: '#111', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#1a1a1a' }}>
                <Image 
                  source={{ uri: getPosterUrl(item.movies?.poster_path || item.shows?.poster_path) || '' }} 
                  style={{ width: '100%', height: '100%' }} 
                />
                <View style={{ position: 'absolute', top: 4, left: 4, flexDirection: 'row', gap: 2 }}>
                  {item.for_sale && <View style={{ backgroundColor: '#10b981', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}><Text style={{ color: '#000', fontSize: 6, fontWeight: 'bold', fontFamily: 'SpaceMono' }}>SALE</Text></View>}
                  {item.for_trade && <View style={{ backgroundColor: '#3b82f6', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}><Text style={{ color: '#fff', fontSize: 6, fontWeight: 'bold', fontFamily: 'SpaceMono' }}>TRADE</Text></View>}
                </View>
                {item.for_sale && item.price && (
                  <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2, borderWidth: 1, borderColor: '#10b98144' }}>
                    <Text style={{ color: '#10b981', fontSize: 7, fontWeight: 'bold', fontFamily: 'SpaceMono' }}>${item.price}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#1a1a1a', overflow: 'hidden', marginRight: 4 }}>
                  <Image source={{ uri: item.profiles?.avatar_url || '' }} style={{ width: '100%', height: '100%' }} />
                </View>
                <Text style={{ color: '#666', fontFamily: 'SpaceMono', fontSize: 8 }} numberOfLines={1}>@{item.profiles?.username}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default function CommunityScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);

  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [userSearch, setUserSearch] = useState('');
  
  // Bulletin Logic
  const [postContent, setPostContent] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  
  // Media Search State (Bulletin)
  const [mediaQuery, setMediaQuery] = useState('');
  const [mediaResults, setMediaResults] = useState<TmdbMediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<TmdbMediaResult | null>(null);
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);

  // Board Filters
  const [boardRatingFilter, setBoardRatingFilter] = useState<number | null>(null);
  const [boardTypeFilter, setBoardTypeFilter] = useState<'movie' | 'tv' | null>(null);
  const [boardSort, setBoardSort] = useState<'recent' | 'rating'>('recent');

  // Pulse Filter
  const [pulseFilter, setPulseFilter] = useState<'all' | 'collection' | 'notes'>('all');

  // Data
  const { data: following } = useFollowing(userId);
  const { data: bulletinFeed, isLoading: bulletinLoading } = useBulletinFeed(userId);
  const { data: communityFeed, isLoading: communityLoading } = useCommunityFeed(userId);
  const { data: marketplaceFeed } = useMarketplaceFeed();
  const { data: searchResults, isLoading: searchLoading } = useSearchUsers(userSearch);
  const { data: notifications, isLoading: notifLoading } = useNotifications(userId);
  const { data: conversations, isLoading: inboxLoading } = useConversations(userId);
  const { data: suggestedMembers } = useSuggestedUsers(userId);
  const { data: allUsers, isLoading: allUsersLoading } = useAllUsers(userId);

  // TMDB Media Search effect
  React.useEffect(() => {
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

  const toggleFollow = useToggleFollow(userId);
  const createPost = useCreatePost(userId);
  const deletePost = useDeletePost(userId);
  const updatePost = useUpdatePost(userId);
  const markRead = useMarkNotificationRead();

  const isFollowing = (targetId: string) => following?.some((f: any) => f.following_id === targetId);
  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  const getPosterUrl = (path: string | null) => path ? `https://image.tmdb.org/t/p/w200${path}` : null;

  const handlePost = () => {
    if (!postContent.trim()) return;
    if (editingPostId) {
      updatePost.mutate({ postId: editingPostId, content: postContent, rating }, { onSuccess: resetPost });
    } else {
      createPost.mutate({
        content: postContent,
        movie_id: selectedMedia?.media_type === 'movie' ? selectedMedia.id : undefined,
        show_id: selectedMedia?.media_type === 'tv' ? selectedMedia.id : undefined,
        rating
      }, {
        onSuccess: () => {
          resetPost();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      });
    }
  };

  const resetPost = () => {
    setPostContent('');
    setSelectedMedia(null);
    setRating(undefined);
    setEditingPostId(null);
    setMediaQuery('');
    setMediaResults([]);
  };

  const resetPostState = () => {
    setPostContent('');
    setSelectedMedia(null);
    setRating(undefined);
    setEditingPostId(null);
  };

  const toggleComments = (postId: string) => {
    setExpandedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
    Haptics.selectionAsync();
  };

  const notifIcon = (type: string) => {
    switch (type) {
      case 'message': return 'mail-outline';
      case 'item_comment': return 'chatbubble-outline';
      case 'post_comment': return 'paper-plane-outline';
      case 'follow': return 'person-add-outline';
      default: return 'notifications-outline';
    }
  };

  const notifMessage = (n: any) => {
    const actorName = n.actor?.username || 'Someone';
    switch (n.type) {
      case 'message': return `@${actorName} sent you a message`;
      case 'item_comment': return `@${actorName} commented on your item`;
      case 'post_comment': return `@${actorName} replied to your post`;
      case 'follow': return `@${actorName} started tracking you`;
      default: return 'New activity';
    }
  };

  const tabs = [
    { key: 'activity', label: 'Activity' },
    { key: 'directory', label: 'Directory' },
    { key: 'board', label: 'Board' },
    { key: 'inbox', label: 'Inbox' },
    { key: 'alerts', label: unreadCount > 0 ? `Alerts (${unreadCount})` : 'Alerts' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <ConfirmModal
        visible={!!showDeleteConfirm}
        title="Delete Post?"
        message="Remove this post from the board?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => { if (showDeleteConfirm) deletePost.mutate(showDeleteConfirm, { onSuccess: () => setShowDeleteConfirm(null) }); }}
        onCancel={() => setShowDeleteConfirm(null)}
      />

      {/* ── HEADER ── */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 0, backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
        <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 18, fontWeight: 'bold', letterSpacing: 4, textAlign: 'center', marginBottom: 14 }}>
          COMMUNITY
        </Text>

        {/* Segment Toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: '#111', borderRadius: 10, padding: 3, marginBottom: 12 }}>
          {tabs.map(tab => (
            <Pressable
              key={tab.key}
              onPress={() => { setActiveTab(tab.key as Tab); Haptics.selectionAsync(); }}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 8,
                backgroundColor: activeTab === tab.key ? '#1c1c1c' : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{
                fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold',
                color: activeTab === tab.key ? '#f59e0b' : '#525252',
                letterSpacing: 0.5,
              }}>
                {tab.label.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ══════════════════════════ ACTIVITY TAB ══════════════════════════ */}
      {activeTab === 'activity' && (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
        >
          <MarketplaceSection />
          {/* Member Card Feed */}
          {following && following.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
              
              {/* TOP 5 */}
              {following.some((f: any) => f.is_top_five) && (
                  <View style={{ marginBottom: 16 }}>
                      <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' }}>★ My Top 5</Text>
                      {following.filter((f: any) => f.is_top_five).map((f: any) => (
                        <View key={f.following_id} style={{ marginBottom: 24 }}>
                          <MemberCard 
                              userId={f.following_id} 
                              profile={f.profiles} 
                              isReadOnly={true}
                              onAvatarPress={() => router.push(`/profile/${f.following_id}?from=community`)}
                              onDisplayItems={f.profiles?.on_display || []}
                          />
                        </View>
                      ))}
                  </View>
              )}

              {/* TRACKING */}
              <Text style={{ color: '#3a3a3a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' }}>The Network</Text>
              {following.filter((f: any) => !f.is_top_five).map((f: any) => (
                 <View key={f.following_id} style={{ marginBottom: 24 }}>
                   <MemberCard 
                      userId={f.following_id} 
                      profile={f.profiles} 
                      isReadOnly={true}
                      onAvatarPress={() => router.push(`/profile/${f.following_id}?from=community`)}
                      onDisplayItems={f.profiles?.on_display || []}
                   />
                 </View>
              ))}
            </View>
          )}

          {(!following || following.length === 0) && (
             <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#111', marginHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#1f1f1f', marginBottom: 24 }}>
                <Ionicons name="people-outline" size={32} color="#f59e0b" style={{ marginBottom: 16 }} />
                <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>Your Video Store Network is Empty</Text>
                <Text style={{ color: '#525252', fontFamily: 'SpaceMono', fontSize: 11, textAlign: 'center' }}>Search for members or browse below to start tracking movie lovers.</Text>
             </View>
          )}

          {/* Pulse feed */}
          <View style={{ paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: '#3a3a3a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>Community Pulse</Text>
              <View style={{ flexDirection: 'row', backgroundColor: '#111', borderRadius: 4, padding: 2 }}>
                {[
                  { id: 'all', label: 'ALL' },
                  { id: 'collection', label: 'ADDS' },
                  { id: 'notes', label: 'NOTES' }
                ].map(p => (
                  <Pressable key={p.id} onPress={() => setPulseFilter(p.id as any)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2, backgroundColor: pulseFilter === p.id ? '#1c1c1c' : 'transparent' }}>
                    <Text style={{ color: pulseFilter === p.id ? '#f59e0b' : '#333', fontFamily: 'SpaceMono', fontSize: 7, fontWeight: 'bold' }}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {communityLoading ? <ActivityIndicator color="#f59e0b" /> : (
              (communityFeed || [])
                .filter((item: any) => {
                  if (pulseFilter === 'collection' && item.activity_type === 'post') return false;
                  if (pulseFilter === 'notes' && item.activity_type !== 'post') return false;
                  return true;
                })
                .sort((a: any, b: any) => {
                   const isATop5 = following?.find((f: any) => f.following_id === a.user_id)?.is_top_five;
                   const isBTop5 = following?.find((f: any) => f.following_id === b.user_id)?.is_top_five;
                   if (isATop5 && !isBTop5) return -1;
                   if (!isATop5 && isBTop5) return 1;
                   return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                })
                .map((item: any, idx: number) => {
                const profile = item.profiles;
                const isPost = item.activity_type === 'post';
                return (
                  <View key={item.id + '-' + idx} style={{ marginBottom: 16 }}>
                    <Pressable onPress={() => router.push(`/profile/${item.user_id}?from=community`)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a1a1a', overflow: 'hidden', marginRight: 8, borderWidth: 1, borderColor: '#222' }}>
                        {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={12} color="#444" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#ddd', fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold' }}>@{profile?.username || 'member'}</Text>
                        <Text style={{ color: '#333', fontFamily: 'SpaceMono', fontSize: 8, textTransform: 'uppercase' }}>
                          {isPost ? 'pinned a note' : `added to ${item.format} collection`} · {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </Pressable>
                    {isPost ? (
                      <View style={{ backgroundColor: '#111', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1a1a1a' }}>
                        <Text style={{ color: '#ccc', fontFamily: 'SpaceMono', fontSize: 12, lineHeight: 18, fontStyle: 'italic' }}>"{item.content}"</Text>
                      </View>
                    ) : (
                      <Pressable onPress={() => { const id = item.movies?.id || item.shows?.id; const t = item.movies ? 'movie' : 'show'; router.push(`/(tabs)/${t}/${id}?ownerId=${item.user_id}`); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#f59e0b18' }}>
                        <Image source={{ uri: getPosterUrl(item.movies?.poster_path || item.shows?.poster_path) || '' }} style={{ width: 34, height: 50, borderRadius: 4, marginRight: 10, backgroundColor: '#1a1a1a' }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 12, fontWeight: 'bold' }} numberOfLines={1}>{item.movies?.title || item.shows?.name}</Text>
                          <View style={{ backgroundColor: '#1a1a1a', alignSelf: 'flex-start', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 2, marginTop: 4, borderWidth: 1, borderColor: '#222' }}>
                            <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 7, fontWeight: 'bold' }}>{item.format}</Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color="#222" />
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Suggested Members (Shared Tastes) */}
          {suggestedMembers && suggestedMembers.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#1a1a1a' }}>
              <Text style={{ color: '#3a3a3a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' }}>Suggested For You (Shared Tastes)</Text>
              {suggestedMembers.map((user: any) => (
                <View key={user.id} style={{ marginBottom: 24 }}>
                  <MemberCard 
                      userId={user.id} 
                      profile={user} 
                      isReadOnly={true}
                      onAvatarPress={() => router.push(`/profile/${user.id}?from=community`)}
                  />
                  <View style={{ marginTop: -12, paddingHorizontal: 12 }}>
                      <Pressable 
                          onPress={() => toggleFollow.mutate({ targetUserId: user.id, isFollowing: false })}
                          style={{ backgroundColor: '#f59e0b', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                      >
                          <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, fontWeight: 'bold', color: '#000' }}>TRACK THIS MEMBER</Text>
                      </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      )}

      {/* ══════════════════════════ DIRECTORY TAB ══════════════════════════ */}
      {activeTab === 'directory' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 160, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* User Search inside Directory */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#1f1f1f', marginBottom: 4 }}>
              <Ionicons name="search" size={14} color="#525252" />
              <TextInput
                style={{ flex: 1, color: '#fff', fontFamily: 'SpaceMono', fontSize: 12, marginLeft: 8 }}
                placeholder="Find members..." placeholderTextColor="#3a3a3a"
                value={userSearch} onChangeText={setUserSearch}
              />
              {userSearch.length > 0 && (
                <Pressable onPress={() => setUserSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#444" />
                </Pressable>
              )}
            </View>

            {userSearch.length > 2 && (
              <View style={{ backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#1f1f1f', marginBottom: 8, overflow: 'hidden' }}>
                {searchLoading ? <ActivityIndicator color="#f59e0b" style={{ padding: 16 }} /> : (
                  (searchResults || []).map((user: any) => (
                    <Pressable key={user.id} onPress={() => { setUserSearch(''); router.push(`/profile/${user.id}?from=community`); }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: user.grails?.length ? 10 : 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', overflow: 'hidden', marginRight: 10, borderWidth: 1, borderColor: '#222' }}>
                            {user.avatar_url ? <Image source={{ uri: user.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={14} color="#444" />}
                          </View>
                          <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 12 }}>@{user.username || 'anon'}</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            <Text style={{ color: '#3a3a3a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' }}>All Connected Users</Text>
            {allUsersLoading ? (
               <ActivityIndicator color="#f59e0b" style={{ padding: 24 }} />
            ) : (
               (allUsers || []).map((user: any) => (
                 <View key={user.id} style={{ marginBottom: 24 }}>
                   <MemberCard 
                      userId={user.id} 
                      profile={user} 
                      isReadOnly={true}
                      onAvatarPress={() => router.push(`/profile/${user.id}?from=community`)}
                      onDisplayItems={user.on_display || []}
                   />
                 </View>
               ))
            )}
          </View>
        </ScrollView>
      )}

      {/* ══════════════════════════ BOARD TAB ══════════════════════════ */}
      {activeTab === 'board' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 160 }}>
          <ImageBackground source={{ uri: CORK_BG }} style={{ marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', marginTop: 16, marginBottom: 16 }} imageStyle={{ opacity: 0.35, borderRadius: 12 }}>
            <View style={{ backgroundColor: 'rgba(100, 60, 20, 0.4)', padding: 14 }}>
              <View style={{ backgroundColor: 'rgba(255,249,220,0.92)', borderRadius: 4, padding: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 2, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, fontWeight: 'bold', color: '#8a7060' }}>{editingPostId ? 'EDITING NOTE' : 'NEW NOTE'}</Text>
                  {editingPostId && (
                    <Pressable onPress={resetPostState} style={{ backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 }}>
                      <Text style={{ fontFamily: 'SpaceMono', fontSize: 8, color: '#666' }}>CANCEL</Text>
                    </Pressable>
                  )}
                </View>
                <TextInput style={{ fontFamily: 'SpaceMono', fontSize: 13, color: '#2d2016', minHeight: 60, textAlignVertical: 'top' }} placeholder="Share a recommendation..." placeholderTextColor="#a89880" multiline value={postContent} onChangeText={setPostContent} />
                
                {/* Rating */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 8 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'SpaceMono', color: '#8a7060', marginRight: 6 }}>RATING:</Text>
                  {[1,2,3,4,5].map(star => (
                    <Pressable key={star} onPress={() => setRating(star === rating ? undefined : star)} style={{ marginRight: 4 }}>
                      <Ionicons name={star <= (rating || 0) ? "star" : "star-outline"} size={16} color={star <= (rating || 0) ? '#f59e0b' : '#a89880'} />
                    </Pressable>
                  ))}
                </View>

                {/* Media Attachment */}
                <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 8 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'SpaceMono', color: '#8a7060', marginBottom: 6 }}>ATTACH FILM:</Text>
                  {selectedMedia ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)', padding: 6, borderRadius: 4, justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Ionicons name="film-outline" size={12} color="#2d2016" style={{ marginRight: 6 }} />
                        <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, color: '#2d2016' }} numberOfLines={1}>{selectedMedia.title || selectedMedia.name}</Text>
                      </View>
                      <Pressable onPress={() => setSelectedMedia(null)}>
                        <Ionicons name="close-circle" size={14} color="#e53e3e" />
                      </Pressable>
                    </View>
                  ) : (
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }}>
                        <Ionicons name="search" size={12} color="#a89880" />
                        <TextInput
                          style={{ flex: 1, paddingVertical: 4, paddingHorizontal: 6, fontFamily: 'SpaceMono', fontSize: 10, color: '#2d2016' }}
                          placeholder="Search movie..."
                          value={mediaQuery}
                          onChangeText={setMediaQuery}
                        />
                      </View>
                      {mediaResults.length > 0 && (
                        <View style={{ marginTop: 4, backgroundColor: '#fff', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                          {mediaResults.map(res => (
                            <Pressable key={`${res.media_type}-${res.id}`} onPress={() => { setSelectedMedia(res); setMediaQuery(''); setMediaResults([]); }} style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
                              <Text style={{ fontFamily: 'SpaceMono', fontSize: 9, color: '#2d2016' }}>{res.title || res.name} ({new Date(res.release_date || res.first_air_date || '').getFullYear() || 'N/A'})</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <View style={{ alignItems: 'flex-end', marginTop: 14 }}>
                  <Pressable onPress={handlePost} disabled={createPost.isPending || updatePost.isPending || !postContent.trim()} style={{ backgroundColor: '#2d2016', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4 }}>
                    <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 10, fontWeight: 'bold' }}>
                      {editingPostId ? (updatePost.isPending ? 'UPDATING...' : 'UPDATE PIN') : (createPost.isPending ? 'PINNING...' : 'PIN TO BOARD')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Board Filters Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingHorizontal: 4 }}>
                 <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: 2 }}>
                    <Pressable onPress={() => setBoardSort('recent')} style={{ flex: 1, paddingVertical: 6, borderRadius: 3, backgroundColor: boardSort === 'recent' ? '#2d2016' : 'transparent', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'SpaceMono', fontSize: 8, color: boardSort === 'recent' ? '#f59e0b' : '#666', fontWeight: 'bold' }}>RECENT</Text>
                    </Pressable>
                    <Pressable onPress={() => setBoardSort('rating')} style={{ flex: 1, paddingVertical: 6, borderRadius: 3, backgroundColor: boardSort === 'rating' ? '#2d2016' : 'transparent', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'SpaceMono', fontSize: 8, color: boardSort === 'rating' ? '#f59e0b' : '#666', fontWeight: 'bold' }}>TOP RATED</Text>
                    </Pressable>
                 </View>
                 <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable onPress={() => setBoardTypeFilter(boardTypeFilter === 'movie' ? null : 'movie')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: boardTypeFilter === 'movie' ? '#2d2016' : 'rgba(0,0,0,0.1)', backgroundColor: boardTypeFilter === 'movie' ? '#2d2016' : 'transparent' }}>
                      <Text style={{ fontFamily: 'SpaceMono', fontSize: 8, color: boardTypeFilter === 'movie' ? '#f59e0b' : '#444' }}>FILM</Text>
                    </Pressable>
                    <Pressable onPress={() => setBoardRatingFilter(boardRatingFilter === 5 ? null : 5)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: boardRatingFilter === 5 ? '#2d2016' : 'rgba(0,0,0,0.1)', backgroundColor: boardRatingFilter === 5 ? '#2d2016' : 'transparent' }}>
                      <Ionicons name="star" size={8} color={boardRatingFilter === 5 ? "#f59e0b" : "#444"} />
                    </Pressable>
                 </View>
              </View>

              {bulletinLoading ? <ActivityIndicator color="#f59e0b" style={{ marginVertical: 20 }} /> : (
                (bulletinFeed || [])
                  .filter((post: any) => {
                    if (boardTypeFilter === 'movie' && !post.movies) return false;
                    if (boardTypeFilter === 'tv' && !post.shows) return false;
                    if (boardRatingFilter && (post.rating || 0) < boardRatingFilter) return false;
                    return true;
                  })
                  .sort((a: any, b: any) => {
                    if (boardSort === 'rating') return (b.rating || 0) - (a.rating || 0);
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  })
                  .map((post: any, idx: number) => (
                  <View key={post.id} style={{ backgroundColor: 'rgba(255,252,225,0.94)', borderRadius: 2, padding: 12, marginBottom: 16, transform: [{ rotate: idx % 2 === 0 ? '-1deg' : '1deg' }], shadowColor: '#000', shadowOffset: { width: 2, height: 4 }, shadowOpacity: 0.35, shadowRadius: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#ddd', overflow: 'hidden', marginRight: 8 }}>
                        {post.profiles?.avatar_url ? <Image source={{ uri: post.profiles.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={12} color="#888" />}
                      </View>
                      <Text style={{ fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold', color: '#2d2016' }}>@{post.profiles?.username}</Text>
                      <View style={{ flex: 1 }} />
                      {post.user_id === userId && (
                        <View style={{ flexDirection: 'row' }}>
                          <Pressable onPress={() => startEditing(post)} style={{ marginRight: 10 }}><Ionicons name="pencil" size={14} color="#666" /></Pressable>
                          <Pressable onPress={() => setShowDeleteConfirm(post.id)}><Ionicons name="trash" size={14} color="#e53e3e" /></Pressable>
                        </View>
                      )}
                    </View>

                    {(post.movies || post.shows) && (
                      <Pressable 
                        onPress={() => {
                          const id = post.movies?.id || post.shows?.id;
                          const t = post.movies ? 'movie' : 'show';
                          router.push(`/(tabs)/${t}/${id}`);
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', padding: 8, borderRadius: 4, marginBottom: 10 }}
                      >
                        <Image source={{ uri: getPosterUrl(post.movies?.poster_path || post.shows?.poster_path) || '' }} style={{ width: 30, height: 45, borderRadius: 2, marginRight: 10, backgroundColor: '#ddd' }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, color: '#2d2016', fontWeight: 'bold' }} numberOfLines={1}>{post.movies?.title || post.shows?.name}</Text>
                          <Text style={{ fontFamily: 'SpaceMono', fontSize: 8, color: '#8a7060' }}>{post.movies ? 'MOVIE' : 'TV SHOW'}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={12} color="#ccc" />
                      </Pressable>
                    )}

                    {post.rating !== undefined && post.rating !== null && (
                      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                        {[1,2,3,4,5].map(star => (
                          <Ionicons key={star} name="star" size={10} color={star <= post.rating! ? '#f59e0b' : '#d1d1d1'} style={{ marginRight: 2 }} />
                        ))}
                      </View>
                    )}
                    <Text style={{ fontFamily: 'SpaceMono', fontSize: 12, color: '#2d2016' }}>{post.content}</Text>
                    <Pressable onPress={() => toggleComments(post.id)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' }}>
                      <Ionicons name="chatbubble-outline" size={12} color="#8a7060" />
                      <Text style={{ fontFamily: 'SpaceMono', fontSize: 9, color: '#8a7060', marginLeft: 4 }}>REPLY</Text>
                    </Pressable>
                    {expandedPostIds.has(post.id) && <PostCommentSection postId={post.id} />}
                  </View>
                ))
              )}
            </View>
          </ImageBackground>
        </ScrollView>
      )}

      {/* ══════════════════════════ INBOX TAB ══════════════════════════ */}
      {activeTab === 'inbox' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 160 }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#111' }}>
            <Text style={{ color: '#2a2a2a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>Direct Messages</Text>
          </View>
          {inboxLoading ? <ActivityIndicator color="#f59e0b" style={{ marginTop: 40 }} /> : !conversations?.length ? (
            <View style={{ marginTop: 80, alignItems: 'center', paddingHorizontal: 40, opacity: 0.3 }}>
              <Ionicons name="chatbubbles-outline" size={56} color="#333" />
              <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 11, textAlign: 'center', marginTop: 16 }}>No messages yet.</Text>
            </View>
          ) : (
            (conversations || []).map((conv: any) => (
              <Pressable key={conv.partner?.id} onPress={() => router.push(`/(tabs)/profile/chat/${conv.partner?.id}`)} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#0a0a0a' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#111', overflow: 'hidden', marginRight: 12 }}>
                  {conv.partner?.avatar_url ? <Image source={{ uri: conv.partner.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={20} color="#333" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 13, fontWeight: 'bold' }}>@{conv.partner?.username || 'anon'}</Text>
                  <Text style={{ color: '#444', fontFamily: 'SpaceMono', fontSize: 11 }} numberOfLines={1}>{conv.lastMessage?.content}</Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* ══════════════════════════ ALERTS TAB ══════════════════════════ */}
      {activeTab === 'alerts' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 160 }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#111' }}>
            <Text style={{ color: '#2a2a2a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>Alerts</Text>
          </View>
          {notifLoading ? <ActivityIndicator color="#f59e0b" style={{ marginTop: 40 }} /> : !notifications?.length ? (
            <View style={{ marginTop: 80, alignItems: 'center', paddingHorizontal: 40, opacity: 0.3 }}>
              <Ionicons name="notifications-off-outline" size={56} color="#333" />
              <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 11, textAlign: 'center', marginTop: 16 }}>All quiet.</Text>
            </View>
          ) : (
            (notifications || []).map((n: any) => (
              <Pressable key={n.id} onPress={() => { markRead.mutate(n.id); if (n.type === 'message') router.push(`/(tabs)/profile/chat/${n.actor_id}?from=community`); else if (n.type === 'follow') router.push(`/profile/${n.actor_id}?from=community`); }} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#0a0a0a', backgroundColor: !n.is_read ? '#f59e0b05' : 'transparent' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#111', overflow: 'hidden', marginRight: 12 }}>
                  {n.actor?.avatar_url ? <Image source={{ uri: n.actor.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name={notifIcon(n.type) as any} size={16} color="#f59e0b" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: n.is_read ? '#444' : '#ddd', fontFamily: 'SpaceMono', fontSize: 12 }}>{notifMessage(n)}</Text>
                  <Text style={{ color: '#222', fontFamily: 'SpaceMono', fontSize: 8 }}>{new Date(n.created_at).toLocaleDateString()}</Text>
                </View>
                {!n.is_read && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' }} />}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
