import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useNotifications, useMarkNotificationRead } from '@/hooks/useSocial';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';

export default function NotificationsScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const { data: notifications, isLoading } = useNotifications(userId ?? undefined);
  const markReadMutation = useMarkNotificationRead();

  const handlePress = async (notif: any) => {
    markReadMutation.mutate(notif.id);
    
    try {
      if (notif.type === 'message') {
        router.push(`/(tabs)/profile/chat/${notif.actor_id}` as any);
      } else if (notif.type === 'follow') {
        router.push(`/profile/${notif.actor_id}?from=community` as any);
      } else if (notif.type === 'post_comment' || notif.type === 'comment_mention') {
        let postId = notif.referenceData?.post_id;
        if (!postId) {
          const { data } = await supabase
            .from('post_comments')
            .select('post_id')
            .eq('id', notif.reference_id)
            .single();
          postId = data?.post_id;
        }
        if (postId) {
          router.push({ pathname: '/(tabs)/community', params: { tab: 'board', postId } } as any);
        }
      } else if (notif.type === 'post_mention') {
        router.push({ pathname: '/(tabs)/community', params: { tab: 'board', postId: notif.reference_id } } as any);
      } else if (notif.type === 'item_comment') {
        let item = notif.referenceData;
        if (!item || !item.collection_item_id) {
          const { data } = await supabase
            .from('item_comments')
            .select('*, collection_items(*, movies(*), shows(*))')
            .eq('id', notif.reference_id)
            .single();
          item = data;
        }
        const colItem = item?.collection_items;
        if (colItem) {
          const ownerId = colItem.user_id;
          if (colItem.movies) {
            router.push(`/(tabs)/movie/${colItem.id}?ownerId=${ownerId}` as any);
          } else if (colItem.shows) {
            router.push(`/(tabs)/show/${colItem.id}?ownerId=${ownerId}&season=${colItem.season_number || 1}` as any);
          }
        }
      } else if (notif.type === 'reaction') {
        let rx = notif.referenceData;
        if (!rx) {
          const { data } = await supabase
            .from('reactions')
            .select('*')
            .eq('id', notif.reference_id)
            .single();
          rx = data;
        }
        if (rx) {
          if (rx.post_id) {
            router.push({ pathname: '/(tabs)/community', params: { tab: 'board', postId: rx.post_id } } as any);
          } else if (rx.post_comment_id) {
            const { data } = await supabase
              .from('post_comments')
              .select('post_id')
              .eq('id', rx.post_comment_id)
              .single();
            if (data?.post_id) {
              router.push({ pathname: '/(tabs)/community', params: { tab: 'board', postId: data.post_id } } as any);
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
                router.push(`/(tabs)/movie/${colItem.id}?ownerId=${ownerId}` as any);
              } else if (colItem.shows) {
                router.push(`/(tabs)/show/${colItem.id}?ownerId=${ownerId}&season=${colItem.season_number || 1}` as any);
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
                router.push(`/(tabs)/movie/${colItem.id}?ownerId=${ownerId}` as any);
              } else if (colItem.shows) {
                router.push(`/(tabs)/show/${colItem.id}?ownerId=${ownerId}&season=${colItem.season_number || 1}` as any);
              }
            }
          }
        }
      } else if (notif.type === 'profile_comment') {
        router.push({ pathname: `/profile/${userId}`, params: { from: 'community' } } as any);
      }
    } catch (e) {
      console.error('Failed navigation in notifications:', e);
    }
  };

  const getIcon = (type: string) => {
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

  const getMessage = (n: any) => {
    const actorName = n.actor?.username || 'Someone';
    switch (n.type) {
      case 'message': return `@${actorName} sent you a message`;
      case 'item_comment': return `@${actorName} commented on your item`;
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

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <Stack.Screen options={{ 
        headerTitle: 'ALERTS',
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#f59e0b',
        headerTitleStyle: { fontFamily: 'SpaceMono', fontWeight: 'bold' },
        headerLeft: () => (
          <Pressable onPress={() => router.back()} className="ml-2">
            <Ionicons name="arrow-back" size={24} color="#f59e0b" />
          </Pressable>
        )
      }} />

      <ScrollView className="flex-1">
        <View className="p-4 border-b border-neutral-900 bg-neutral-900/10">
           <Text className="text-neutral-500 font-mono text-[10px] uppercase font-bold tracking-widest">Signal Intelligence</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#f59e0b" className="mt-20" />
        ) : notifications?.length === 0 ? (
          <View className="mt-20 items-center px-10 opacity-30">
            <Ionicons name="notifications-off-outline" size={64} color="#525252" />
            <Text className="text-white font-mono text-center mt-6">All quiet on the frequency.</Text>
          </View>
        ) : (
          notifications?.map((notif: any) => (
            <Pressable 
              key={notif.id}
              onPress={() => handlePress(notif)}
              className={`flex-row items-center p-4 border-b border-neutral-900 active:bg-neutral-900 ${!notif.is_read ? 'bg-amber-500/5' : ''}`}
            >
              <View className="w-10 h-10 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800 mr-4 items-center justify-center">
                 {notif.actor?.avatar_url ? (
                   <Image source={{ uri: notif.actor.avatar_url }} className="w-full h-full" />
                 ) : (
                   <Ionicons name={getIcon(notif.type) as any} size={20} color="#f59e0b" />
                 )}
              </View>

              <View className="flex-1">
                <Text className={`font-mono text-xs ${!notif.is_read ? 'text-white font-bold' : 'text-neutral-400'}`}>
                  {getMessage(notif)}
                </Text>
                {notif.referenceData?.content && (
                  <Text className="text-neutral-500 font-mono text-[10px] mt-1" numberOfLines={1}>
                    "{notif.referenceData.content}"
                  </Text>
                )}
                <Text className="text-neutral-600 font-mono text-[8px] mt-1 uppercase">
                  {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(notif.created_at).toLocaleDateString()}
                </Text>
              </View>

              {!notif.is_read && (
                <View className="w-2 h-2 bg-amber-500 rounded-full ml-2" />
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
