import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreatePost } from '@/hooks/useSocial';
import { useAuth } from '@/context/AuthContext';
import { useUpdateCollectionItem, useCollection } from '@/hooks/useCollection';
import { useSound } from '@/context/SoundContext';

type ReviewSectionProps = {
  movieId?: number;
  showId?: number;
  collectionItemId?: string;
  initialRating?: number;
  initialReview?: string;
};

export function ReviewSection({ movieId, showId, collectionItemId, initialRating, initialReview }: ReviewSectionProps) {
  const { userId } = useAuth();
  const { playSound } = useSound();
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState<number | undefined>(initialRating);
  const [content, setContent] = useState(initialReview || '');
  const inputRef = useRef<TextInput>(null);
  
  const createPost = useCreatePost(userId);
  const { data: collection } = useCollection(userId);
  const updateMutation = useUpdateCollectionItem(userId);

  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  useEffect(() => {
    if (initialReview) {
      setContent(initialReview);
    }
  }, [initialReview]);

  const handleStarPress = async (star: number) => {
    playSound('click');
    const newRating = star === rating && isEditing ? undefined : star;
    setRating(newRating);
    setIsEditing(true);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    // Find all formats of this movie/show in the user's collection to sync the rating
    const itemsToUpdate = collection?.filter((i: any) => {
      if (movieId) return i.movie_id === movieId;
      if (showId) return i.show_id === showId;
      return false;
    }) || [];

    try {
      if (itemsToUpdate.length > 0) {
        await Promise.all(itemsToUpdate.map((i: any) =>
          updateMutation.mutateAsync({ itemId: i.id, updates: { rating: newRating ?? null } })
        ));
      } else if (collectionItemId) {
        await updateMutation.mutateAsync({ itemId: collectionItemId, updates: { rating: newRating ?? null } });
      }
    } catch (e) {
      console.error('Failed to save rating in ReviewSection', e);
    }
  };

  const handlePost = () => {
    if (!content.trim()) return;

    playSound('peel');
    const currentItem = collection?.find((i: any) => i.id === collectionItemId);
    const tmdbMovieId = currentItem?.movies?.tmdb_id || movieId;
    const tmdbShowId = currentItem?.shows?.tmdb_id || showId;

    createPost.mutate({
      content,
      rating,
      movie_id: tmdbMovieId,
      show_id: tmdbShowId,
      collection_item_id: collectionItemId
    }, {
      onSuccess: () => {
        setIsEditing(false);
      }
    });
  };

  // State A: No rating & no review yet and not currently editing
  if (!isEditing && !initialRating && !initialReview) {
    return (
      <View className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex-row items-center justify-between mx-4 md:mx-8 mt-4 mb-4 shadow-md shadow-black">
        <Pressable onPress={() => setIsEditing(true)} className="flex-row items-center flex-1 mr-2">
            <View className="bg-amber-500/10 p-2.5 rounded-full mr-3 border border-amber-500/20">
                <Ionicons name="star" size={20} color="#f59e0b" />
            </View>
            <View className="flex-1">
                <Text className="text-white font-bold font-mono text-xs uppercase tracking-wider">RATE & REVIEW</Text>
                <Text className="text-neutral-500 font-mono text-[10px] mt-0.5">Pin your appraisal to the Bulletin Board</Text>
            </View>
        </Pressable>
        <View className="flex-row items-center gap-1 bg-neutral-950 px-2 py-1.5 rounded-lg border border-neutral-800">
          {[1, 2, 3, 4, 5].map(star => (
            <Pressable key={star} onPress={() => handleStarPress(star)} className="p-0.5">
              <Ionicons name="star-outline" size={20} color="#525252" />
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  // State B: Not editing (has rating and/or review)
  if (!isEditing) {
    return (
      <View className="mx-4 md:mx-8 mt-4 mb-4">
        <View className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/10 shadow-md">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <View className="bg-amber-500 px-2 py-0.5 rounded-sm mr-2">
                <Text className="text-black font-bold font-mono text-[9px] uppercase tracking-tighter">Your Appraisal</Text>
              </View>
              <View className="flex-row items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                  <Pressable key={star} onPress={() => handleStarPress(star)} className="p-0.5">
                    <Ionicons 
                      name="star" 
                      size={14} 
                      color={star <= (initialRating || rating || 0) ? '#f59e0b' : '#333'} 
                    />
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable onPress={() => setIsEditing(true)} className="flex-row items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/30">
              <Ionicons name="pencil" size={10} color="#f59e0b" />
              <Text className="text-amber-500 font-mono text-[10px] font-bold uppercase">{initialReview ? 'Edit Post' : 'Add Review'}</Text>
            </Pressable>
          </View>
          {initialReview ? (
            <Text className="text-neutral-300 font-mono text-xs italic leading-5 mt-1">
              "{initialReview}"
            </Text>
          ) : (
            <Pressable onPress={() => setIsEditing(true)} className="mt-1">
              <Text className="text-neutral-500 font-mono text-[11px] italic">
                + Write a bulletin post review...
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // State C: Editing / Writing Bulletin Post (Yellow Post-It Card)
  return (
    <View className="bg-yellow-100/95 rounded-xl p-4 mx-4 md:mx-8 mt-4 mb-4 shadow-xl border border-yellow-300/60">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View className="bg-red-500 w-3 h-3 rounded-full mr-2 shadow-sm" />
          <Text className="font-mono text-xs font-bold text-neutral-900 uppercase tracking-wider">PIN TO BOARD</Text>
        </View>
        <Pressable onPress={() => setIsEditing(false)} className="p-1">
          <Ionicons name="close" size={20} color="#78716c" />
        </Pressable>
      </View>

      {/* Star Selector inside Review Editor */}
      <View className="flex-row items-center mb-3 bg-black/5 p-2 rounded-lg border border-black/5">
        <Text className="font-mono text-[10px] text-neutral-600 font-bold uppercase mr-3">RATING:</Text>
        <View className="flex-row items-center gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <Pressable key={star} onPress={() => handleStarPress(star)} className="p-1">
              <Ionicons 
                name={star <= (rating || 0) ? "star" : "star-outline"} 
                size={24} 
                color={star <= (rating || 0) ? '#f59e0b' : '#a8a29e'} 
              />
            </Pressable>
          ))}
        </View>
      </View>

      <TextInput
        ref={inputRef}
        className="font-mono text-sm text-neutral-900 bg-white/70 p-3 rounded-lg min-h-[90px] border border-stone-300/60"
        placeholder="Write your review or recommendation for the bulletin board..."
        placeholderTextColor="#a8a29e"
        multiline
        value={content}
        onChangeText={setContent}
      />

      <View className="flex-row items-center justify-end mt-3 gap-2">
        <Pressable 
          onPress={() => setIsEditing(false)}
          className="px-4 py-2 border border-stone-400/60 rounded-lg bg-stone-200/50"
        >
          <Text className="font-mono font-bold text-xs text-neutral-700">CANCEL</Text>
        </Pressable>
        <Pressable 
          onPress={handlePost}
          disabled={createPost.isPending || !content.trim()}
          className={`px-5 py-2 bg-neutral-900 rounded-lg flex-row items-center gap-1.5 ${(!content.trim() || createPost.isPending) ? 'opacity-50' : ''}`}
        >
          {createPost.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="pin" size={12} color="#f59e0b" />
              <Text className="text-white font-mono font-bold text-xs">PIN TO BOARD</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
