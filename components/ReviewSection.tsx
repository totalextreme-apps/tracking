import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreatePost } from '@/hooks/useSocial';
import { useAuth } from '@/context/AuthContext';

type ReviewSectionProps = {
  movieId?: number;
  showId?: number;
  collectionItemId?: string;
  initialRating?: number;
  initialReview?: string;
};

export function ReviewSection({ movieId, showId, collectionItemId, initialRating, initialReview }: ReviewSectionProps) {
  const { userId } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState<number | undefined>(initialRating);
  const [content, setContent] = useState(initialReview || '');
  
  const createPost = useCreatePost(userId);

  const handlePost = () => {
    if (!content.trim()) return;

    createPost.mutate({
      content,
      rating,
      movie_id: movieId,
      show_id: showId,
      collection_item_id: collectionItemId
    }, {
      onSuccess: () => {
        setIsEditing(false);
      }
    });
  };

  if (!isEditing && !initialRating && !initialReview) {
    return (
      <Pressable 
        onPress={() => setIsEditing(true)}
        className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex-row items-center justify-between mb-6"
      >
        <View className="flex-row items-center">
            <View className="bg-amber-500/10 p-2 rounded-full mr-3">
                <Ionicons name="star" size={20} color="#f59e0b" />
            </View>
            <View>
                <Text className="text-white font-bold font-mono text-sm">RATE & REVIEW</Text>
                <Text className="text-neutral-500 font-mono text-[10px]">Pin your appraisal to the Bulletin Board</Text>
            </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#404040" />
      </Pressable>
    );
  }

  if (isEditing) {
    return (
      <View className="bg-yellow-100/90 rounded p-4 mb-6 shadow-xl border border-neutral-300">
        <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
                <View className="bg-red-500 w-3 h-3 rounded-full mr-2" />
                <Text className="font-mono text-xs font-bold text-neutral-800 uppercase">PIN TO BOARD</Text>
            </View>
            <Pressable onPress={() => setIsEditing(false)}>
                <Ionicons name="close" size={20} color="#78716c" />
            </Pressable>
        </View>

        <View className="flex-row items-center mb-4">
            {[1, 2, 3, 4, 5].map(star => (
                <Pressable key={star} onPress={() => setRating(star === rating ? undefined : star)} className="mr-2">
                    <Ionicons 
                        name={star <= (rating || 0) ? "star" : "star-outline"} 
                        size={24} 
                        color={star <= (rating || 0) ? '#f59e0b' : '#78716c'} 
                    />
                </Pressable>
            ))}
        </View>

        <TextInput
            className="font-mono text-sm text-neutral-900 bg-white/40 p-3 rounded min-h-[80px]"
            placeholder="Write your review here..."
            placeholderTextColor="#78716c"
            multiline
            value={content}
            onChangeText={setContent}
        />

        <View className="items-end mt-4">
            <Pressable 
                onPress={handlePost}
                disabled={createPost.isPending || !content.trim()}
                className={`px-6 py-2 bg-neutral-900 rounded ${(!content.trim() || createPost.isPending) ? 'opacity-50' : ''}`}
            >
                {createPost.isPending ? (
                    <ActivityIndicator size="small" color="white" />
                ) : (
                    <Text className="text-white font-mono font-bold text-xs">PIN TO BOARD</Text>
                )}
            </Pressable>
        </View>
      </View>
    );
  }

  // Already has review, show "Edit" option
  return (
    <View className="mb-6">
        <View className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
            <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                    <View className="bg-amber-500 px-2 py-0.5 rounded-sm mr-2">
                        <Text className="text-black font-bold font-mono text-[9px] uppercase tracking-tighter">Your Appraisal</Text>
                    </View>
                    {initialRating && (
                        <View className="flex-row">
                            {[1, 2, 3, 4, 5].map(star => (
                                <Ionicons 
                                    key={star} 
                                    name="star" 
                                    size={12} 
                                    color={star <= initialRating ? '#f59e0b' : '#333'} 
                                />
                            ))}
                        </View>
                    )}
                </View>
                <Pressable onPress={() => setIsEditing(true)}>
                    <Text className="text-amber-500 font-mono text-[10px] uppercase">Edit</Text>
                </Pressable>
            </View>
            {initialReview && (
                <Text className="text-neutral-400 font-mono text-xs italic leading-5">
                    "{initialReview}"
                </Text>
            )}
        </View>
    </View>
  );
}
