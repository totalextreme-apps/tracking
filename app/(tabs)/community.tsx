import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, ImageBackground, TextInput, ActivityIndicator, Alert, Share, Modal, RefreshControl } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useCollection, useCustomListPreview } from '@/hooks/useCollection';
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
  useItemComments,
  useCreateComment,
  useMarketplaceFeed,
  useAllUsers,
  useDeleteConversation,
  useDeleteNotification,
  useClearReadNotifications,
  useAppWideStats
} from '@/hooks/useSocial';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { ConfirmModal } from '@/components/ConfirmModal';
import { searchMedia, TmdbMediaResult, getMovieById, getTvShowById } from '@/lib/tmdb';
import { BulletinPostItem } from '@/components/BulletinPostItem';
import { MemberCard } from '@/components/MemberCard';
import { ReorderTopFiveModal } from '@/components/ReorderTopFiveModal';
import { SwapMeetView } from '@/components/SwapMeetView';
import { useReactions } from '@/hooks/useReactions';
import { ReactionSummary } from '@/components/ReactionSummary';
import { ReactionPicker } from '@/components/ReactionPicker';

const CORK_BG = 'https://www.transparenttextures.com/patterns/cork-board.png';

type Tab = 'activity' | 'directory' | 'board' | 'inbox' | 'alerts' | 'swap';

function MovieReactionSection({ collectionItemId, userId }: { collectionItemId: string; userId?: string }) {
  const { playSound } = useSound();
  const { reactions = [], toggleReaction } = useReactions('collection_item_id', collectionItemId);
  const [pickerVisible, setPickerVisible] = useState(false);

  if (!userId) return null;

  return (
    <View style={{ alignSelf: 'flex-end', marginTop: 4 }}>
      <ReactionSummary
        reactions={reactions}
        currentUserId={userId}
        onReact={(emoji) => toggleReaction({ userId, emoji })}
        onShowPicker={() => setPickerVisible(true)}
      />
      <ReactionPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(emoji) => toggleReaction({ userId, emoji })}
        currentReaction={reactions.find(r => r.user_id === userId)?.reaction_type}
      />
    </View>
  );
}

