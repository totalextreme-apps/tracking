import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Profile, Follow, BulletinPostWithMedia, ItemCommentWithProfile } from '@/types/database';

// 1. Fetch Profile
export const useProfile = (userId?: string) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // not found
        throw error;
      }
      return data as Profile;
    },
    enabled: !!userId,
  });
};

// 2. Fetch Users you track (Following)
export const useFollowing = (userId?: string) => {
  return useQuery({
    queryKey: ['following', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('follows')
        .select('*, profiles!following_id(*)')
        .eq('follower_id', userId);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

// 3. Fetch Users tracking you (Followers)
export const useFollowers = (userId?: string) => {
  return useQuery({
    queryKey: ['followers', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('follows')
        .select('*, profiles!follower_id(*)')
        .eq('following_id', userId);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

// 4. Toggle Follow Mutation
export const useToggleFollow = (currentUserId?: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ targetUserId, isFollowing }: { targetUserId: string; isFollowing: boolean }) => {
      if (!currentUserId) throw new Error('Not logged in');
      
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .match({ follower_id: currentUserId, following_id: targetUserId }) as any;
        if (error) throw error;
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: targetUserId } as any) as any;
        if (error) throw error;
      }
      return !isFollowing;
    },
    onSuccess: (_, { targetUserId }) => {
      queryClient.invalidateQueries({ queryKey: ['following', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['followers', targetUserId] });
    },
  });
};

// 5. Search Users
export const useSearchUsers = (query: string) => {
  return useQuery({
    queryKey: ['users', 'search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .limit(20);

      if (error) throw error;
      return data as Profile[];
    },
    enabled: query.length > 2,
  });
};

// 5b. Suggested Users
export const useSuggestedUsers = (currentUserId?: string) => {
  return useQuery({
    queryKey: ['users', 'suggested', currentUserId],
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('*')
        .limit(5);
        
      if (currentUserId) {
         q = q.neq('id', currentUserId);
      }
      
      const { data, error } = await q;

      if (error) throw error;
      return data as Profile[];
    },
    enabled: true,
  });
};

// 6. Fetch Bulletin Feed (Posts from people you follow + your own)
export const useBulletinFeed = (userId?: string) => {
  return useQuery({
    queryKey: ['bulletin', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Step 1: Get people the user follows
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);
        
      const followingIds = following?.map((f: any) => f.following_id) || [];
      const interestingIds = [...followingIds, userId];

      if (interestingIds.length === 0) return [];

      // Step 2: Fetch posts from these users, joining with profiles and movies/shows
      const { data, error } = await supabase
        .from('bulletin_posts')
        .select(`
          *,
          profiles(*),
          movies(*),
          shows(*),
          collection_items(*)
        `)
        .in('user_id', interestingIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as BulletinPostWithMedia[];
    },
    enabled: !!userId,
  });
};

// 7. Create Post Mutation
export const useCreatePost = (userId?: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (postData: { 
      content: string; 
      collection_item_id?: string;
      movie_id?: number; 
      show_id?: number;
      rating?: number;
    }) => {
      if (!userId) throw new Error('Not logged in');
      
      const { error, data } = await supabase
        .from('bulletin_posts')
        .insert({
          user_id: userId,
          ...postData
        } as any)
        .select()
        .single() as any;
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin', userId] });
    },
  });
};

// 7b. Update Post Mutation
export const useUpdatePost = (userId?: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ postId, content, rating, movie_id, show_id }: { 
      postId: string;
      content: string; 
      rating?: number;
      movie_id?: number;
      show_id?: number;
    }) => {
      if (!userId) throw new Error('Not logged in');
      
      const { error, data } = await (supabase
        .from('bulletin_posts') as any)
        .update({
          content,
          rating,
          movie_id,
          show_id
        })
        .eq('id', postId);
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin', userId] });
    },
  });
};

// 7c. Delete Post Mutation
export const useDeletePost = (userId?: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error('Not logged in');
      
      const { error } = await supabase
        .from('bulletin_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', userId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin', userId] });
    },
  });
};

// 8. Fetch Item Comments
export const useItemComments = (collectionItemId?: string) => {
  return useQuery({
    queryKey: ['item-comments', collectionItemId],
    queryFn: async () => {
      if (!collectionItemId) return [];
      const { data, error } = await supabase
        .from('item_comments')
        .select(`
          *,
          profiles(*)
        `)
        .eq('collection_item_id', collectionItemId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ItemCommentWithProfile[];
    },
    enabled: !!collectionItemId,
  });
};

// 9. Create Item Comment
export const useCreateComment = (userId?: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ collectionItemId, content }: { collectionItemId: string; content: string }) => {
      if (!userId) throw new Error('Not logged in');
      
      const { error, data } = await supabase
        .from('item_comments')
        .insert({
          user_id: userId,
          collection_item_id: collectionItemId,
          content
        } as any)
        .select()
        .single() as any;
        
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { collectionItemId }) => {
      queryClient.invalidateQueries({ queryKey: ['item-comments', collectionItemId] });
    },
  });
};

// 10. Community Social Feed (Combined Activities)
export const useCommunityFeed = (userId?: string) => {
  return useQuery({
    queryKey: ['community_feed', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);
        
      const followingIds = follows?.map((f: any) => f.following_id) || [];
      if (followingIds.length === 0) return [];

      // Fetch bulletin posts from people you follow
      const { data: posts, error: postErr } = await supabase
        .from('bulletin_posts')
        .select(`
          *,
          profiles(*),
          movies(*),
          shows(*)
        `)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(25);

      if (postErr) throw postErr;

      // Fetch collection additions from people you follow
      const { data: updates, error: updateErr } = await supabase
        .from('collection_items')
        .select(`
          *,
          movies (*),
          shows (*),
          profiles:user_id (username, avatar_url)
        `)
        .in('user_id', followingIds)
        .eq('status', 'owned')
        .order('created_at', { ascending: false })
        .limit(25) as any;

      if (updateErr) throw updateErr;

      // Interleave and sort by date
      const activity = [
        ...(posts || []).map((p: any) => ({ ...p, activity_type: 'post' })),
        ...(updates || []).map((u: any) => ({ ...u, activity_type: 'update' }))
      ];
      
      return activity.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!userId,
  });
};

