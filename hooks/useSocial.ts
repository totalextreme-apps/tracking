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
        .select(`
          *, 
          profiles!following_id(*)
        `)
        .eq('follower_id', userId);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const profileIds = data.map((d: any) => d.following_id);
      
      const { data: displayItems } = await supabase
        .from('collection_items')
        .select('*, movies(poster_path), shows(poster_path)')
        .in('user_id', profileIds)
        .eq('is_on_display', true);
      
      // Post-process to ensure only the 3 most recent on-display items are sent for each profile.
      // Also to prevent breaking if the `is_top_five` migration hasn't been run yet, sort locally.
      let result = data.map((f: any) => {
          if (f.profiles) {
             const items = (displayItems || []).filter((i: any) => i.user_id === f.following_id);
             f.profiles.on_display = items
                 .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                 .slice(0, 5);
          }
          return f;
      });

      result.sort((a: any, b: any) => {
          const aTop = a.is_top_five ? 1 : 0;
          const bTop = b.is_top_five ? 1 : 0;
          return bTop - aTop;
      });

      return result;
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
      queryClient.invalidateQueries({ queryKey: ['users', 'suggested'] });
    },
  });
};

// 4b. Toggle Top 5 Pin Mutation
export const useToggleTopFive = (currentUserId?: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ targetUserId, setToTopFive }: { targetUserId: string; setToTopFive: boolean }) => {
      if (!currentUserId) throw new Error('Not logged in');
      
      if (setToTopFive) {
          // Verify we aren't exceeding 5
          const { count } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', currentUserId)
            .eq('is_top_five', true);
            
          if (count && count >= 5) {
              throw new Error("You already have 5 pinned members.");
          }
      }
      
      const { error } = await (supabase
        .from('follows') as any)
        .update({ is_top_five: setToTopFive })
        .match({ follower_id: currentUserId, following_id: targetUserId });
        
      if (error) throw error;
      return setToTopFive;
    },
    onSuccess: (_, { targetUserId }) => {
      queryClient.invalidateQueries({ queryKey: ['following', currentUserId] });
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
      return data as any[];
    },
    enabled: query.length > 2,
  });
};

// 5b. Suggested Users
export const useSuggestedUsers = (currentUserId?: string) => {
  return useQuery({
    queryKey: ['users', 'suggested', currentUserId],
    queryFn: async () => {
      // 1. Get current follows
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId || '00000000-0000-0000-0000-000000000000');
        
      const followingIds = (following as any[])?.map(f => f.following_id) || [];
      
      // 2. Fetch people not followed
      let query = supabase
        .from('profiles')
        .select('*');
        
      if (currentUserId) {
        query = query.neq('id', currentUserId);
      }
      
      if (followingIds.length > 0) {
        query = query.not('id', 'in', `(${followingIds.join(',')})`);
      }
      
      const { data, error } = await query.limit(10);

      if (error) throw error;
      return data as Profile[];
    },
    enabled: true,
  });
};

// 5c. All Users (Directory)
export const useAllUsers = (currentUserId?: string) => {
  return useQuery({
    queryKey: ['users', 'directory'],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .not('username', 'is', null)
        .order('username', { ascending: true })
        .limit(100);
        
      const { data, error } = await query;
      if (error) throw error;
      
      // Also fetch on_display items for these users so MemberCards can render them
      const profileIds = data.map((d: any) => d.id);
      const { data: displayItems } = await supabase
        .from('collection_items')
        .select('*, movies(poster_path), shows(poster_path)')
        .in('user_id', profileIds)
        .eq('is_on_display', true);
        
      // Embed on_display items into the profiles
      let result = data.map((profile: any) => {
          const items = (displayItems || []).filter((i: any) => i.user_id === profile.id);
          profile.on_display = items
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 5);
          return profile;
      });

      return result as Profile[];
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

// 7. Marketplace Feed (Items for sale/trade from community)
export function useMarketplaceFeed() {
  return useQuery({
    queryKey: ['marketplace_feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_items')
        .select(`*, profiles:user_id(username, avatar_url), movies(*), shows(*)`)
        .or(`for_sale.eq.true,for_trade.eq.true`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });
}

// 7b. Create Post Mutation
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
      queryClient.invalidateQueries({ queryKey: ['bulletin_feed'] });
      queryClient.invalidateQueries({ queryKey: ['collection'] });
    },
  });
};

