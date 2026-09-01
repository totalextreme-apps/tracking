import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSound } from '@/context/SoundContext';

export type ReactionTargetType = 'post_id' | 'collection_item_id' | 'post_comment_id' | 'item_comment_id';

export interface Reaction {
  id: string;
  user_id: string;
  post_id: string | null;
  collection_item_id: string | null;
  post_comment_id: string | null;
  item_comment_id: string | null;
  reaction_type: string;
  created_at: string;
  profiles: {
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export function useReactions(targetType: ReactionTargetType, targetId: string) {
  const queryClient = useQueryClient();
  const { playSound } = useSound();

  // Query: Fetch reactions for target
  const { data: reactions = [], refetch } = useQuery<Reaction[]>({
    queryKey: ['reactions', targetType, targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reactions')
        .select('*, profiles(username, avatar_url)')
        .eq(targetType, targetId);
      if (error) {
        // If table doesn't exist yet, return empty array to prevent crashing
        if (error.code === 'PGRST116' || error.message.includes('relation "public.reactions" does not exist')) {
          console.warn('Reactions table not found. Please run supabase/add-reactions-system.sql in the Supabase SQL editor.');
          return [];
        }
        throw error;
      }
      return data || [];
    },
    enabled: !!targetId,
    staleTime: 1000 * 60 * 5,
  });

  // Mutation: Toggle or update reaction
  const toggleReaction = useMutation({
    mutationFn: async ({ userId, emoji }: { userId: string; emoji: string }) => {
      const existing = reactions.find(r => r.user_id === userId);

      if (existing) {
        if (existing.reaction_type === emoji) {
          // If clicked the exact same reaction, DELETE it
          const { error } = await supabase
            .from('reactions')
            .delete()
            .eq('id', existing.id);
          if (error) throw error;
          playSound('click');
        } else {
          // If clicked a different reaction, UPDATE it
          const { error } = await supabase
            .from('reactions')
            .update({ reaction_type: emoji })
            .eq('id', existing.id);
          if (error) throw error;
          playSound('peel');
        }
      } else {
        // If no reaction yet, INSERT it
        const { error } = await supabase
          .from('reactions')
          .insert({
            user_id: userId,
            [targetType]: targetId,
            reaction_type: emoji,
          });
        if (error) throw error;
        playSound('peel');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reactions', targetType, targetId] });
    },
  });

  return {
    reactions,
    toggleReaction: toggleReaction.mutate,
    isToggling: toggleReaction.isPending,
    refetch,
  };
}
