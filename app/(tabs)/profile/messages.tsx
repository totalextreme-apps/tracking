import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useConversations } from '@/hooks/useSocial';
import { StatusBar } from 'expo-status-bar';

export default function ConversationsScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const { data: conversations, isLoading } = useConversations(userId ?? undefined);

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <Stack.Screen options={{ 
        headerTitle: 'INBOX',
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
           <Text className="text-neutral-500 font-mono text-[10px] uppercase font-bold tracking-widest">Secure Comms Channel</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#f59e0b" className="mt-20" />
        ) : conversations?.length === 0 ? (
          <View className="mt-20 items-center px-10">
            <Ionicons name="chatbubbles-outline" size={64} color="#262626" />
            <Text className="text-neutral-600 font-mono text-center mt-6 uppercase text-xs tracking-tighter leading-4">
              Your inbox is clear.{'\n'}Message a member from their profile to start a thread.
            </Text>
          </View>
        ) : (
          conversations?.map((conv: any) => (
            <Pressable 
              key={conv.partner.id}
              onPress={() => router.push(`/(tabs)/profile/chat/${conv.partner.id}`)}
              className="flex-row items-center p-4 border-b border-neutral-900 active:bg-neutral-900"
            >
              <View className="w-14 h-14 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800 mr-4">
                 {conv.partner.avatar_url ? (
                   <Image source={{ uri: conv.partner.avatar_url }} className="w-full h-full" />
                 ) : (
                   <View className="w-full h-full items-center justify-center">
                      <Ionicons name="person" size={24} color="#525252" />
                   </View>
                 )}
                 {conv.unreadCount > 0 && (
                   <View className="absolute top-0 right-0 w-4 h-4 bg-amber-500 rounded-full border-2 border-black" />
                 )}
              </View>

              <View className="flex-1">
                <View className="flex-row justify-between items-center mb-1">
                   <Text className="text-white font-bold font-mono text-base lowercase">@{conv.partner.username}</Text>
                   <Text className="text-neutral-600 font-mono text-[10px]">
                     {new Date(conv.lastMessage.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                   </Text>
                </View>
                <Text className={`font-mono text-sm ${conv.unreadCount > 0 ? 'text-amber-500 font-bold' : 'text-neutral-500'}`} numberOfLines={1}>
                  {conv.lastMessage.sender_id === userId ? 'You: ' : ''}{conv.lastMessage.content}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={16} color="#262626" className="ml-2" />
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Retro Footer Decoration */}
      <View className="p-4 items-center opacity-20">
         <Text className="text-neutral-700 font-mono text-[8px] uppercase tracking-[10px]">Track Comms Protocol v1.0</Text>
      </View>
    </View>
  );
}