function ItemCommentSectionInline({ collectionItemId, initialComments, isFocused }: { collectionItemId: string, initialComments?: any[], isFocused?: boolean }) {
  const { userId } = useAuth();
  const { playSound } = useSound();
  const { data: comments, isLoading } = useItemComments(collectionItemId, initialComments);
  const createComment = useCreateComment(userId);
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isFocused) {
      inputRef.current?.focus();
    }
  }, [isFocused]);

  const handleSend = () => {
    if (!text.trim()) return;
    createComment.mutate({ collectionItemId, content: text.trim() }, {
      onSuccess: () => {
        setText('');
        playSound('click');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onError: (err: any) => {
        console.error('Error posting comment:', err);
        Alert.alert('Error', err.message || 'Failed to post comment');
      }
    });
  };

  if (!userId) return null;

  return (
    <View style={{ marginTop: 8, backgroundColor: '#0f0f0f', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#1f1f1f' }}>
      {isLoading ? (
        <ActivityIndicator size="small" color="#f59e0b" style={{ marginVertical: 8 }} />
      ) : (
        comments && comments.length > 0 && (
          <View style={{ marginBottom: 8, gap: 6 }}>
            {comments.map((c: any) => (
              <View key={c.id} style={{ borderLeftWidth: 1, borderLeftColor: '#f59e0b44', paddingLeft: 8 }}>
                <Text style={{ color: '#aaa', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold' }}>
                  @{c.profiles?.username || 'member'}:
                </Text>
                <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 9, marginTop: 1 }}>
                  {c.content}
                </Text>
              </View>
            ))}
          </View>
        )
      )}

      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <TextInput
          ref={inputRef}
          style={{ flex: 1, backgroundColor: '#1a1a1a', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, color: '#fff', fontFamily: 'SpaceMono', fontSize: 9, borderWidth: 1, borderColor: '#2c2c2c' }}
          placeholder="Add a reply..."
          placeholderTextColor="#525252"
          value={text}
          onChangeText={setText}
        />
        <Pressable 
          onPress={handleSend} 
          disabled={createComment.isPending || !text.trim()}
          style={{ backgroundColor: '#f59e0b', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, opacity: text.trim() ? 1 : 0.5 }}
        >
          {createComment.isPending ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons name="send" size={10} color="#000" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function PostCommentSection({ postId, initialComments, isFocused }: { postId: string, initialComments?: any[], isFocused?: boolean }) {
  const router = useRouter();
  const { userId } = useAuth();
  const { playSound } = useSound();
  const { data: comments, isLoading } = usePostComments(postId, initialComments);
  const createComment = useCreatePostComment(userId);
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isFocused) {
      inputRef.current?.focus();
    }
  }, [isFocused]);

  const handleSend = () => {
    if (!text.trim()) return;
    createComment.mutate({ postId, content: text }, {
      onSuccess: () => {
        setText('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onError: (err: any) => {
        console.error('Error posting comment:', err);
        Alert.alert('Error', err.message || 'Failed to post comment');
      }
    });
  };

  const handleMentionPress = async (username: string) => {
    try {
      const { data } = await supabase.from('profiles').select('id').eq('username', username).single();
      if (data?.id) {
        router.push(`/profile/${data.id}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const renderContentRich = (content: string) => {
    if (!content) return null;
    const tokenRegex = /(\*\*.*?\*\*|\*.*?\*|@\w+)/g;
    const parts = content.split(tokenRegex);
    return (
      <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, color: '#2d2016', lineHeight: 14 }}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <Text key={i} style={{ fontWeight: 'bold' }}>{part.slice(2, -2)}</Text>;
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return <Text key={i} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</Text>;
          }
          if (part.startsWith('@') && part.length > 1) {
            const username = part.substring(1);
            return (
              <Text 
                key={i} 
                style={{ color: '#f59e0b', fontWeight: 'bold' }} 
                onPress={() => handleMentionPress(username)}
              >
                {part}
              </Text>
            );
          }
          return <Text key={i}>{part}</Text>;
        })}
      </Text>
    );
  };

  if (isLoading) return <ActivityIndicator size="small" color="#8a7060" style={{ marginTop: 10 }} />;

  return (
    <View style={{ marginTop: 10, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 6, padding: 8 }}>
      {(comments || []).map((c: any) => (
        <View key={c.id} style={{ marginBottom: 6, borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.1)', paddingLeft: 8 }}>
          <Text style={{ fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', color: '#4a3728' }}>@{c.profiles?.username}</Text>
          {renderContentRich(c.content)}
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <TextInput
          ref={inputRef}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, color: '#2d2016', fontFamily: 'SpaceMono', fontSize: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}
          placeholder="Reply..."
          placeholderTextColor="#a89880"
          value={text}
          onChangeText={setText}
        />
        <Pressable 
          onPress={handleSend}
          disabled={createComment.isPending || !text.trim()}
          style={{ backgroundColor: '#2d2016', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 6, opacity: text.trim() ? 1 : 0.5 }}
        >
          <Ionicons name="send" size={10} color="#f59e0b" />
        </Pressable>
      </View>
    </View>
  );
}

function MarketplaceSection({ setActiveTab, setSelectedSwapTitleKey }: { setActiveTab: (tab: Tab) => void; setSelectedSwapTitleKey: (key: string | null) => void }) {
  const router = useRouter();
  const { playSound } = useSound();
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
    <View style={{
      marginHorizontal: 16,
      marginBottom: 24,
      backgroundColor: '#0a0a0a',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: '#f59e0b', // Highlighted with amber border!
      paddingVertical: 12,
      shadowColor: '#f59e0b',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6,
    }}>
      <Pressable 
        onPress={() => { setActiveTab('swap'); playSound('click'); }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}
      >
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>★ COMMUNITY SWAP MEET ★</Text>
          <Text style={{ color: '#525252', fontFamily: 'SpaceMono', fontSize: 7, textTransform: 'uppercase', marginTop: 2 }}>{filteredMarketplace.length} Items Available • Tap to browse hub</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#f59e0b44' }}>
          <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 8, fontWeight: 'bold' }}>GO TO HUB</Text>
          <Ionicons name="arrow-forward" size={8} color="#f59e0b" />
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
        <Text style={{ color: '#737373', fontFamily: 'SpaceMono', fontSize: 8 }}>PREVIEW & FILTER</Text>
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
           <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 10 }}>No matches in the swap meet.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {filteredMarketplace.map((item: any) => (
            <Pressable 
              key={item.id} 
              onPress={() => {
                const mediaType = item.movies ? 'movie' : 'tv';
                const dbId = item.movie_id || item.show_id;
                setSelectedSwapTitleKey(`${mediaType}_${dbId}`);
                setActiveTab('swap');
                playSound('click');
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

function StoreChartsSection({ stats }: { stats: any }) {
  const router = useRouter();
  if (!stats) return null;

  const mostOwned = stats.most_owned || [];
  const mostWanted = stats.most_wanted || [];

  if (mostOwned.length === 0 && mostWanted.length === 0) return null;

  const getPosterUrl = (path: string | null) => {
    if (!path) return 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=300&auto=format&fit=crop';
    if (path.startsWith('http')) return path;
    return `https://image.tmdb.org/t/p/w300${path}`;
  };

  const renderShelf = (title: string, subtitle: string, items: any[], countLabel: string, color: string) => {
    if (items.length === 0) return null;
    return (
      <View style={{ marginBottom: 24 }}>
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 12, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>
            {title}
          </Text>
          <Text style={{ color: '#525252', fontFamily: 'SpaceMono', fontSize: 8, textTransform: 'uppercase', marginTop: 2 }}>
            {subtitle}
          </Text>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {items.map((item: any, idx: number) => {
            const mediaTitle = item.movie_title || item.show_name || 'Unknown Title';
            const mediaPoster = item.movie_poster || item.show_poster;
            const mediaType = item.movie_id ? 'movie' : 'show';
            const mediaId = item.movie_id || item.show_id;

            return (
              <Pressable
                key={idx}
                onPress={() => { if (mediaId) router.push(`/${mediaType}/${mediaId}?from=community`); }}
                style={{ width: 100, backgroundColor: '#0a0a0a', padding: 6, borderRadius: 8, borderWidth: 1, borderColor: '#1f1f1f', alignItems: 'center' }}
              >
                <View style={{ position: 'absolute', top: -4, left: -4, zIndex: 10, backgroundColor: color, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#000' }}>
                  <Text style={{ color: '#000', fontFamily: 'SpaceMono', fontSize: 8, fontWeight: 'bold' }}>#{idx + 1}</Text>
                </View>
                <Image 
                  source={{ uri: getPosterUrl(mediaPoster) || '' }} 
                  style={{ width: '100%', height: 120, borderRadius: 6, backgroundColor: '#111', marginBottom: 6 }} 
                />
                <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', textAlign: 'center', width: '100%' }} numberOfLines={1}>
                  {mediaTitle.toUpperCase()}
                </Text>
                <View style={{ backgroundColor: '#111', marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#1f1f1f' }}>
                  <Text style={{ color: '#888', fontFamily: 'SpaceMono', fontSize: 7, fontWeight: 'bold' }}>
                    {item.count} {countLabel}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', backgroundColor: '#050505', marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 }}>
        <Ionicons name="stats-chart" size={16} color="#f59e0b" style={{ marginRight: 8 }} />
        <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 13, fontWeight: 'bold', letterSpacing: 4, textTransform: 'uppercase' }}>
          ★ Store Charts
        </Text>
      </View>
      {renderShelf('Most Circulated', 'The most owned titles in the community', mostOwned, 'COPIES', '#f59e0b')}
      {renderShelf('Most Wanted / Grails', 'The most wishlisted titles in the community', mostWanted, 'WANTS', '#ef4444')}
    </View>
  );
}

export default function CommunityScreen() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { userId } = useAuth();
  const { playSound } = useSound();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const boardScrollRef = useRef<ScrollView>(null);

  // Auto-repair any mismatched bulletin posts on mount
  useEffect(() => {
    if (!userId) return;
    
    const autoRepairPosts = async () => {
      try {
        const { data: posts } = await supabase
          .from('bulletin_posts')
          .select('id, collection_item_id, movie_id, show_id')
          .eq('user_id', userId);

        if (posts && posts.length > 0) {
          let updatedCount = 0;
          for (const post of posts) {
            if (post.collection_item_id) {
              const { data: colItem } = await supabase
                .from('collection_items')
                .select('movie_id, show_id')
                .eq('id', post.collection_item_id)
                .maybeSingle();

              if (colItem) {
                // If there's a mismatch between the post's movie/show ID and the collection item's movie/show ID, repair it!
                const isMovieMismatch = colItem.movie_id && post.movie_id !== colItem.movie_id;
                const isShowMismatch = colItem.show_id && post.show_id !== colItem.show_id;
                
                if (isMovieMismatch || isShowMismatch) {
                  await supabase
                    .from('bulletin_posts')
                    .update({
                      movie_id: colItem.movie_id,
                      show_id: colItem.show_id
                    } as any)
                    .eq('id', post.id);
                  updatedCount++;
                }
              }
            }
          }
          if (updatedCount > 0) {
            // Refresh feed cache if any updates occurred
            queryClient.invalidateQueries({ queryKey: ['bulletin'] });
            queryClient.invalidateQueries({ queryKey: ['community_feed'] });
          }
        }
      } catch (err) {
        console.error('Failed to auto-repair bulletin posts:', err);
      }
    };

    autoRepairPosts();
  }, [userId]);

  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [userSearch, setUserSearch] = useState('');
  
  // Swap Meet preselected title key
  const [selectedSwapTitleKey, setSelectedSwapTitleKey] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  
  // WYSIWYG Selection States
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['community_feed', userId] }),
        queryClient.invalidateQueries({ queryKey: ['following', userId] }),
        queryClient.invalidateQueries({ queryKey: ['conversations', userId] }),
        queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
        queryClient.invalidateQueries({ queryKey: ['bulletin', userId] }),
        queryClient.invalidateQueries({ queryKey: ['bulletin_feed'] })
      ]);
    } catch (e) {
      console.error('Failed to manually refresh community tabs data:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleInsertStyle = (syntax: string) => {
    const start = selection.start;
    const end = selection.end;
    const before = postContent.substring(0, start);
    const selectedText = postContent.substring(start, end);
    const after = postContent.substring(end);
    let newText;
    if (start === end) {
      newText = `${before}${syntax}text${syntax}${after}`;
    } else {
      newText = `${before}${syntax}${selectedText}${syntax}${after}`;
    }
    setPostContent(newText);
    playSound('click');
  };
  
  // Bulletin Logic
  const [postContent, setPostContent] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Mentions & Stacks Logic
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionsDropdown, setShowMentionsDropdown] = useState(false);
  const [selectedStack, setSelectedStack] = useState<string | null>(null);
  const { data: collection } = useCollection(userId);
  const userStacks = useMemo(() => Array.from(new Set(collection?.flatMap((i: any) => i.custom_lists || []))) as string[], [collection]);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setCanScrollLeft(contentOffset.x > 10);
    setCanScrollRight(contentOffset.x < contentSize.width - layoutMeasurement.width - 10);
  };
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const { tab, postId } = useLocalSearchParams<{ tab?: string; postId?: string }>();
  
  React.useEffect(() => {
    if (tab === 'board') {
      setActiveTab('board');
      if (postId) {
        setExpandedPostIds(prev => new Set(prev).add(postId));
      }
    }
  }, [tab, postId]);
  
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
  const [pulseFilter, setPulseFilter] = useState<'all' | 'collection' | 'notes' | 'comments'>('all');

  // Data
  const { data: following } = useFollowing(userId);
  const { data: bulletinFeed, isLoading: bulletinLoading } = useBulletinFeed(userId, activeTab === 'board');
  const { data: communityFeed, isLoading: communityLoading } = useCommunityFeed(userId);
  const { data: marketplaceFeed } = useMarketplaceFeed();
  const { data: searchResults, isLoading: searchLoading } = useSearchUsers(userSearch);
  const { data: notifications, isLoading: notifLoading } = useNotifications(userId);
  const { data: suggestedMembers } = useSuggestedUsers(userId);
  const { data: allUsers, isLoading: allUsersLoading } = useAllUsers(userId, activeTab === 'directory');
  const { data: conversations, isLoading: inboxLoading } = useConversations(userId);
  const { data: appWideStats } = useAppWideStats();

  const [isNetworkExpanded, setIsNetworkExpanded] = useState(false);
  const [reorderTopFiveVisible, setReorderTopFiveVisible] = useState(false);

  const { top5, others, networkMembers } = useMemo(() => {
    if (!following) return { top5: [], others: [], networkMembers: [] };
    const top5 = following.filter((f: any) => f.is_top_five);
    const others = following.filter((f: any) => !f.is_top_five);
    return { top5, others, networkMembers: [...top5, ...others] };
  }, [following]);

  const processedCommunityFeed = useMemo(() => {
    if (!communityFeed) return [];
    
    let sorted = [...communityFeed]
      .filter((item: any) => {
          if (pulseFilter === 'collection' && item.activity_type !== 'update') return false;
          if (pulseFilter === 'notes' && item.activity_type !== 'post') return false;
          if (pulseFilter === 'comments' && item.activity_type !== 'comment') return false;
          return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
    let grouped: any[] = [];
    
    for (let item of sorted) {
      if (item.activity_type === 'post' || item.activity_type === 'comment') {
        grouped.push(item);
      } else {
        const itemDate = new Date(item.created_at).toDateString();
        const lastGroup = grouped[grouped.length - 1];
        if (lastGroup && lastGroup.type === 'story_group' && lastGroup.user_id === item.user_id && lastGroup.date === itemDate) {
           lastGroup.items.push(item);
        } else {
           grouped.push({
              type: 'story_group',
              id: `group-${item.id}`,
              user_id: item.user_id,
              profiles: item.profiles,
              date: itemDate,
              items: [item]
           });
        }
      }
    }
    return grouped;
  }, [communityFeed, pulseFilter]);

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
  const deleteConversation = useDeleteConversation(userId);
  const deleteNotification = useDeleteNotification(userId);
  const clearReadNotifications = useClearReadNotifications(userId);

  const isFollowing = (targetId: string) => following?.some((f: any) => f.following_id === targetId);
  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;
  const unreadInboxCount = conversations?.reduce((sum: number, conv: any) => sum + (conv.unreadCount || 0), 0) || 0;

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
        custom_list_name: selectedStack || undefined,
        rating
      }, {
        onSuccess: () => {
          resetPost();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      });
    }
  };

  const startEditing = (post: any) => {
    setEditingPostId(post.id);
    setPostContent(post.content || '');
    setRating(post.rating || undefined);
    setSelectedStack(post.custom_list_name || null);
    if (post.movies) {
      setSelectedMedia({ ...post.movies, media_type: 'movie' } as TmdbMediaResult);
    } else if (post.shows) {
      setSelectedMedia({ ...post.shows, media_type: 'tv' } as TmdbMediaResult);
    } else {
      setSelectedMedia(null);
    }
    setActiveTab('board');
    setTimeout(() => {
      boardScrollRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const resetPost = () => {
    setPostContent('');
    setSelectedMedia(null);
    setSelectedStack(null);
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
      case 'message': return 'chatbubbles-outline';
      case 'item_comment': return 'chatbox-ellipses-outline';
      case 'post_comment': return 'chatbox-outline';
      case 'profile_comment': return 'book-outline';
      case 'follow': return 'person-add-outline';
      case 'reaction': return 'heart-outline';
      case 'mention':
      case 'post_mention':
      case 'comment_mention': return 'at-outline';
      default: return 'notifications-outline';
    }
  };

  const notifMessage = (n: any) => {
    const actorName = n.actor?.username || 'Someone';
    switch (n.type) {
      case 'message': return `@${actorName} sent you a message`;
      case 'item_comment': {
        const colItem = n.referenceData?.collection_items;
        const title = colItem?.movies?.title || colItem?.shows?.name;
        return title ? `@${actorName} commented on "${title}"` : `@${actorName} commented on your item`;
      }
      case 'post_comment': return `@${actorName} replied to your post`;
      case 'profile_comment': return `@${actorName} signed your guestbook`;
      case 'follow': return `@${actorName} started tracking you`;
      case 'post_mention': return `@${actorName} mentioned you in a post`;
      case 'comment_mention': return `@${actorName} mentioned you in a reply`;
      case 'mention': return `@${actorName} mentioned you`;
      case 'reaction': {
        const rxType = n.referenceData?.reaction_type;
        const emojiMap: Record<string, string> = {
          like: '👍',
          love: '❤️',
          laugh: '😂',
          dislike: '👎'
        };
        const emoji = rxType ? (emojiMap[rxType] || rxType) : 'a reaction';
        return `@${actorName} reacted ${emoji} to your activity`;
      }
      default: return 'New activity';
    }
  };

  const handleNotificationPress = async (n: any) => {
    markRead.mutate(n.id);
    try {
      if (n.type === 'message') {
        router.push(`/profile/chat/${n.actor_id}?from=community`);
      } else if (n.type === 'follow') {
        router.push(`/profile/${n.actor_id}?from=community`);
      } else if (n.type === 'post_comment' || n.type === 'comment_mention') {
        let postId = n.referenceData?.post_id;
        if (!postId) {
          const { data } = await supabase
            .from('post_comments')
            .select('post_id')
            .eq('id', n.reference_id)
            .single();
          postId = data?.post_id;
        }
        if (postId) {
          setExpandedPostIds(prev => new Set(prev).add(postId));
          setActiveTab('board');
        }
      } else if (n.type === 'post_mention') {
        setExpandedPostIds(prev => new Set(prev).add(n.reference_id));
        setActiveTab('board');
      } else if (n.type === 'item_comment') {
        let item = n.referenceData;
        if (!item || !item.collection_items) {
          const { data } = await supabase
            .from('item_comments')
            .select('*, collection_items(*, movies(*), shows(*))')
            .eq('id', n.reference_id)
            .single();
          item = data;
        }
        const colItem = item?.collection_items;
        if (colItem) {
          const ownerId = colItem.user_id;
          if (colItem.movies) {
            router.push(`/movie/${colItem.id}?ownerId=${ownerId}&from=community`);
          } else if (colItem.shows) {
            router.push(`/show/${colItem.id}?ownerId=${ownerId}&season=${colItem.season_number || 1}&from=community`);
          }
        }
      } else if (n.type === 'reaction') {
        let rx = n.referenceData;
        if (!rx) {
          const { data } = await supabase
            .from('reactions')
            .select('*')
            .eq('id', n.reference_id)
            .single();
          rx = data;
        }
        if (rx) {
          if (rx.post_id) {
            setExpandedPostIds(prev => new Set(prev).add(rx.post_id));
            setActiveTab('board');
          } else if (rx.post_comment_id) {
            const { data } = await supabase
              .from('post_comments')
              .select('post_id')
              .eq('id', rx.post_comment_id)
              .single();
            if (data?.post_id) {
              setExpandedPostIds(prev => new Set(prev).add(data.post_id));
              setActiveTab('board');
            }
          } else if (rx.collection_item_id) {
            const { data: colItem } = await supabase
              .from('collection_items')
              .select('*, movies(*), shows(*)')
              .eq('id', rx.collection_item_id)
              .single();
            if (colItem) {
              const ownerId = colItem.user_id;
              if (colItem.movies) {
                router.push(`/movie/${colItem.id}?ownerId=${ownerId}&from=community`);
              } else if (colItem.shows) {
                router.push(`/show/${colItem.id}?ownerId=${ownerId}&season=${colItem.season_number || 1}&from=community`);
              }
            }
          } else if (rx.item_comment_id) {
            const { data: comment } = await supabase
              .from('item_comments')
              .select('*, collection_items(*, movies(*), shows(*))')
              .eq('id', rx.item_comment_id)
              .single();
            const colItem = comment?.collection_items;
            if (colItem) {
              const ownerId = colItem.user_id;
              if (colItem.movies) {
                router.push(`/movie/${colItem.id}?ownerId=${ownerId}&from=community`);
              } else if (colItem.shows) {
                router.push(`/show/${colItem.id}?ownerId=${ownerId}&season=${colItem.season_number || 1}&from=community`);
              }
            }
          }
        }
      } else if (n.type === 'profile_comment') {
        router.push({ pathname: `/profile/${userId}`, params: { from: 'community' } } as any);
      }
    } catch (e) {
      console.error('Failed to handle notification click navigation:', e);
    }
  };

  const mainTabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'activity', label: 'Activity' },
    { key: 'directory', label: 'Directory' },
    { key: 'board', label: 'Board' },
    { key: 'swap', label: 'Swap Meet' },
  ];

  if (!isMounted) {
    return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />;
  }

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
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8, backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
        <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 18, fontWeight: 'bold', letterSpacing: 4, textAlign: 'center', marginBottom: 14 }}>
          COMMUNITY
        </Text>

        {/* Row 1: Main Tabs */}
        <View style={{ marginBottom: 10, position: 'relative' }}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={{ backgroundColor: '#111', borderRadius: 10, padding: 3 }}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={(w, h) => {
              // Initial check if content is wider than container
              if (w <= 300) setCanScrollRight(false); // Approximation or use layout ref
            }}
          >
            {mainTabs.map(tab => (
              <Pressable
                key={tab.key}
                onPress={() => { 
                  if (tab.key === 'profile') {
                    router.push({ pathname: `/profile/${userId}`, params: { from: 'community' } } as any);
                    return;
                  }
                  setActiveTab(tab.key as Tab); 
                  Haptics.selectionAsync(); 
                }}
                style={{
                  paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8,
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
          </ScrollView>

          {/* Indicators */}
          {canScrollLeft && (
            <LinearGradient
              colors={['#111', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', left: 0, top: 3, bottom: 3, width: 30, borderRadius: 10, pointerEvents: 'none' }}
            />
          )}
          {canScrollRight && (
            <LinearGradient
              colors={['transparent', '#111']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', right: 0, top: 3, bottom: 3, width: 30, borderRadius: 10, pointerEvents: 'none' }}
            />
          )}
        </View>

        {/* Row 2: Communication / Notification Tabs (Inbox & Alerts) */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
          {/* Inbox Button */}
          <Pressable
            onPress={() => {
              setActiveTab('inbox');
              Haptics.selectionAsync();
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: activeTab === 'inbox' ? '#f59e0b' : '#1c1c1c',
              backgroundColor: activeTab === 'inbox' ? '#f59e0b10' : '#111',
            }}
          >
            <Ionicons 
              name={activeTab === 'inbox' ? "mail" : "mail-outline"} 
              size={14} 
              color={activeTab === 'inbox' ? '#f59e0b' : '#525252'} 
              style={{ marginRight: 6 }}
            />
            <Text style={{
              fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold',
              color: activeTab === 'inbox' ? '#f59e0b' : '#525252',
              letterSpacing: 1,
            }}>
              INBOX
            </Text>
            {unreadInboxCount > 0 && (
              <View style={{
                backgroundColor: '#f59e0b',
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                justifyContent: 'center',
                alignItems: 'center',
                marginLeft: 6,
                paddingHorizontal: 4,
              }}>
                <Text style={{ color: '#000', fontFamily: 'SpaceMono', fontSize: 8, fontWeight: 'bold' }}>
                  {unreadInboxCount}
                </Text>
              </View>
            )}
          </Pressable>

          {/* Alerts Button */}
          <Pressable
            onPress={() => {
              setActiveTab('alerts');
              Haptics.selectionAsync();
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: activeTab === 'alerts' ? '#f59e0b' : '#1c1c1c',
              backgroundColor: activeTab === 'alerts' ? '#f59e0b10' : '#111',
            }}
          >
            <Ionicons 
              name={activeTab === 'alerts' ? "notifications" : "notifications-outline"} 
              size={14} 
              color={activeTab === 'alerts' ? '#f59e0b' : '#525252'} 
              style={{ marginRight: 6 }}
            />
            <Text style={{
              fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold',
              color: activeTab === 'alerts' ? '#f59e0b' : '#525252',
              letterSpacing: 1,
            }}>
              ALERTS
            </Text>
            {unreadCount > 0 && (
              <View style={{
                backgroundColor: '#ef4444',
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                justifyContent: 'center',
                alignItems: 'center',
                marginLeft: 6,
                paddingHorizontal: 4,
              }}>
                <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 8, fontWeight: 'bold' }}>
                  {unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* ══════════════════════════ ACTIVITY TAB ══════════════════════════ */}
      {activeTab === 'activity' && (
        <ScrollView
          key="tab-activity"
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#f59e0b"
              colors={['#f59e0b']}
              progressBackgroundColor="#111"
            />
          }
        >
          <MarketplaceSection setActiveTab={setActiveTab} setSelectedSwapTitleKey={setSelectedSwapTitleKey} />
          {/* Member Card Feed */}
          {/* Top 5 Members (Horizontal shelf style) */}
          {top5 && top5.length > 0 && (
            <View style={{ marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
              <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 13, fontWeight: 'bold', letterSpacing: 4, textTransform: 'uppercase' }}>
                  ★ Top 5 Members
                </Text>
                {top5.length > 1 && (
                  <Pressable 
                    onPress={() => { setReorderTopFiveVisible(true); playSound('click'); }}
                    style={{ backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#f59e0b22', borderRadius: 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    <Ionicons name="list" size={10} color="#f59e0b" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold' }}>REORDER</Text>
                  </Pressable>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 24 }}>
                {top5.map((f: any) => {
                  const profile = f.profiles;
                  return (
                    <Pressable 
                      key={f.following_id} 
                      onPress={() => router.push(`/profile/${f.following_id}?from=community`)}
                      style={{ alignItems: 'center', width: 72 }}
                    >
                      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#f59e0b', overflow: 'hidden', marginBottom: 8, justifyContent: 'center', alignItems: 'center', shadowColor: '#f59e0b', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}>
                        {profile?.avatar_url ? (
                          <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Ionicons name="person" size={24} color="#525252" />
                        )}
                      </View>
                      <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
                        @{profile?.username || 'member'}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* More Members (Button to Directory) */}
          {others && others.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
              <Pressable 
                onPress={() => setActiveTab('directory')}
                style={{ backgroundColor: '#111', paddingVertical: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#f59e0b33', flexDirection: 'row', justifyContent: 'center' }}
              >
                <Ionicons name="people" size={16} color="#f59e0b" style={{ marginRight: 8 }} />
                <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 }}>
                  SEE ALL MEMBERS ({others.length})
                </Text>
              </Pressable>
            </View>
          )}

          {(!networkMembers || networkMembers.length === 0) && (
             <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#111', marginHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#1f1f1f', marginBottom: 24 }}>
                <Ionicons name="people-outline" size={32} color="#f59e0b" style={{ marginBottom: 16 }} />
                <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>Your Video Store Network is Empty</Text>
                <Text style={{ color: '#525252', fontFamily: 'SpaceMono', fontSize: 11, textAlign: 'center' }}>Search for members or browse below to start tracking movie lovers.</Text>
             </View>
          )}

          {/* Store Charts (App-Wide Leaderboard) */}
          <StoreChartsSection stats={appWideStats} />

          {/* Pulse feed */}
          {/* Pulse feed */}
          <View style={{ paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 14, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>Community Pulse</Text>
              <View style={{ flexDirection: 'row', backgroundColor: '#111', borderRadius: 4, padding: 2 }}>
                {[
                  { id: 'all', label: 'ALL' },
                  { id: 'collection', label: 'ADDS' },
                  { id: 'notes', label: 'NOTES' },
                  { id: 'comments', label: 'COMMENTS' }
                ].map(p => (
                  <Pressable key={p.id} onPress={() => setPulseFilter(p.id as any)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2, backgroundColor: pulseFilter === p.id ? '#1c1c1c' : 'transparent' }}>
                    <Text style={{ color: pulseFilter === p.id ? '#f59e0b' : '#333', fontFamily: 'SpaceMono', fontSize: 7, fontWeight: 'bold' }}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {communityLoading ? <ActivityIndicator color="#f59e0b" /> : processedCommunityFeed.length === 0 ? (
               <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#1f1f1f', marginBottom: 24 }}>
                  <Ionicons name="pulse" size={32} color="#f59e0b" style={{ marginBottom: 16 }} />
                  <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>The Pulse is Quiet</Text>
                  <Text style={{ color: '#525252', fontFamily: 'SpaceMono', fontSize: 11, textAlign: 'center', lineHeight: 18 }}>When your network adds titles, pins notes, or comments on movies, they will appear here.</Text>
               </View>
            ) : (
              processedCommunityFeed.map((item: any, idx: number) => {
                if (item.type === 'story_group') {
                   const profile = item.profiles;
                   return (
                     <View key={item.id + '-' + idx} style={{ marginBottom: 20 }}>
                       <Pressable onPress={() => router.push(`/profile/${item.user_id}?from=community`)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                         <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a1a1a', overflow: 'hidden', marginRight: 8, borderWidth: 1, borderColor: '#222' }}>
                           {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={12} color="#444" />}
                         </View>
                         <View style={{ flex: 1 }}>
                           <Text style={{ color: '#ddd', fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold' }}>@{profile?.username || 'member'}</Text>
                           <Text style={{ color: '#333', fontFamily: 'SpaceMono', fontSize: 8, textTransform: 'uppercase' }}>
                             {(() => {
                               const hasUpdates = item.items.some((sub: any) => sub.activity_type === 'update');
                               const hasWatches = item.items.some((sub: any) => sub.activity_type === 'watch');
                               const hasListings = item.items.some((sub: any) => sub.activity_type === 'listing');
                               const count = item.items.length;
                               let actionText = '';
                               if (hasUpdates && !hasWatches && !hasListings) {
                                 actionText = `added ${count} ${count === 1 ? 'title' : 'titles'} to collection`;
                               } else if (hasWatches && !hasUpdates && !hasListings) {
                                 actionText = `watched ${count} ${count === 1 ? 'title' : 'titles'}`;
                               } else if (hasListings && !hasUpdates && !hasWatches) {
                                 actionText = `listed ${count} ${count === 1 ? 'title' : 'titles'} for sale/trade`;
                               } else {
                                 actionText = `updated ${count} ${count === 1 ? 'title' : 'titles'} in library`;
                               }
                               return `${actionText} · ${item.date}`;
                             })()}
                           </Text>
                         </View>
                       </Pressable>
                       <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4, paddingTop: 4 }}>
                          {item.items.map((sub: any, i: number) => (
                             <Pressable 
                               key={i} 
                               onPress={() => { const id = sub.movies?.id || sub.shows?.id; const t = sub.movies ? 'movie' : 'show'; router.push(`/${t}/${id}?ownerId=${sub.user_id}&from=community`); }} 
                               style={{ width: 62, height: 98, marginRight: 8, backgroundColor: '#0a0a0a', padding: 4, borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b18', justifyContent: 'space-between' }}
                             >
                               <Image source={{ uri: getPosterUrl(sub.movies?.poster_path || sub.shows?.poster_path) || '' }} style={{ width: 54, height: 74, borderRadius: 4, backgroundColor: '#1a1a1a' }} />
                               <View style={{ backgroundColor: '#1a1a1a', alignSelf: 'stretch', paddingVertical: 1, borderRadius: 2, alignItems: 'center' }}>
                                 <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 6, fontWeight: 'bold' }}>{sub.format}</Text>
                               </View>
                             </Pressable>
                          ))}
                       </ScrollView>

                        {/* Reaction / Comment Footer for Story Group */}
                         {(() => {
                            const firstItem = item.items[0];
                            if (!firstItem) return null;
                            return (
                               <View>
                                 <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 }}>
                                   <Pressable 
                                     onPress={() => {
                                       setFocusedItemId(null);
                                       setTimeout(() => setFocusedItemId(firstItem.id), 50);
                                     }}
                                     style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                   >
                                     <Ionicons name="chatbubble-outline" size={10} color="#737373" />
                                     <Text style={{ fontFamily: 'SpaceMono', fontSize: 8, color: '#737373' }}>
                                       COMMENT / REPLY
                                     </Text>
                                   </Pressable>
                                   <MovieReactionSection collectionItemId={firstItem.id} userId={userId || ''} />
                                 </View>
                                 <ItemCommentSectionInline collectionItemId={firstItem.id} initialComments={firstItem.item_comments} isFocused={focusedItemId === firstItem.id} />
                               </View>
                            );
                         })()}
                     </View>
                   );
                }
                
                if (item.activity_type === 'comment') {
                   const profile = item.profiles;
                   const collectionItem = item.collection_items;
                   const mediaTitle = collectionItem?.movies?.title || collectionItem?.shows?.name || 'a title';
                   const mediaType = collectionItem?.movies ? 'movie' : 'show';
                   const mediaId = collectionItem?.movies?.id || collectionItem?.shows?.id;
                   const ownerUsername = collectionItem?.profiles?.username || 'member';
                   const ownerId = collectionItem?.user_id;

                   return (
                     <View key={item.id + '-' + idx} style={{ marginBottom: 20 }}>
                       <Pressable onPress={() => router.push(`/profile/${item.user_id}?from=community`)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                         <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a1a1a', overflow: 'hidden', marginRight: 8, borderWidth: 1, borderColor: '#222' }}>
                           {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={12} color="#444" />}
                         </View>
                         <View style={{ flex: 1 }}>
                           <Text style={{ color: '#ddd', fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold' }}>@{profile?.username || 'member'}</Text>
                           <Text style={{ color: '#333', fontFamily: 'SpaceMono', fontSize: 8, textTransform: 'uppercase' }}>
                             commented on @{ownerUsername}'s title · {new Date(item.created_at).toLocaleDateString()}
                           </Text>
                         </View>
                       </Pressable>
                       
                       <View style={{ backgroundColor: '#111', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1a1a1a', borderLeftWidth: 3, borderLeftColor: '#f59e0b' }}>
                         <Text style={{ color: '#ccc', fontFamily: 'SpaceMono', fontSize: 12, lineHeight: 18, fontStyle: 'italic', marginBottom: 8 }}>"{item.content}"</Text>
                         
                         {collectionItem && (
                           <View>
                             <Pressable 
                               onPress={() => { if (mediaId) router.push(`/${mediaType}/${mediaId}?ownerId=${ownerId}&from=community`); }}
                               style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#222' }}
                             >
                               <Image 
                                 source={{ uri: getPosterUrl(collectionItem.movies?.poster_path || collectionItem.shows?.poster_path) || '' }} 
                                 style={{ width: 24, height: 36, borderRadius: 4, marginRight: 8, backgroundColor: '#1a1a1a' }} 
                               />
                               <View style={{ flex: 1 }}>
                                 <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 10, fontWeight: 'bold' }} numberOfLines={1}>{mediaTitle}</Text>
                                 <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                   <View style={{ backgroundColor: '#f59e0b22', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2, borderWidth: 1, borderColor: '#f59e0b44', marginRight: 4 }}>
                                     <Text style={{ color: '#f59e0b', fontSize: 6, fontFamily: 'SpaceMono', fontWeight: 'bold' }}>{collectionItem.format}</Text>
                                   </View>
                                   <Text style={{ color: '#444', fontFamily: 'SpaceMono', fontSize: 8 }}>@{ownerUsername}'S SHELF</Text>
                                 </View>
                               </View>
                               <Ionicons name="chevron-forward" size={12} color="#444" />
                             </Pressable>
                             <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#222' }}>
                               <Pressable 
                                 onPress={() => { if (mediaId) router.push(`/${mediaType}/${mediaId}?ownerId=${ownerId}&from=community`); }}
                                 style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                               >
                                 <Ionicons name="chatbubble-outline" size={10} color="#737373" />
                                 <Text style={{ fontFamily: 'SpaceMono', fontSize: 8, color: '#737373' }}>COMMENT / REPLY</Text>
                               </Pressable>
                               <MovieReactionSection collectionItemId={collectionItem.id} userId={userId || ''} />
                             </View>
                           </View>
                         )}
                       </View>
                     </View>
                   );
                }

                if (item.activity_type === 'watch') {
                    const profile = item.profiles;
                    const mediaTitle = item.movies?.title || item.shows?.name || 'a title';
                    const mediaType = item.movies ? 'movie' : 'show';
                    const mediaId = item.movies?.id || item.shows?.id;
                    const format = item.format;
                    const watchCount = item.watch_count;
                    const actionText = format === 'VHS' 
                        ? 'popped in a VHS tape' 
                        : format === 'Digital' 
                            ? 'streamed a title' 
                            : `spun a ${format} disc`;

                    return (
                      <View key={item.id + '-' + idx} style={{ marginBottom: 20 }}>
                        <Pressable onPress={() => router.push(`/profile/${item.user_id}?from=community`)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a1a1a', overflow: 'hidden', marginRight: 8, borderWidth: 1, borderColor: '#222' }}>
                            {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={12} color="#444" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#ddd', fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold' }}>@{profile?.username || 'member'}</Text>
                            <Text style={{ color: '#525252', fontFamily: 'SpaceMono', fontSize: 8, textTransform: 'uppercase' }}>
                              {actionText} · {new Date(item.created_at).toLocaleDateString()}
                            </Text>
                          </View>
                        </Pressable>
                        
                        <View style={{ backgroundColor: '#111', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1a1a1a', borderLeftWidth: 3, borderLeftColor: '#f59e0b' }}>
                          <Pressable 
                            onPress={() => { if (mediaId) router.push(`/${mediaType}/${mediaId}?ownerId=${item.user_id}&from=community`); }}
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                          >
                            <Image 
                              source={{ uri: getPosterUrl(item.movies?.poster_path || item.shows?.poster_path) || '' }} 
                              style={{ width: 40, height: 60, borderRadius: 6, marginRight: 12, backgroundColor: '#1a1a1a' }} 
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 12, fontWeight: 'bold' }} numberOfLines={1}>{mediaTitle}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <View style={{ backgroundColor: '#f59e0b22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#f59e0b44', marginRight: 8 }}>
                                  <Text style={{ color: '#f59e0b', fontSize: 8, fontFamily: 'SpaceMono', fontWeight: 'bold' }}>{format}</Text>
                                </View>
                                <Text style={{ color: '#737373', fontFamily: 'SpaceMono', fontSize: 10 }}>
                                  WATCH COUNT: {watchCount}
                                </Text>
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#444" />
                          </Pressable>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#222' }}>
                            <Pressable 
                              onPress={() => { if (mediaId) router.push(`/${mediaType}/${mediaId}?ownerId=${item.user_id}&from=community`); }}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            >
                              <Ionicons name="chatbubble-outline" size={10} color="#737373" />
                              <Text style={{ fontFamily: 'SpaceMono', fontSize: 8, color: '#737373' }}>COMMENT / REPLY</Text>
                            </Pressable>
                            <MovieReactionSection collectionItemId={item.id} userId={userId || ''} />
                          </View>
                        </View>
                      </View>
                    );
                 }

                if (item.activity_type === 'listing') {
                    const profile = item.profiles;
                    const mediaTitle = item.movies?.title || item.shows?.name || 'a title';
                    const mediaType = item.movies ? 'movie' : 'show';
                    const mediaId = item.movies?.id || item.shows?.id;
                    const format = item.format;
                    const actionText = (item.for_sale && item.for_trade) ? 'listed a title for sale & trade' : item.for_sale ? 'listed a title for sale' : 'listed a title for trade';

                    return (
                      <View key={item.id + '-' + idx} style={{ marginBottom: 20 }}>
                        <Pressable onPress={() => router.push(`/profile/${item.user_id}?from=community`)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a1a1a', overflow: 'hidden', marginRight: 8, borderWidth: 1, borderColor: '#222' }}>
                            {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={12} color="#444" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#ddd', fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold' }}>@{profile?.username || 'member'}</Text>
                            <Text style={{ color: '#525252', fontFamily: 'SpaceMono', fontSize: 8, textTransform: 'uppercase' }}>
                              {actionText} · {new Date(item.created_at).toLocaleDateString()}
                            </Text>
                          </View>
                        </Pressable>
                        
                        <View style={{ backgroundColor: '#111', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1a1a1a', borderLeftWidth: 3, borderLeftColor: '#10b981' }}>
                          <Pressable 
                            onPress={() => { if (mediaId) router.push(`/${mediaType}/${mediaId}?ownerId=${item.user_id}&from=community`); }}
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                          >
                            <Image 
                              source={{ uri: getPosterUrl(item.movies?.poster_path || item.shows?.poster_path) || '' }} 
                              style={{ width: 40, height: 60, borderRadius: 6, marginRight: 12, backgroundColor: '#1a1a1a' }} 
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 12, fontWeight: 'bold' }} numberOfLines={1}>{mediaTitle}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <View style={{ backgroundColor: '#f59e0b22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#f59e0b44', marginRight: 8 }}>
                                  <Text style={{ color: '#f59e0b', fontSize: 8, fontFamily: 'SpaceMono', fontWeight: 'bold' }}>{format}</Text>
                                </View>
                                {item.for_sale && (
                                  <View style={{ backgroundColor: '#10b98122', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#10b98144', marginRight: 4 }}>
                                    <Text style={{ color: '#10b981', fontSize: 8, fontFamily: 'SpaceMono', fontWeight: 'bold' }}>FOR SALE</Text>
                                  </View>
                                )}
                                {item.for_trade && (
                                  <View style={{ backgroundColor: '#3b82f622', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#3b82f644' }}>
                                    <Text style={{ color: '#3b82f6', fontSize: 8, fontFamily: 'SpaceMono', fontWeight: 'bold' }}>FOR TRADE</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#444" />
                          </Pressable>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#222' }}>
                            <Pressable 
                              onPress={() => { if (mediaId) router.push(`/${mediaType}/${mediaId}?ownerId=${item.user_id}&from=community`); }}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            >
                              <Ionicons name="chatbubble-outline" size={10} color="#737373" />
                              <Text style={{ fontFamily: 'SpaceMono', fontSize: 8, color: '#737373' }}>COMMENT / REPLY</Text>
                            </Pressable>
                            <MovieReactionSection collectionItemId={item.id} userId={userId || ''} />
                          </View>
                        </View>
                      </View>
                    );
                 }

                if (item.activity_type === 'post') {
                  return (
                    <View key={item.id + '-' + idx} style={{ marginBottom: 12 }}>
                      <BulletinPostItem 
                        post={item} 
                        userId={userId || ''} 
                        idx={idx}
                        startEditing={startEditing}
                        setShowDeleteConfirm={setShowDeleteConfirm}
                        isFocused={focusedPostId === item.id}
                        onReplyPress={() => {
                          setFocusedPostId(null);
                          setTimeout(() => setFocusedPostId(item.id), 50);
                        }}
                        CommentSectionComponent={PostCommentSection}
                      />
                    </View>
                  );
                }

                const profile = item.profiles;
                return (
                  <View key={item.id + '-' + idx} style={{ marginBottom: 20 }}>
                    <Pressable onPress={() => router.push(`/profile/${item.user_id}?from=community`)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a1a1a', overflow: 'hidden', marginRight: 8, borderWidth: 1, borderColor: '#222' }}>
                        {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={12} color="#444" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#ddd', fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold' }}>@{profile?.username || 'member'}</Text>
                        <Text style={{ color: '#333', fontFamily: 'SpaceMono', fontSize: 8, textTransform: 'uppercase' }}>
                          pinned a note · {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </Pressable>
                    <View style={{ backgroundColor: '#111', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1a1a1a', borderLeftWidth: 3, borderLeftColor: '#f59e0b' }}>
                      <Text style={{ color: '#ccc', fontFamily: 'SpaceMono', fontSize: 12, lineHeight: 18, fontStyle: 'italic' }}>"{item.content}"</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Suggested Members (Shared Tastes) */}
          {suggestedMembers && suggestedMembers.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#1a1a1a' }}>
              <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 13, fontWeight: 'bold', letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' }}>Suggested For You</Text>
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
          key="tab-directory"
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
            <View style={{ backgroundColor: '#222', padding: 8, borderRadius: 12, borderWidth: 4, borderColor: '#333' }}>
               <View style={{ backgroundColor: '#050505', padding: 20, borderRadius: 4, borderWidth: 1, borderColor: '#00ff0033' }}>
                  
                  {/* Top Bar */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                     <Text style={{ fontFamily: 'SpaceMono', color: '#00ff00', fontSize: 10 }}>VIDEO STORE SYSTEM v1.0.1</Text>
                     <Text style={{ fontFamily: 'SpaceMono', color: '#00ff00', fontSize: 10 }}>ONLINE</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: '#00ff00', opacity: 0.3, marginBottom: 20 }} />
                  
                  {/* Stats Block */}
                  <Text style={{ fontFamily: 'SpaceMono', color: '#00ff00', fontSize: 12, marginBottom: 12, letterSpacing: 1 }}>{`STORE MEMBERS............... ${(allUsers?.length || 0).toString().padStart(6, '0')}`}</Text>
                  <Text style={{ fontFamily: 'SpaceMono', color: '#00ff00', fontSize: 12, marginBottom: 12, letterSpacing: 1 }}>{`TITLES IN CIRCULATION....... 003390`}</Text>
                  <Text style={{ fontFamily: 'SpaceMono', color: '#00ff00', fontSize: 12, marginBottom: 12, letterSpacing: 1 }}>{`SPECIAL REQUESTS............ 000631`}</Text>
                  <Text style={{ fontFamily: 'SpaceMono', color: '#00ff00', fontSize: 12, marginBottom: 24, letterSpacing: 1 }}>{`MOST WANTED................. 000029`}</Text>
                  
                  {/* Member Listing */}
                  {allUsersLoading ? (
                     <ActivityIndicator color="#00ff00" style={{ padding: 24 }} />
                  ) : (
                     <View>
                        {(allUsers || []).map((user: any) => (
                           <Pressable key={user.id} onPress={() => router.push(`/profile/${user.id}?from=community`)} style={{ marginBottom: 6 }}>
                             <Text style={{ fontFamily: 'SpaceMono', color: '#00ff00', fontSize: 12, letterSpacing: 1 }}>
                               {`${user.username.padEnd(20, '.')}`} {(user.created_at || '').substring(0,4)}
                             </Text>
                           </Pressable>
                        ))}
                     </View>
                  )}

                  {/* Terminal Prompt */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24 }}>
                     <Text style={{ fontFamily: 'SpaceMono', color: '#00ff00', fontSize: 12 }}>{'C:\\TRACKING>'}</Text>
                     <View style={{ width: 8, height: 14, backgroundColor: '#00ff00', marginLeft: 6, opacity: 0.8 }} />
                  </View>
               </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ══════════════════════════ BOARD TAB ══════════════════════════ */}
      {activeTab === 'board' && (
        <ScrollView
          ref={boardScrollRef}
          key="tab-board"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 160 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#f59e0b"
              colors={['#f59e0b']}
              progressBackgroundColor="#111"
            />
          }
        >
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
                
                {/* WYSIWYG Editor Toolbar */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
                  <Pressable 
                    onPress={() => handleInsertStyle('**')} 
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.05)', minWidth: 26, alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, fontWeight: 'bold', color: '#2d2016' }}>B</Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => handleInsertStyle('*')} 
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.05)', minWidth: 26, alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, fontStyle: 'italic', color: '#2d2016' }}>I</Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => setImageModalVisible(true)} 
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.05)', minWidth: 26, alignItems: 'center' }}
                  >
                    <Ionicons name="image-outline" size={12} color="#8a7060" />
                  </Pressable>
                </View>

                <View style={{ position: 'relative', zIndex: 50 }}>
                  <TextInput 
                    style={{ fontFamily: 'SpaceMono', fontSize: 13, color: '#2d2016', minHeight: 60, textAlignVertical: 'top' }} 
                    placeholder="Share a recommendation..." 
                    placeholderTextColor="#a89880" 
                    multiline 
                    value={postContent} 
                    onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                    onChangeText={(text) => {
                      setPostContent(text);
                      const words = text.split(/ |\n/);
                      const lastWord = words[words.length - 1];
                      if (lastWord.startsWith('@')) {
                        setMentionQuery(lastWord.substring(1));
                        setShowMentionsDropdown(true);
                      } else {
                        setShowMentionsDropdown(false);
                      }
                    }} 
                  />
                  {showMentionsDropdown && searchResults && searchResults.length > 0 && (
                    <View style={{ position: 'absolute', top: 60, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 150, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 }}>
                      <ScrollView keyboardShouldPersistTaps="handled">
                        {searchResults.map((user: any) => (
                          <Pressable key={user.id} onPress={() => {
                            const words = postContent.split(/ |\n/);
                            words.pop();
                            setPostContent(words.join(' ') + (words.length > 0 ? ' ' : '') + '@' + user.username + ' ');
                            setShowMentionsDropdown(false);
                          }} style={{ flexDirection: 'row', alignItems: 'center', padding: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
                            <Image source={{ uri: user.avatar_url || 'https://via.placeholder.com/20' }} style={{ width: 20, height: 20, borderRadius: 10, marginRight: 8, backgroundColor: '#eee' }} />
                            <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, color: '#2d2016', fontWeight: 'bold' }}>{user.username}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                
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
                        {mediaQuery.length > 0 && (
                          <Pressable onPress={() => setMediaQuery('')} style={{ padding: 2 }}>
                            <Ionicons name="close-circle" size={12} color="#a89880" />
                          </Pressable>
                        )}
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

                {/* Stack Attachment */}
                <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 8, zIndex: -1 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'SpaceMono', color: '#8a7060', marginBottom: 6 }}>ATTACH STACK:</Text>
                  {selectedStack ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)', padding: 6, borderRadius: 4, justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Ionicons name="layers-outline" size={12} color="#2d2016" style={{ marginRight: 6 }} />
                        <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, color: '#2d2016', fontWeight: 'bold' }} numberOfLines={1}>{selectedStack}</Text>
                      </View>
                      <Pressable onPress={() => setSelectedStack(null)}>
                        <Ionicons name="close-circle" size={14} color="#e53e3e" />
                      </Pressable>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                      {userStacks.map(stack => (
                        <Pressable key={stack} onPress={() => setSelectedStack(stack)} style={{ backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, marginRight: 8 }}>
                          <Text style={{ fontFamily: 'SpaceMono', fontSize: 9, color: '#2d2016', fontWeight: 'bold' }}>{stack}</Text>
                        </Pressable>
                      ))}
                      {userStacks.length === 0 && <Text style={{ fontFamily: 'SpaceMono', fontSize: 9, color: '#a89880' }}>No stacks available</Text>}
                    </ScrollView>
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
                    <BulletinPostItem 
                      key={post.id} 
                      post={post} 
                      userId={userId} 
                      idx={idx} 
                      startEditing={startEditing} 
                      setShowDeleteConfirm={setShowDeleteConfirm} 
                      isFocused={focusedPostId === post.id}
                      onReplyPress={() => {
                        setFocusedPostId(null);
                        setTimeout(() => setFocusedPostId(post.id), 50);
                      }}
                      CommentSectionComponent={PostCommentSection} 
                    />
                  ))
              )}
            </View>
          </ImageBackground>
        </ScrollView>
      )}

      {/* ══════════════════════════ INBOX TAB ══════════════════════════ */}
      {activeTab === 'inbox' && (
        <ScrollView
          key="tab-inbox"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 160 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#f59e0b"
              colors={['#f59e0b']}
              progressBackgroundColor="#111"
            />
          }
        >
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#111', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#2a2a2a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>Direct Messages</Text>
            <Pressable onPress={() => { /* Wait, to create message we just switch to directory to click member */ setActiveTab('directory'); }} style={{ backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#f59e0b44' }}>
              <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold' }}>+ NEW MSG</Text>
            </Pressable>
          </View>
          {inboxLoading ? <ActivityIndicator color="#f59e0b" style={{ marginTop: 40 }} /> : !conversations?.length ? (
            <View style={{ marginTop: 80, alignItems: 'center', paddingHorizontal: 40, opacity: 0.3 }}>
              <Ionicons name="chatbubbles-outline" size={56} color="#333" />
              <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 11, textAlign: 'center', marginTop: 16 }}>No messages yet.</Text>
            </View>
          ) : (
            (conversations || []).map((conv: any) => (
              <Pressable key={conv.partner?.id} onPress={() => router.push(`/profile/chat/${conv.partner?.id}`)} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#0a0a0a' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#111', overflow: 'hidden', marginRight: 12 }}>
                  {conv.partner?.avatar_url ? <Image source={{ uri: conv.partner.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={20} color="#333" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 13, fontWeight: 'bold' }}>@{conv.partner?.username || 'anon'}</Text>
                  <Text style={{ color: '#444', fontFamily: 'SpaceMono', fontSize: 11 }} numberOfLines={1}>{conv.lastMessage?.content}</Text>
                </View>
                <Pressable onPress={() => deleteConversation.mutate(conv.partner?.id)} style={{ padding: 8, backgroundColor: '#1a1a1a', borderRadius: 20 }}>
                  <Ionicons name="trash" size={14} color="#555" />
                </Pressable>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* ══════════════════════════ ALERTS TAB ══════════════════════════ */}
      {activeTab === 'alerts' && (
        <ScrollView
          key="tab-alerts"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 160 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#f59e0b"
              colors={['#f59e0b']}
              progressBackgroundColor="#111"
            />
          }
        >
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#111', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#2a2a2a', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>Alerts</Text>
            {notifications && notifications.some((n: any) => n.is_read) && (
               <Pressable onPress={() => clearReadNotifications.mutate()} style={{ backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#e53e3e44' }}>
                 <Text style={{ color: '#e53e3e', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold' }}>CLEAR READ</Text>
               </Pressable>
            )}
          </View>
          {notifLoading ? <ActivityIndicator color="#f59e0b" style={{ marginTop: 40 }} /> : !notifications?.length ? (
            <View style={{ marginTop: 80, alignItems: 'center', paddingHorizontal: 40, opacity: 0.3 }}>
              <Ionicons name="notifications-off-outline" size={56} color="#333" />
              <Text style={{ color: '#fff', fontFamily: 'SpaceMono', fontSize: 11, textAlign: 'center', marginTop: 16 }}>All quiet.</Text>
            </View>
          ) : (
            (notifications || []).map((n: any) => (
              <Pressable key={n.id} onPress={() => handleNotificationPress(n)} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#0a0a0a', backgroundColor: !n.is_read ? '#f59e0b05' : 'transparent' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#111', overflow: 'hidden', marginRight: 12 }}>
                  {n.actor?.avatar_url ? <Image source={{ uri: n.actor.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name={notifIcon(n.type) as any} size={16} color="#f59e0b" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: n.is_read ? '#444' : '#ddd', fontFamily: 'SpaceMono', fontSize: 12 }}>{notifMessage(n)}</Text>
                  {n.referenceData?.content && (
                    <Text style={{ color: '#525252', fontFamily: 'SpaceMono', fontSize: 10, marginTop: 2 }} numberOfLines={1}>
                      "{n.referenceData.content}"
                    </Text>
                  )}
                  <Text style={{ color: '#222', fontFamily: 'SpaceMono', fontSize: 8, marginTop: 2 }}>{new Date(n.created_at).toLocaleDateString()}</Text>
                </View>
                {!n.is_read ? (
                   <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' }} />
                ) : (
                   <Pressable onPress={() => deleteNotification.mutate(n.id)} style={{ padding: 8 }}>
                     <Ionicons name="trash" size={14} color="#222" />
                   </Pressable>
                )}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
      {activeTab === 'swap' && (
        <SwapMeetView 
          key="tab-swap"
          selectedSwapTitleKey={selectedSwapTitleKey}
          setSelectedSwapTitleKey={setSelectedSwapTitleKey}
        />
      )}
      {/* Insert Image Link Modal */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setImageModalVisible(false)}
        >
          <Pressable 
            style={{ width: '85%', maxWidth: 320, backgroundColor: 'rgba(255,249,220,0.98)', borderRadius: 8, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, borderWidth: 1, borderColor: '#8a7060' }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontFamily: 'SpaceMono', fontSize: 12, fontWeight: 'bold', color: '#2d2016', marginBottom: 8, textAlign: 'center' }}>INSERT IMAGE LINK</Text>
            <TextInput
              style={{ backgroundColor: '#fff', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 8, fontFamily: 'SpaceMono', fontSize: 11, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', color: '#000', marginBottom: 12 }}
              placeholder="https://example.com/image.jpg"
              placeholderTextColor="#888"
              value={imageUrlInput}
              onChangeText={setImageUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Pressable 
                onPress={() => setImageModalVisible(false)} 
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.05)' }}
              >
                <Text style={{ fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', color: '#666' }}>CANCEL</Text>
              </Pressable>
              <Pressable 
                onPress={() => {
                  if (imageUrlInput.trim()) {
                    const start = selection.start;
                    const before = postContent.substring(0, start);
                    const after = postContent.substring(start);
                    const imgMarkdown = `\n![image](${imageUrlInput.trim()})\n`;
                    setPostContent(`${before}${imgMarkdown}${after}`);
                    setImageUrlInput('');
                    setImageModalVisible(false);
                    playSound('peel');
                  }
                }} 
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, backgroundColor: '#2d2016' }}
              >
                <Text style={{ fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold', color: '#f59e0b' }}>INSERT</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ReorderTopFiveModal
        visible={reorderTopFiveVisible}
        onClose={() => setReorderTopFiveVisible(false)}
        items={top5}
        userId={userId || ''}
      />
    </View>
  );
}
