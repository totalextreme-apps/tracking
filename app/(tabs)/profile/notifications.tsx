import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useNotifications, useMarkNotificationRead } from '@/hooks/useSocial';
import { StatusBar } from 'expo-status-bar';

export default function NotificationsScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const { data: notifications, isLoading } = useNotifications(userId ?? undefined);
  const markReadMutation = useMarkNotificationRead();

  const handlePress = (notif: any) => {
    markReadMutation.mutate(notif.id);
    
    // Navigate based on type
    if (notif.type === 'message') {
      router.push(`/(tabs)/profile/chat/${notif.actor_id}`);
    } else if (notif.type === 'item_comment') {
      // Find the reference ID in collection_items? Or just show a message.
      // For now, let's just mark read. In a real app we'd deep link.
    } else if (notif.type === 'post_comment') {
       router.push(`/(tabs)/profile/feed`);
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'message': return 'mail-outline';
      case 'item_comment': return 'chatbubble-outline';
      case 'post_comment': return 'paper-plane-outline';
      case 'follow': return 'person-add-outline';
      default: return 'notifications-outline';
    }
  };

  const getMessage = (notif: any) => {
    const actor = notif.actor?.username || 'Someone';
    switch(notif.type) {
      case 'message': return `@${actor} sent you a message`;
      case 'item_comment': return `@${actor} commented on your item`;
      case 'post_comment': return `@${actor} replied to your post`;
      case 'follow': return `@${actor} started tracking you`;
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
