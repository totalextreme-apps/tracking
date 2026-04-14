import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useItemComments, useCreateComment, useUpdateComment, useDeleteComment } from '@/hooks/useSocial';
import * as Haptics from 'expo-haptics';

type CommentSectionProps = {
    collectionItemId: string;
};

export function CommentSection({ collectionItemId }: CommentSectionProps) {
    const { userId } = useAuth();
    const { data: comments, isLoading } = useItemComments(collectionItemId);
    const createMutation = useCreateComment(userId);
    const updateMutation = useUpdateComment(userId);
    const deleteMutation = useDeleteComment(userId);

    const [commentText, setCommentText] = useState('');
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    const handleAdd = () => {
        if (!commentText.trim()) return;
        createMutation.mutate({ collectionItemId, content: commentText.trim() }, {
            onSuccess: () => {
                setCommentText('');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        });
    };

    const handleUpdate = (id: string) => {
        if (!editText.trim()) return;
        updateMutation.mutate({ commentId: id, content: editText.trim() }, {
            onSuccess: () => {
                setEditingCommentId(null);
                setEditText('');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        });
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            "Delete Comment",
            "Are you sure you want to remove this comment?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: () => deleteMutation.mutate(id) 
                }
            ]
        );
    };

    return (
        <View className="mt-8 border-t border-neutral-900 pt-6">
            <Text className="text-amber-500 font-bold text-xl mb-4 font-mono uppercase tracking-widest">COMMENTS</Text>

            {/* Input */}
            <View className="flex-row gap-2 mb-6">
                <TextInput
                    className="flex-1 bg-neutral-900 text-white p-3 rounded-lg border border-neutral-800 font-mono text-sm"
                    placeholder="Add a comment..."
                    placeholderTextColor="#525252"
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                />
                <Pressable 
                    onPress={handleAdd}
                    disabled={createMutation.isPending || !commentText.trim()}
                    className={`w-12 h-12 rounded-lg items-center justify-center ${commentText.trim() ? 'bg-amber-500' : 'bg-neutral-800'}`}
                >
                    {createMutation.isPending ? (
                        <ActivityIndicator color="black" size="small" />
                    ) : (
                        <Ionicons name="send" size={20} color={commentText.trim() ? 'black' : '#525252'} />
                    )}
                </Pressable>
            </View>

            {/* List */}
            {isLoading ? (
                <ActivityIndicator color="#f59e0b" />
            ) : comments?.length === 0 ? (
                <Text className="text-neutral-600 font-mono text-xs italic text-center py-4">No comments yet. Be the first!</Text>
            ) : (
                comments?.map((comment: any) => (
                    <View key={comment.id} className="mb-6 flex-row gap-3">
                        <View className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden border border-neutral-700">
                             {comment.profiles?.avatar_url ? (
                                <Image source={{ uri: comment.profiles.avatar_url }} className="w-full h-full" />
                             ) : (
                                <View className="w-full h-full items-center justify-center">
                                    <Ionicons name="person" size={16} color="#525252" />
                                </View>
                             )}
                        </View>
                        <View className="flex-1">
                            <View className="flex-row justify-between items-center mb-1">
                                <Text className="text-white font-bold font-mono text-xs">@{comment.profiles?.username || 'unknown'}</Text>
                                <Text className="text-neutral-600 font-mono text-[9px]">
                                    {new Date(comment.created_at).toLocaleDateString()}
                                </Text>
                            </View>
                            
                            {editingCommentId === comment.id ? (
                                <View className="bg-neutral-900 p-2 rounded border border-neutral-700">
                                    <TextInput
                                        className="text-white font-mono text-sm mb-2"
                                        value={editText}
                                        onChangeText={setEditText}
                                        multiline
                                        autoFocus
                                    />
                                    <View className="flex-row justify-end gap-2">
                                        <Pressable onPress={() => setEditingCommentId(null)}>
                                            <Text className="text-neutral-500 font-mono text-[10px] p-2">CANCEL</Text>
                                        </Pressable>
                                        <Pressable onPress={() => handleUpdate(comment.id)}>
                                            <Text className="text-amber-500 font-bold font-mono text-[10px] p-2">SAVE</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ) : (
                                <View className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-800">
                                    <Text className="text-neutral-300 font-mono text-sm">{comment.content}</Text>
                                </View>
                            )}

                            {comment.user_id === userId && !editingCommentId && (
                                <View className="flex-row gap-4 mt-1 ml-1">
                                    <Pressable 
                                        onPress={() => {
                                            setEditingCommentId(comment.id);
                                            setEditText(comment.content);
                                        }}
                                    >
                                        <Text className="text-neutral-600 font-mono text-[10px]">EDIT</Text>
                                    </Pressable>
                                    <Pressable onPress={() => handleDelete(comment.id)}>
                                        <Text className="text-red-900 font-mono text-[10px]">DELETE</Text>
                                    </Pressable>
                                </View>
                            )}
                        </View>
                    </View>
                ))
            )}
        </View>
    );
}
