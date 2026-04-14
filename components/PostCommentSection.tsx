import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { usePostComments, useCreatePostComment } from '@/hooks/useSocial';
import * as Haptics from 'expo-haptics';

type PostCommentSectionProps = {
    postId: string;
};

export function PostCommentSection({ postId }: PostCommentSectionProps) {
    const { userId } = useAuth();
    const { data: comments, isLoading } = usePostComments(postId);
    const createMutation = useCreatePostComment(userId);

    const [commentText, setCommentText] = useState('');

    const handleAdd = () => {
        if (!commentText.trim()) return;
        createMutation.mutate({ postId, content: commentText.trim() }, {
            onSuccess: () => {
                setCommentText('');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        });
    };

    return (
        <View className="mt-4 border-t border-neutral-800 pt-4">
            {/* List */}
            {isLoading ? (
                <ActivityIndicator color="#f59e0b" size="small" />
            ) : (
                comments?.map((comment: any) => (
                    <View key={comment.id} className="mb-3 flex-row gap-2">
                        <View className="w-6 h-6 rounded-full bg-neutral-800 overflow-hidden">
                             {comment.profiles?.avatar_url ? (
                                <Image source={{ uri: comment.profiles.avatar_url }} className="w-full h-full" />
                             ) : (
                                <View className="w-full h-full items-center justify-center">
                                    <Ionicons name="person" size={12} color="#525252" />
                                </View>
                             )}
                        </View>
                        <View className="flex-1 bg-black/30 p-2 rounded-lg border border-neutral-800/50">
                            <Text className="text-neutral-500 font-bold font-mono text-[9px] mb-1">@{comment.profiles?.username || 'unknown'}</Text>
                            <Text className="text-neutral-300 font-mono text-[11px] leading-4">{comment.content}</Text>
                        </View>
                    </View>
                ))
            )}

            {/* Input */}
            <View className="flex-row gap-2 mt-3 items-center">
                <TextInput
                    className="flex-1 bg-black text-white px-3 py-2 rounded-lg border border-neutral-800 font-mono text-xs"
                    placeholder="Reply..."
                    placeholderTextColor="#525252"
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                />
                <Pressable 
                    onPress={handleAdd}
                    disabled={createMutation.isPending || !commentText.trim()}
                    className={`w-8 h-8 rounded-lg items-center justify-center ${commentText.trim() ? 'bg-amber-500' : 'bg-neutral-800'}`}
                >
                    <Ionicons name="send" size={14} color={commentText.trim() ? 'black' : '#525252'} />
                </Pressable>
            </View>
        </View>
    );
}
