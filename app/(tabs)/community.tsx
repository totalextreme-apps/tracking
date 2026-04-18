import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable,
  ActivityIndicator, Image, ImageBackground, Alert, Keyboard
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import {
  useBulletinFeed, useCommunityFeed, useSearchUsers,
  useCreatePost, useUpdatePost, useDeletePost,
  useSuggestedUsers, useToggleFollow, useFollowing,
  useConversations, useNotifications, useMarkNotificationRead,
} from '@/hooks/useSocial';
import { searchMedia, TmdbMediaResult, getMovieById, getTvShowById } from '@/lib/tmdb';
import { getPosterUrl } from '@/lib/dummy-data';
import { supabase } from '@/lib/supabase';
import { PostCommentSection } from '@/components/PostCommentSection';
import { ConfirmModal } from '@/components/ConfirmModal';

const CORK_BG = 'https://www.transparenttextures.com/patterns/cork-board.png';

type Tab = 'activity' | 'inbox' | 'alerts';

export default function CommunityScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('activity');

  // --- Bulletin / Post State ---
  const [postContent, setPostContent] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [mediaQuery, setMediaQuery] = useState('');
  const [mediaResults, setMediaResults] = useState<TmdbMediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<TmdbMediaResult | null>(null);
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);

  // --- User Search State ---
  const [userSearch, setUserSearch] = useState('');
  const scrollRef = React.useRef<ScrollView>(null);

  // --- Data ---
  const { data: bulletinFeed, isLoading: bulletinLoading } = useBulletinFeed(userId);
  const { data: communityFeed, isLoading: communityLoading } = useCommunityFeed(userId);
  const { data: following } = useFollowing(userId);
  const { data: suggestedUsers } = useSuggestedUsers(userId);
  const { data: searchResults, isLoading: searchLoading } = useSearchUsers(userSearch);
  const { data: conversations, isLoading: inboxLoading } = useConversations(userId);
  const { data: notifications, isLoading: notifLoading } = useNotifications(userId);

  // --- Mutations ---
  const createPost = useCreatePost(userId);
  const updatePost = useUpdatePost(userId);
  const deletePost = useDeletePost(userId);
  const toggleFollow = useToggleFollow(userId);
  const markRead = useMarkNotificationRead();

  const isFollowing = (id: string) => following?.some((f: any) => f.following_id === id);
  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  // TMDB Media search debounce
  useEffect(() => {
    if (!mediaQuery.trim()) { setMediaResults([]); return; }
    const h = setTimeout(async () => {
      setIsSearchingMedia(true);
      try {
        const res = await searchMedia(mediaQuery);
        setMediaResults(res.results.slice(0, 5));
      } catch { } finally { setIsSearchingMedia(false); }
    }, 500);
    return () => clearTimeout(h);
  }, [mediaQuery]);

  const bridgeMedia = async (media: TmdbMediaResult) => {
    try {
      const type = media.media_type;
      let full = media;
      if (!media.genres) {
        full = type === 'movie' ? await getMovieById(media.id) : await getTvShowById(media.id);
      }
      if (type === 'movie') {
        const { data, error } = await supabase.from('movies').upsert({
          tmdb_id: full.id, title: full.title, poster_path: full.poster_path,
          backdrop_path: full.backdrop_path, release_date: full.release_date, genres: full.genres,
        } as any, { onConflict: 'tmdb_id' }).select().single();
        if (error) throw error;
        return { type: 'movie', id: (data as any).id };
      } else {
        const { data, error } = await supabase.from('shows').upsert({
          tmdb_id: full.id, name: full.name, poster_path: full.poster_path,
          backdrop_path: full.backdrop_path, first_air_date: full.first_air_date, genres: full.genres,
        } as any, { onConflict: 'tmdb_id' }).select().single();
        if (error) throw error;
        return { type: 'show', id: (data as any).id };
      }
    } catch { return null; }
  };

  const resetPost = () => {
    setPostContent(''); setRating(undefined); setEditingPostId(null);
    setMediaQuery(''); setMediaResults([]); setSelectedMedia(null);
    Keyboard.dismiss();
  };

  const handlePost = async () => {
    if (!postContent.trim()) return;
    let mediaRefs: any = {};
    if (selectedMedia) {
      const bridged = await bridgeMedia(selectedMedia);
      if (bridged) {
        if (bridged.type === 'movie') mediaRefs.movie_id = bridged.id;
        else mediaRefs.show_id = bridged.id;
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (editingPostId) {
      updatePost.mutate({ postId: editingPostId, content: postContent, rating, ...mediaRefs }, { onSuccess: resetPost });
    } else {
      createPost.mutate({ content: postContent, rating, ...mediaRefs }, { onSuccess: resetPost });
    }
  };

  const startEditing = (post: any) => {
    setEditingPostId(post.id);
    setPostContent(post.content);
    setRating(post.rating);
    setSelectedMedia(post.movies ? { ...post.movies, media_type: 'movie' } as any : post.shows ? { ...post.shows, media_type: 'tv' } as any : null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const toggleComments = (id: string) => {
    setExpandedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
    const actor = n.actor?.username || 'Someone';
    switch (n.type) {
      case 'message': return `@${actor} sent you a message`;
      case 'item_comment': return `@${actor} commented on your item`;
      case 'post_comment': return `@${actor} replied to your post`;
      case 'follow': return `@${actor} started tracking you`;
      default: return 'New activity';
    }
  };

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
          {([
            { key: 'activity', label: 'Activity' },
            { key: 'inbox', label: 'Inbox' },
            { key: 'alerts', label: `Alerts${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
          ] as { key: Tab; label: string }[]).map(tab => (
            <Pressable
              key={tab.key}
              onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
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
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* User Search */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#1f1f1f', marginBottom: 4 }}>
              <Ionicons name="search" size={14} color="#525252" />
              <TextInput
                style={{ flex: 1, color: '#fff', fontFamily: 'SpaceMono', fontSize: 12, marginLeft: 8 }}
                placeholder="Find members..."
                placeholderTextColor="#3a3a3a"
                value={userSearch}
                onChangeText={setUserSearch}
              />
              {userSearch.length > 0 && (
                <Pressable onPress={() => setUserSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#444" />
                </Pressable>
              )}
            </View>

            {/* Search Results */}
            {userSearch.length > 2 && (
              <View style={{ backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#1f1f1f', marginBottom: 8, overflow: 'hidden' }}>
                {searchLoading ? (
                  <ActivityIndicator color="#f59e0b" style={{ padding: 16 }} />
                ) : searchResults?.length ? (
                  searchResults.map((user: any) => (
                    <Pressable
                      key={user.id}
                      onPress={() => { setUserSearch(''); router.push(`/profile/${user.id}`); }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', overflow: 'hidden', marginRight: 10, borderWidth: 1, borderColor: '#2a2a2a' }}>
                          {user.avatar_url ? <Image source={{ uri: user.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={14} color="#444" /></View>}
                        </View>
                        <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 12 }}>@{user.username || 'anonymous'}</Text>
                      </View>
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); toggleFollow.mutate({ targetUserId: user.id, isFollowing: !!isFollowing(user.id) }); }}
                        style={{ backgroundColor: isFollowing(user.id) ? '#1a1a1a' : '#f59e0b', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}
                      >
                        <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, fontWeight: 'bold', color: isFollowing(user.id) ? '#525252' : '#000' }}>
                          {isFollowing(user.id) ? 'TRACKING' : 'TRACK'}
                        </Text>
                      </Pressable>
                    </Pressable>
                  ))
                ) : (
                  <Text style={{ color: '#525252', fontFamily: 'SpaceMono', fontSize: 11, padding: 16, textAlign: 'center' }}>No members found</Text>
                )}
              </View>
            )}
          </View>

          {/* Following Avatars Strip */}
          {following && following.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <Text style={{ color: '#3a3a3a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Members You Track</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {following.map((f: any) => (
                  <Pressable key={f.following_id} onPress={() => router.push(`/profile/${f.following_id}`)} style={{ marginRight: 12, alignItems: 'center' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#f59e0b33', padding: 2, marginBottom: 4 }}>
                      <View style={{ flex: 1, borderRadius: 20, backgroundColor: '#1a1a1a', overflow: 'hidden' }}>
                        {f.profiles?.avatar_url ? <Image source={{ uri: f.profiles.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={16} color="#444" /></View>}
                      </View>
                    </View>
                    <Text style={{ color: '#525252', fontFamily: 'SpaceMono', fontSize: 8, width: 44, textAlign: 'center' }} numberOfLines={1}>{f.profiles?.username || '?'}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Suggested Members */}
          {suggestedUsers && suggestedUsers.filter((u: any) => !isFollowing(u.id) && u.id !== userId).length > 0 && !following?.length && (
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <Text style={{ color: '#3a3a3a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Suggested Members</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {suggestedUsers.filter((u: any) => !isFollowing(u.id) && u.id !== userId).map((u: any) => (
                  <Pressable key={u.id} onPress={() => router.push(`/profile/${u.id}`)} style={{ marginRight: 10, backgroundColor: '#111', borderRadius: 12, padding: 10, alignItems: 'center', width: 90, borderWidth: 1, borderColor: '#1f1f1f' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', overflow: 'hidden', marginBottom: 6 }}>
                      {u.avatar_url ? <Image source={{ uri: u.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={14} color="#444" /></View>}
                    </View>
                    <Text style={{ color: '#ccc', fontFamily: 'SpaceMono', fontSize: 9, textAlign: 'center', marginBottom: 6 }} numberOfLines={1}>{u.username || 'anon'}</Text>
                    <Pressable
                      onPress={(e) => { e.stopPropagation(); toggleFollow.mutate({ targetUserId: u.id, isFollowing: false }); Haptics.selectionAsync(); }}
                      style={{ backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}
                    >
                      <Text style={{ color: '#000', fontFamily: 'SpaceMono', fontSize: 8, fontWeight: 'bold' }}>TRACK</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── BULLETIN PIN BOARD ── */}
          <ImageBackground source={{ uri: CORK_BG }} style={{ marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }} imageStyle={{ opacity: 0.35, borderRadius: 12 }}>
            <View style={{ backgroundColor: 'rgba(100, 60, 20, 0.4)', padding: 14 }}>
              {/* New Post Card */}
              <View style={{ backgroundColor: 'rgba(255,249,220,0.92)', borderRadius: 4, padding: 12, marginBottom: 16, transform: [{ rotate: editingPostId ? '0deg' : '-0.5deg' }], shadowColor: '#000', shadowOffset: { width: 2, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6 }}>
                <View style={{ position: 'absolute', top: -6, left: '50%', width: 14, height: 14, borderRadius: 7, backgroundColor: '#e53e3e', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 2 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#e53e3e', marginRight: 6 }} />
                    <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, fontWeight: 'bold', color: '#4a3728', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {editingPostId ? 'Edit Note' : 'New Note'}
                    </Text>
                  </View>
                  {editingPostId && (
                    <Pressable onPress={resetPost} style={{ backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontFamily: 'SpaceMono', fontSize: 9, color: '#666' }}>CANCEL</Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  style={{ fontFamily: 'SpaceMono', fontSize: 13, color: '#2d2016', minHeight: 60, textAlignVertical: 'top' }}
                  placeholder="Write a recommendation or review..."
                  placeholderTextColor="#a89880"
                  multiline value={postContent} onChangeText={setPostContent}
                />
                {/* Stars */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' }}>
                  <Text style={{ fontFamily: 'SpaceMono', fontSize: 9, color: '#8a7060', marginRight: 8, textTransform: 'uppercase' }}>Rating:</Text>
                  {[1,2,3,4,5].map(s => (
                    <Pressable key={s} onPress={() => setRating(s === rating ? undefined : s)} style={{ marginRight: 2 }}>
                      <Ionicons name={s <= (rating || 0) ? 'star' : 'star-outline'} size={14} color={s <= (rating || 0) ? '#f59e0b' : '#a0907860'} />
                    </Pressable>
                  ))}
                </View>
                {/* Attach Media */}
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' }}>
                  {selectedMedia ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.06)', padding: 8, borderRadius: 4 }}>
                      <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, color: '#4a3728', flex: 1 }} numberOfLines={1}>
                        🎬 {selectedMedia.title || selectedMedia.name}
                      </Text>
                      <Pressable onPress={() => setSelectedMedia(null)}>
                        <Ionicons name="close-circle" size={16} color="#e53e3e" />
                      </Pressable>
                    </View>
                  ) : (
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 4, paddingHorizontal: 8 }}>
                        <Ionicons name="film-outline" size={12} color="#8a7060" />
                        <TextInput
                          style={{ flex: 1, fontFamily: 'SpaceMono', fontSize: 10, color: '#4a3728', padding: 6 }}
                          placeholder="Attach a film..." placeholderTextColor="#a89880"
                          value={mediaQuery} onChangeText={setMediaQuery}
                        />
                      </View>
                      {isSearchingMedia && <ActivityIndicator size="small" color="#8a7060" style={{ marginTop: 4 }} />}
                      {mediaResults.length > 0 && (
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 4, marginTop: 4, overflow: 'hidden' }}>
                          {mediaResults.map(item => (
                            <Pressable key={`${item.media_type}-${item.id}`} onPress={() => { setSelectedMedia(item); setMediaQuery(''); setMediaResults([]); }} style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="film" size={10} color="#8a7060" style={{ marginRight: 6 }} />
                              <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, color: '#4a3728' }} numberOfLines={1}>{item.title || item.name}</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
                  <Pressable
                    onPress={handlePost}
                    disabled={createPost.isPending || updatePost.isPending || !postContent.trim()}
                    style={{ backgroundColor: '#2d2016', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4, opacity: postContent.trim() ? 1 : 0.4 }}
                  >
                    <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 }}>
                      {editingPostId ? (updatePost.isPending ? 'UPDATING...' : 'UPDATE PIN') : (createPost.isPending ? 'PINNING...' : 'PIN TO BOARD')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Bulletin Feed */}
              {bulletinLoading ? (
                <ActivityIndicator color="#f59e0b" style={{ marginVertical: 20 }} />
              ) : bulletinFeed?.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'SpaceMono', fontSize: 11 }}>The board is quiet. Be the first to post!</Text>
                </View>
              ) : (
                bulletinFeed?.map((post: any, idx: number) => {
                  const rotations = ['-1.5deg', '1deg', '-0.5deg', '1.5deg', '0.5deg'];
                  const cardColors = ['rgba(255,252,225,0.94)', 'rgba(225,240,255,0.94)', 'rgba(255,230,230,0.94)', 'rgba(225,255,230,0.94)', 'rgba(255,245,215,0.94)'];
                  return (
                    <View
                      key={post.id}
                      style={{ backgroundColor: cardColors[idx % cardColors.length], borderRadius: 2, padding: 12, marginBottom: 16, transform: [{ rotate: rotations[idx % rotations.length] }], shadowColor: '#000', shadowOffset: { width: 2, height: 4 }, shadowOpacity: 0.35, shadowRadius: 5 }}
                    >
                      <View style={{ position: 'absolute', top: -7, left: '50%', width: 16, height: 16, borderRadius: 8, backgroundColor: idx % 2 === 0 ? '#e53e3e' : '#3b82f6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 2 }} />
                      <Pressable onPress={() => router.push(`/profile/${post.user_id}`)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 6 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#ddd', overflow: 'hidden', marginRight: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }}>
                          {post.profiles?.avatar_url ? <Image source={{ uri: post.profiles.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={12} color="#888" /></View>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold', color: '#2d2016' }}>{post.profiles?.username || 'Member'}</Text>
                          <Text style={{ fontFamily: 'SpaceMono', fontSize: 8, color: '#8a7060' }}>{new Date(post.created_at).toLocaleDateString()}</Text>
                        </View>
                        {post.user_id === userId && (
                          <View style={{ flexDirection: 'row' }}>
                            <Pressable onPress={() => startEditing(post)} style={{ padding: 8, marginRight: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 6 }} hitSlop={12}>
                              <Ionicons name="pencil" size={14} color="#8a7060" />
                            </Pressable>
                            <Pressable onPress={() => setShowDeleteConfirm(post.id)} style={{ padding: 8, backgroundColor: 'rgba(229,62,62,0.1)', borderRadius: 6 }} hitSlop={12}>
                              <Ionicons name="trash" size={14} color="#e53e3e" />
                            </Pressable>
                          </View>
                        )}
                      </Pressable>

                      {/* Attached Media */}
                      {(post.movies || post.shows) && (
                        <Pressable
                          onPress={() => { const id = post.movies?.id || post.shows?.id; const t = post.movies ? 'movie' : 'show'; router.push(`/(tabs)/${t}/${id}`); }}
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.07)', padding: 8, borderRadius: 4, marginBottom: 8 }}
                        >
                          <Image source={{ uri: getPosterUrl(post.movies?.poster_path || post.shows?.poster_path) || '' }} style={{ width: 32, height: 46, borderRadius: 2, marginRight: 8, backgroundColor: '#ccc' }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'SpaceMono', fontSize: 8, color: '#8a7060', textTransform: 'uppercase' }}>{post.movies ? 'MOVIE' : 'TV SHOW'}</Text>
                            <Text style={{ fontFamily: 'SpaceMono', fontSize: 11, color: '#2d2016' }} numberOfLines={1}>{post.movies?.title || post.shows?.name}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={12} color="#8a7060" />
                        </Pressable>
                      )}

                      {/* Stars */}
                      {post.rating != null && (
                        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                          {[1,2,3,4,5].map(s => <Ionicons key={s} name="star" size={12} color={s <= post.rating ? '#f59e0b' : '#ccc'} style={{ marginRight: 1 }} />)}
                        </View>
                      )}
                      <Text style={{ fontFamily: 'SpaceMono', fontSize: 12, color: '#2d2016', lineHeight: 18 }}>{post.content}</Text>

                      {/* Comment Toggle */}
                      <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)', flexDirection: 'row' }}>
                        <Pressable onPress={() => toggleComments(post.id)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name={expandedPostIds.has(post.id) ? 'chatbubble' : 'chatbubble-outline'} size={13} color="#8a7060" />
                          <Text style={{ fontFamily: 'SpaceMono', fontSize: 9, color: '#8a7060', marginLeft: 4, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 0.5 }}>
                            {expandedPostIds.has(post.id) ? 'Hide' : 'Reply'}
                          </Text>
                        </Pressable>
                      </View>
                      {expandedPostIds.has(post.id) && <PostCommentSection postId={post.id} />}
                    </View>
                  );
                })
              )}
            </View>
          </ImageBackground>

          {/* ── COMMUNITY ACTIVITY FEED ── */}
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={{ color: '#3a3a3a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, marginBottom: 12, textTransform: 'uppercase' }}>
              Community Activity
            </Text>
            {communityLoading ? (
              <ActivityIndicator color="#f59e0b" />
            ) : !communityFeed?.length ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Ionicons name="radio-outline" size={40} color="#1f1f1f" />
                <Text style={{ color: '#2a2a2a', fontFamily: 'SpaceMono', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
                  Track more members to see their activity!
                </Text>
              </View>
            ) : (
              communityFeed?.map((item: any, idx: number) => {
                const profile = item.profiles;
                const isPost = item.activity_type === 'post';
                return (
                  <View key={item.id + idx} style={{ marginBottom: 16 }}>
                    {/* Author Row */}
                    <Pressable onPress={() => router.push(`/profile/${item.user_id}`)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#1a1a1a', overflow: 'hidden', marginRight: 10, borderWidth: 1, borderColor: '#2a2a2a' }}>
                        {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={14} color="#444" /></View>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#ddd', fontFamily: 'SpaceMono', fontSize: 12, fontWeight: 'bold' }}>@{profile?.username || 'member'}</Text>
                        <Text style={{ color: '#3a3a3a', fontFamily: 'SpaceMono', fontSize: 9, textTransform: 'uppercase' }}>
                          {isPost ? 'pinned a note' : `added to ${item.format} collection`} · {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Content */}
                    {isPost ? (
                      <View style={{ backgroundColor: '#111', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1f1f1f' }}>
                        <Text style={{ color: '#999', fontFamily: 'SpaceMono', fontSize: 12, lineHeight: 18, fontStyle: 'italic' }}>"{item.content}"</Text>
                        {(item.movies || item.shows) && (
                          <Pressable onPress={() => { const id = item.movies?.id || item.shows?.id; const t = item.movies ? 'movie' : 'show'; router.push(`/(tabs)/${t}/${id}`); }} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#0a0a0a', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#1f1f1f' }}>
                            <Image source={{ uri: getPosterUrl(item.movies?.poster_path || item.shows?.poster_path) || '' }} style={{ width: 28, height: 42, borderRadius: 2, marginRight: 8 }} />
                            <Text style={{ color: '#888', fontFamily: 'SpaceMono', fontSize: 11, flex: 1 }} numberOfLines={1}>{item.movies?.title || item.shows?.name}</Text>
                            <Ionicons name="chevron-forward" size={14} color="#333" />
                          </Pressable>
                        )}
                        <Pressable onPress={() => toggleComments(item.id)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                          <Ionicons name="chatbubble-outline" size={12} color={expandedPostIds.has(item.id) ? '#f59e0b' : '#333'} />
                          <Text style={{ color: expandedPostIds.has(item.id) ? '#f59e0b' : '#333', fontFamily: 'SpaceMono', fontSize: 9, marginLeft: 4, textTransform: 'uppercase', fontWeight: 'bold' }}>
                            {expandedPostIds.has(item.id) ? 'hide replies' : 'reply'}
                          </Text>
                        </Pressable>
                        {expandedPostIds.has(item.id) && <PostCommentSection postId={item.id} />}
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => { const id = item.movies?.id || item.shows?.id; const t = item.movies ? 'movie' : 'show'; router.push(`/(tabs)/${t}/${id}?ownerId=${item.user_id}`); }}
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#f59e0b18' }}
                      >
                        <Image source={{ uri: getPosterUrl(item.movies?.poster_path || item.shows?.poster_path) || '' }} style={{ width: 40, height: 58, borderRadius: 4, marginRight: 12, backgroundColor: '#1a1a1a' }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }} numberOfLines={1}>{item.movies?.title || item.shows?.name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ backgroundColor: '#f59e0b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, marginRight: 6 }}>
                              <Text style={{ color: '#000', fontFamily: 'SpaceMono', fontSize: 8, fontWeight: 'bold' }}>{item.format}</Text>
                            </View>
                            <Text style={{ color: '#3a3a3a', fontFamily: 'SpaceMono', fontSize: 9 }}>ADDED TO STACKS</Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#2a2a2a" />
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* ══════════════════════════ INBOX TAB ══════════════════════════ */}
      {activeTab === 'inbox' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#111' }}>
            <Text style={{ color: '#2a2a2a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>Direct Messages</Text>
          </View>
          {inboxLoading ? (
            <ActivityIndicator color="#f59e0b" style={{ marginTop: 40 }} />
          ) : !conversations?.length ? (
            <View style={{ marginTop: 80, alignItems: 'center', paddingHorizontal: 40 }}>
              <Ionicons name="chatbubbles-outline" size={56, } color="#1a1a1a" />
              <Text style={{ color: '#2a2a2a', fontFamily: 'SpaceMono', fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 18 }}>
                Inbox empty.{'\n'}Message a member from their profile to start a chat.
              </Text>
            </View>
          ) : (
            conversations.map((conv: any) => (
              <Pressable
                key={conv.partner.id}
                onPress={() => router.push(`/(tabs)/profile/chat/${conv.partner.id}`)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#0f0f0f' }}
              >
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#111', overflow: 'hidden', marginRight: 14, borderWidth: 1, borderColor: '#1f1f1f' }}>
                  {conv.partner.avatar_url ? <Image source={{ uri: conv.partner.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={22} color="#333" /></View>}
                  {conv.unreadCount > 0 && <View style={{ position: 'absolute', top: 0, right: 0, width: 14, height: 14, backgroundColor: '#f59e0b', borderRadius: 7, borderWidth: 2, borderColor: '#0a0a0a' }} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 13, fontWeight: 'bold' }}>@{conv.partner.username}</Text>
                    <Text style={{ color: '#333', fontFamily: 'SpaceMono', fontSize: 9 }}>{new Date(conv.lastMessage.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
                  </View>
                  <Text style={{ color: conv.unreadCount > 0 ? '#f59e0b' : '#444', fontFamily: 'SpaceMono', fontSize: 11, fontWeight: conv.unreadCount > 0 ? 'bold' : 'normal' }} numberOfLines={1}>
                    {conv.lastMessage.sender_id === userId ? 'You: ' : ''}{conv.lastMessage.content}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#1f1f1f" style={{ marginLeft: 8 }} />
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* ══════════════════════════ ALERTS TAB ══════════════════════════ */}
      {activeTab === 'alerts' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#111' }}>
            <Text style={{ color: '#2a2a2a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>Alerts</Text>
          </View>
          {notifLoading ? (
            <ActivityIndicator color="#f59e0b" style={{ marginTop: 40 }} />
          ) : !notifications?.length ? (
            <View style={{ marginTop: 80, alignItems: 'center', paddingHorizontal: 40, opacity: 0.3 }}>
              <Ionicons name="notifications-off-outline" size={56} color="#525252" />
              <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 11, textAlign: 'center', marginTop: 16 }}>All quiet.</Text>
            </View>
          ) : (
            notifications.map((n: any) => (
              <Pressable
                key={n.id}
                onPress={() => {
                  markRead.mutate(n.id);
                  if (n.type === 'message') router.push(`/(tabs)/profile/chat/${n.actor_id}`);
                  else if (n.type === 'follow') router.push(`/profile/${n.actor_id}`);
                  else if (n.type === 'post_comment') router.push('/(tabs)/community');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#0f0f0f', backgroundColor: !n.is_read ? 'rgba(245,158,11,0.04)' : 'transparent' }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#111', overflow: 'hidden', marginRight: 12, borderWidth: 1, borderColor: '#1f1f1f', alignItems: 'center', justifyContent: 'center' }}>
                  {n.actor?.avatar_url ? <Image source={{ uri: n.actor.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name={notifIcon(n.type) as any} size={18} color="#f59e0b" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: n.is_read ? '#555' : '#ddd', fontFamily: 'SpaceMono', fontSize: 12, fontWeight: n.is_read ? 'normal' : 'bold' }}>{notifMessage(n)}</Text>
                  <Text style={{ color: '#333', fontFamily: 'SpaceMono', fontSize: 9, marginTop: 2, textTransform: 'uppercase' }}>
                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(n.created_at).toLocaleDateString()}
                  </Text>
                </View>
                {!n.is_read && <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#f59e0b', marginLeft: 8 }} />}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