// 7b. Update Post Mutation
export const useUpdatePost = (userId?: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ postId, ...updates }: { 
      postId: string;
      content?: string; 
      rating?: number;
      movie_id?: number;
      show_id?: number;
    }) => {
      if (!userId) throw new Error('Not logged in');
      
      const { error, data } = await (supabase
        .from('bulletin_posts') as any)
        .update(updates)
        .eq('id', postId)
        .eq('user_id', userId)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin', userId] });
      queryClient.invalidateQueries({ queryKey: ['bulletin_feed'] });
      queryClient.invalidateQueries({ queryKey: ['collection'] });
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
      
      const { error, data } = await (supabase.from('item_comments') as any)
        .insert({
          user_id: userId,
          collection_item_id: collectionItemId,
          content
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { collectionItemId }) => {
      queryClient.invalidateQueries({ queryKey: ['item-comments', collectionItemId] });
    },
  });
};

// Update Comment
export const useUpdateComment = (userId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string, content: string }) => {
      if (!userId) throw new Error('Not logged in');
      const { error } = await (supabase.from('item_comments') as any)
        .update({ content })
        .eq('id', commentId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-comments'] });
    }
  });
};

// Delete Comment
export const useDeleteComment = (userId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!userId) throw new Error('Not logged in');
      const { error } = await (supabase.from('item_comments') as any)
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-comments'] });
    }
  });
};


// --- POST COMMENTS ---

export const usePostComments = (postId?: string) => {
  return useQuery({
    queryKey: ['post-comments', postId],
    queryFn: async () => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          profiles:user_id (id, username, avatar_url)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!postId,
  });
};

export const useCreatePostComment = (userId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!userId) throw new Error('Not logged in');
      const { data, error } = await (supabase.from('post_comments') as any)
        .insert({
          user_id: userId,
          post_id: postId,
          content
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
    }
  });
};

// --- NOTIFICATIONS ---

export const useNotifications = (userId?: string) => {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:actor_id (id, username, avatar_url)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    refetchInterval: 10000, // Poll every 10s
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('notifications') as any)
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
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

// 11. Fetch Conversations List
export const useConversations = (userId?: string) => {
  return useQuery({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Get all messages where I am sender or receiver
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(id, username, avatar_url),
          receiver:receiver_id(id, username, avatar_url)
        `)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by distinct partner
      const conversations: Record<string, any> = {};
      data.forEach((msg: any) => {
        const partner = msg.sender_id === userId ? msg.receiver : msg.sender;
        if (!partner) return;
        if (!conversations[partner.id]) {
          conversations[partner.id] = {
            partner,
            lastMessage: msg,
            unreadCount: (!msg.is_read && msg.receiver_id === userId) ? 1 : 0
          };
        } else if (!msg.is_read && msg.receiver_id === userId) {
          conversations[partner.id].unreadCount++;
        }
      });

      return Object.values(conversations);
    },
    enabled: !!userId,
  });
};

// 12. Fetch Individual Chat
export const useChat = (myId?: string, otherId?: string) => {
  return useQuery({
    queryKey: ['chat', myId, otherId],
    queryFn: async () => {
      if (!myId || !otherId) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!myId && !!otherId,
    refetchInterval: 3000,
  });
};

// 13. Send Message
export const useSendMessage = (myId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ receiverId, content }: { receiverId: string, content: string }) => {
      if (!myId) throw new Error('Not logged in');
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: myId,
          receiver_id: receiverId,
          content
        } as any)
        .select()
        .single() as any;
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { receiverId }) => {
      queryClient.invalidateQueries({ queryKey: ['chat', myId, receiverId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', myId] });
    }
  });
};

// 14. Delete Conversation
export const useDeleteConversation = (myId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (partnerId: string) => {
      if (!myId) throw new Error('Not logged in');
      const { error } = await supabase
        .from('messages')
        .delete()
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${myId})`);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', myId] });
    }
  });
};

// 15. Edit Message
export const useUpdateMessage = (myId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string, content: string }) => {
      if (!myId) throw new Error('Not logged in');
      const { error } = await supabase
        .from('messages')
        .update({ content } as any)
        .eq('id', messageId)
        .eq('sender_id', myId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat'] });
      queryClient.invalidateQueries({ queryKey: ['conversations', myId] });
    }
  });
};

// 16. Delete Message
export const useDeleteMessage = (myId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      if (!myId) throw new Error('Not logged in');
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', myId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat'] });
      queryClient.invalidateQueries({ queryKey: ['conversations', myId] });
    }
  });
};

// 17. Delete Notification
export const useDeleteNotification = (userId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!userId) throw new Error('Not logged in');
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    }
  });
};

// 18. Clear All Read Notifications
export const useClearReadNotifications = (userId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not logged in');
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .eq('is_read', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    }
  });
};
