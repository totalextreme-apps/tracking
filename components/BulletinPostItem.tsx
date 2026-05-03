import React, { useRef } from 'react';
import { View, Text, Pressable, Image, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';

export function BulletinPostItem({ post, userId, idx, startEditing, setShowDeleteConfirm, toggleComments, isExpanded, CommentSectionComponent }: any) {
  const router = useRouter();
  const viewRef = useRef(null);

  const getPosterUrl = (path: string | null) => path ? `https://image.tmdb.org/t/p/w200${path}` : null;

  const handleShare = async () => {
    try {
      // Capture the visual post
      const uri = await captureRef(viewRef, {
        format: 'jpg',
        quality: 0.9,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: 'public.jpeg', mimeType: 'image/jpeg', dialogTitle: 'Share on Tracking App' });
      } else {
        // Fallback for environments without sharing
        const title = post.movies?.title || post.shows?.name || 'this post';
        Share.share({ message: `Check out this note by @${post.profiles?.username} about ${title} on the Tracking App: "${post.content}"` });
      }
    } catch (e) {
      console.error('Share error:', e);
    }
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

  const renderContentWithMentions = (content: string) => {
    if (!content) return null;
    const parts = content.split(/(@\w+)/g);
    return (
      <Text style={{ fontFamily: 'SpaceMono', fontSize: 12, color: '#2d2016' }}>
        {parts.map((part, i) => {
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

  return (
    <View collapsable={false} ref={viewRef} style={{ backgroundColor: 'rgba(255,252,225,1)', borderRadius: 2, padding: 12, marginBottom: 16, transform: [{ rotate: idx % 2 === 0 ? '-1deg' : '1deg' }], shadowColor: '#000', shadowOffset: { width: 2, height: 4 }, shadowOpacity: 0.35, shadowRadius: 5 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Pressable 
          onPress={() => router.push(`/profile/${post.user_id}`)} 
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#ddd', overflow: 'hidden', marginRight: 8 }}>
            {post.profiles?.avatar_url ? <Image source={{ uri: post.profiles.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={12} color="#888" />}
          </View>
          <Text style={{ fontFamily: 'SpaceMono', fontSize: 11, fontWeight: 'bold', color: '#2d2016' }}>@{post.profiles?.username}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row' }}>
          {post.user_id === userId && (
            <>
              <Pressable onPress={() => startEditing(post)} style={{ marginRight: 10 }}><Ionicons name="pencil" size={14} color="#666" /></Pressable>
              <Pressable onPress={() => setShowDeleteConfirm(post.id)} style={{ marginRight: 10 }}><Ionicons name="trash" size={14} color="#e53e3e" /></Pressable>
            </>
          )}
          <Pressable onPress={handleShare}>
             <Ionicons name="share-outline" size={14} color="#666" />
          </Pressable>
        </View>
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
      {renderContentWithMentions(post.content)}
      
      {/* Hide the 'reply' label visually when sharing by just not capturing it? The user will share it with the reply button, which is fine, might drive clicks! */}
      <Pressable onPress={() => toggleComments(post.id)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' }}>
        <Ionicons name="chatbubble-outline" size={12} color="#8a7060" />
        <Text style={{ fontFamily: 'SpaceMono', fontSize: 9, color: '#8a7060', marginLeft: 4 }}>REPLY</Text>
      </Pressable>
      {isExpanded && <CommentSectionComponent postId={post.id} />}
    </View>
  );
}
