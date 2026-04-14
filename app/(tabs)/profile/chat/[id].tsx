import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useChat, useSendMessage, useProfile } from '@/hooks/useSocial';
import { StatusBar } from 'expo-status-bar';

export default function ChatScreen() {
  const { id } = useLocalSearchParams(); // Partner's user ID
  const { userId } = useAuth();
  const partnerId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  
  const [content, setContent] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  
  const { data: partnerProfile } = useProfile(partnerId);
  const { data: messages, isLoading } = useChat(userId ?? undefined, partnerId);
  const sendMessageMutation = useSendMessage(userId ?? undefined);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messages?.length) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = () => {
    if (!content.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate({ receiverId: partnerId, content: content.trim() });
    setContent('');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
      className="flex-1 bg-black"
    >
      <StatusBar style="light" />
      <Stack.Screen options={{ 
        headerTitle: partnerProfile?.username?.toUpperCase() || 'CHAT',
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#f59e0b',
        headerTitleStyle: { fontFamily: 'SpaceMono', fontWeight: 'bold' },
        headerRight: () => (
          <Pressable onPress={() => router.push(`/profile/${partnerId}`)} className="mr-2">
             <View className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden border border-neutral-700">
                {partnerProfile?.avatar_url ? (
                  <Image source={{ uri: partnerProfile.avatar_url }} className="w-full h-full" />
                ) : (
                  <View className="w-full h-full items-center justify-center">
                     <Ionicons name="person" size={14} color="#525252" />
                  </View>
                )}
             </View>
          </Pressable>
        )
      }} />

      <ScrollView 
        ref={scrollViewRef}
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {isLoading ? (
          <ActivityIndicator color="#f59e0b" className="mt-20" />
        ) : messages?.length === 0 ? (
          <View className="mt-20 items-center opacity-30">
            <Ionicons name="chatbubble-outline" size={48} color="#525252" />
            <Text className="text-white font-mono text-center mt-4 uppercase text-xs tracking-widest">
              Secure Channel Established.{'\n'}Send a message to start tracking.
            </Text>
          </View>
        ) : (
          messages?.map((msg: any) => {
            const isMe = msg.sender_id === userId;
            return (
              <View 
                key={msg.id} 
                className={`mb-4 max-w-[80%] ${isMe ? 'self-end' : 'self-start'}`}
              >
                {!isMe && (
                   <Text className="text-neutral-600 font-mono text-[8px] mb-1 ml-1 uppercase">
                     {partnerProfile?.username}
                   </Text>
                )}
                <View 
                  className={`p-3 rounded-2xl ${
                    isMe 
                      ? 'bg-amber-600 rounded-tr-none' 
                      : 'bg-neutral-900 rounded-tl-none border border-neutral-800'
                  }`}
                >
                  <Text className={`font-mono text-sm ${isMe ? 'text-white' : 'text-neutral-200'}`}>
                    {msg.content}
                  </Text>
                </View>
                <Text className={`text-neutral-700 font-mono text-[8px] mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Input Area */}
      <View className="p-4 pb-10 bg-black border-t border-neutral-900 flex-row items-center gap-3">
         <TextInput
           className="flex-1 bg-neutral-900 text-white p-3 px-4 rounded-full font-mono text-sm border border-neutral-800"
           placeholder="Type a message..."
           placeholderTextColor="#525252"
           value={content}
           onChangeText={setContent}
           multiline
           maxLength={500}
         />
         <Pressable 
           onPress={handleSend}
           disabled={!content.trim() || sendMessageMutation.isPending}
           className={`w-10 h-10 rounded-full items-center justify-center ${content.trim() ? 'bg-amber-500' : 'bg-neutral-800'}`}
         >
           <Ionicons name="send" size={18} color={content.trim() ? 'black' : '#525252'} />
         </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
