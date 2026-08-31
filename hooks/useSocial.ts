import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Profile, Follow, BulletinPostWithMedia, ItemCommentWithProfile } from '@/types/database';
import { getMovieById, getTvShowById } from '@/lib/tmdb';

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
          if (aTop !== bTop) {
              return bTop - aTop;
          }
          if (a.is_top_five && b.is_top_five) {
              const aOrder = a.top_five_order !== null && a.top_five_order !== undefined ? a.top_five_order : 0;
              const bOrder = b.top_five_order !== null && b.top_five_order !== undefined ? b.top_five_order : 0;
              return aOrder - bOrder;
          }
          return 0;
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
      queryClient.invalidateQueries({ queryKey: ['followers', targetUserId] });
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
      return data as any[];
    },
    enabled: query.length > 0,
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
    staleTime: 1000 * 60 * 5, // Cache suggested users for 5 minutes
  });
};

// 5c. All Users (Directory)
export const useAllUsers = (currentUserId?: string, enabledParam = true) => {
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
    enabled: enabledParam && !!currentUserId,
    staleTime: 1000 * 60 * 5, // Cache directory list for 5 minutes
  });
};

// 6. Fetch Bulletin Feed (Posts from people you follow + your own)
export const useBulletinFeed = (userId?: string, enabledParam = true) => {
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
          movies(id, title, poster_path, tmdb_id),
          shows(id, name, poster_path, tmdb_id),
          collection_items(
            *,
            movies(id, title, poster_path, tmdb_id),
            shows(id, name, poster_path, tmdb_id)
          ),
          post_comments(
            id,
            content,
            created_at,
            profiles(id, username, avatar_url)
          )
        `)
        .in('user_id', interestingIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const mapped = (data || []).map((p: any) => {
        let finalMovie = p.movies;
        let finalShow = p.shows;
        if (p.collection_items) {
          if (p.collection_items.movies) {
            finalMovie = p.collection_items.movies;
          }
          if (p.collection_items.shows) {
            finalShow = p.collection_items.shows;
          }
        }
        return {
          ...p,
          movies: finalMovie,
          shows: finalShow
        };
      });

      return mapped as BulletinPostWithMedia[];
    },
    enabled: enabledParam && !!userId,
    staleTime: 1000 * 30, // Cache board posts for 30 seconds
  });
};

// 7. Marketplace Feed (Items for sale/trade from community)
export function useMarketplaceFeed() {
  return useQuery({
    queryKey: ['marketplace_feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_items')
        .select(`*, movies(*), shows(*)`)
        .or(`for_sale.eq.true,for_trade.eq.true`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch profiles in memory to avoid missing foreign key relation errors
      const userIds = [...new Set(data.map((item: any) => item.user_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);
        if (profErr) throw profErr;
        profiles?.forEach((p: any) => {
          profilesMap[p.id] = p;
        });
      }

      return data.map((item: any) => ({
        ...item,
        profiles: profilesMap[item.user_id] || null
      }));
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
      custom_list_name?: string | null;
      rating?: number;
    }) => {
      if (!userId) throw new Error('Not logged in');
      
      let dbMovieId: number | undefined = undefined;
      let dbShowId: number | undefined = undefined;

      if (postData.movie_id) {
        // Fetch or cache movie row by its TMDB ID
        const { data: existingMovie } = await supabase
          .from('movies')
          .select('id')
          .eq('tmdb_id', postData.movie_id)
          .maybeSingle();

        if (existingMovie) {
          dbMovieId = existingMovie.id;
        } else {
          try {
            const details = await getMovieById(postData.movie_id);
            const { data: newMovie } = await supabase
              .from('movies')
              .upsert({
                tmdb_id: details.id,
                title: details.title,
                poster_path: details.poster_path,
                backdrop_path: details.backdrop_path,
                release_date: details.release_date,
                genres: details.genres ?? null,
              }, { onConflict: 'tmdb_id' })
              .select('id')
              .single();
            if (newMovie) dbMovieId = (newMovie as any).id;
          } catch (err) {
            console.error('Failed to cache movie during posting:', err);
          }
        }
      }

      if (postData.show_id) {
        // Fetch or cache show row by its TMDB ID
        const { data: existingShow } = await supabase
          .from('shows')
          .select('id')
          .eq('tmdb_id', postData.show_id)
          .maybeSingle();

        if (existingShow) {
          dbShowId = existingShow.id;
        } else {
          try {
            const details = await getTvShowById(postData.show_id);
            const { data: newShow } = await supabase
              .from('shows')
              .upsert({
                tmdb_id: details.id,
                name: details.name,
                poster_path: details.poster_path,
                backdrop_path: details.backdrop_path,
                first_air_date: details.first_air_date,
                genres: details.genres ?? null,
              }, { onConflict: 'tmdb_id' })
              .select('id')
              .single();
            if (newShow) dbShowId = (newShow as any).id;
          } catch (err) {
            console.error('Failed to cache show during posting:', err);
          }
        }
      }

      const { error, data } = await supabase
        .from('bulletin_posts')
        .insert({
          user_id: userId,
          content: postData.content,
          collection_item_id: postData.collection_item_id,
          movie_id: dbMovieId,
          show_id: dbShowId,
          custom_list_name: postData.custom_list_name,
          rating: postData.rating
        } as any)
        .select()
        .single() as any;
        
      if (error) throw error;

      // Process mentions
      if (postData.content) {
        const mentionRegex = /@(\w+)/g;
        const mentions = [...postData.content.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
        
        if (mentions.length > 0) {
          // Fetch profiles matching mentioned usernames case-insensitively using OR and ILIKE
          const orConditions = mentions.map(m => `username.ilike.${m}`).join(',');
          const { data: users } = await supabase
            .from('profiles')
            .select('id, username')
            .or(orConditions);

          if (users && users.length > 0) {
             const matchedUsers = users.filter((u: any) => u.username && mentions.includes(u.username.toLowerCase()));
             if (matchedUsers.length > 0) {
               const notifications = matchedUsers.map((user: any) => ({
                 user_id: user.id,
                 actor_id: userId,
                 type: 'mention',
                 reference_id: data.id
               }));
               await supabase.from('notifications').insert(notifications);
             }
          }
        }
      }

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
export const useItemComments = (collectionItemId?: string, initialData?: any[]) => {
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
    initialData,
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

export const usePostComments = (postId?: string, initialData?: any[]) => {
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
    initialData,
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
      if (!data || data.length === 0) return [];

      // Group reference IDs by type
      const postCommentIds = data.filter((n: any) => n.type === 'post_comment' || n.type === 'comment_mention').map((n: any) => n.reference_id);
      const itemCommentIds = data.filter((n: any) => n.type === 'item_comment').map((n: any) => n.reference_id);
      const postIds = data.filter((n: any) => n.type === 'post_mention').map((n: any) => n.reference_id);
      const reactionIds = data.filter((n: any) => n.type === 'reaction').map((n: any) => n.reference_id);
      const profileCommentIds = data.filter((n: any) => n.type === 'profile_comment').map((n: any) => n.reference_id);

      const [postCommentsRes, itemCommentsRes, postsRes, reactionsRes, profileCommentsRes] = await Promise.all([
        postCommentIds.length > 0
          ? supabase.from('post_comments').select('id, content, post_id').in('id', postCommentIds).then((res: any) => res.data || []).catch(() => [])
          : Promise.resolve([]),
        itemCommentIds.length > 0
          ? supabase.from('item_comments').select('id, content, collection_item_id, collection_items(id, user_id, season_number, movies(title), shows(name))').in('id', itemCommentIds).then((res: any) => res.data || []).catch(() => [])
          : Promise.resolve([]),
        postIds.length > 0
          ? supabase.from('bulletin_posts').select('id, content').in('id', postIds).then((res: any) => res.data || []).catch(() => [])
          : Promise.resolve([]),
        reactionIds.length > 0
          ? supabase.from('reactions').select('id, reaction_type, post_id, collection_item_id, post_comment_id, item_comment_id, collection_items(id, user_id, movies(title), shows(name)), item_comments(id, collection_items(id, user_id, movies(title), shows(name)))').in('id', reactionIds).then((res: any) => res.data || []).catch(() => [])
          : Promise.resolve([]),
        profileCommentIds.length > 0
          ? supabase.from('profile_comments').select('id, content').in('id', profileCommentIds).then((res: any) => res.data || []).catch(() => [])
          : Promise.resolve([])
      ]);

      const postCommentsMap = new Map(postCommentsRes.map((item: any) => [item.id, item]));
      const itemCommentsMap = new Map(itemCommentsRes.map((item: any) => [item.id, item]));
      const postsMap = new Map(postsRes.map((item: any) => [item.id, item]));
      const reactionsMap = new Map(reactionsRes.map((item: any) => [item.id, item]));
      const profileCommentsMap = new Map(profileCommentsRes.map((item: any) => [item.id, item]));

      return data.map((n: any) => {
        let referenceData = null;
        if (n.type === 'post_comment' || n.type === 'comment_mention') {
          referenceData = postCommentsMap.get(n.reference_id);
        } else if (n.type === 'item_comment') {
          referenceData = itemCommentsMap.get(n.reference_id);
        } else if (n.type === 'post_mention') {
          referenceData = postsMap.get(n.reference_id);
        } else if (n.type === 'reaction') {
          referenceData = reactionsMap.get(n.reference_id);
        } else if (n.type === 'profile_comment') {
          referenceData = profileCommentsMap.get(n.reference_id);
        }
        return { ...n, referenceData };
      });
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
      const interestingIds = [...followingIds, userId];

      // Fetch all feed segments in parallel
      const [postsRes, updatesRes, watchesRes, listingsRes, commentsRes] = await Promise.all([
        supabase
          .from('bulletin_posts')
          .select(`
            *,
            profiles(*),
            movies(id, title, poster_path, tmdb_id),
            shows(id, name, poster_path, tmdb_id),
            collection_items(
              *,
              movies(id, title, poster_path, tmdb_id),
              shows(id, name, poster_path, tmdb_id)
            ),
            post_comments(
              id,
              content,
              created_at,
              profiles(id, username, avatar_url)
            )
          `)
          .in('user_id', interestingIds)
          .order('created_at', { ascending: false })
          .limit(25),
        supabase
          .from('collection_items')
          .select(`
            *,
            movies(id, title, poster_path, tmdb_id),
            shows(id, name, poster_path, tmdb_id),
            item_comments(
              id,
              content,
              created_at,
              profiles(id, username, avatar_url)
            )
          `)
          .in('user_id', interestingIds)
          .eq('status', 'owned')
          .order('created_at', { ascending: false })
          .limit(25),
        supabase
          .from('collection_items')
          .select(`
            *,
            movies(id, title, poster_path, tmdb_id),
            shows(id, name, poster_path, tmdb_id),
            item_comments(
              id,
              content,
              created_at,
              profiles(id, username, avatar_url)
            )
          `)
          .in('user_id', interestingIds)
          .not('last_watched_at', 'is', null)
          .order('last_watched_at', { ascending: false })
          .limit(25),
        supabase
          .from('collection_items')
          .select(`
            *,
            movies(id, title, poster_path, tmdb_id),
            shows(id, name, poster_path, tmdb_id),
            item_comments(
              id,
              content,
              created_at,
              profiles(id, username, avatar_url)
            )
          `)
          .in('user_id', interestingIds)
          .or('for_sale.eq.true,for_trade.eq.true')
          .order('created_at', { ascending: false })
          .limit(25),
        supabase
          .from('item_comments')
          .select(`
            *,
            profiles(*),
            collection_items(
              *,
              movies(id, title, poster_path, tmdb_id),
              shows(id, name, poster_path, tmdb_id)
            )
          `)
          .in('user_id', interestingIds)
          .order('created_at', { ascending: false })
          .limit(25)
      ]);

      const posts = postsRes.data;
      const updates = updatesRes.data;
      const watches = watchesRes.data;
      const listings = listingsRes.data;
      const comments = commentsRes.data;

      if (postsRes.error) console.error('Error fetching posts:', postsRes.error);
      if (updatesRes.error) console.error('Error fetching updates:', updatesRes.error);
      if (watchesRes.error) console.error('Error fetching watches:', watchesRes.error);
      if (listingsRes.error) console.error('Error fetching listings:', listingsRes.error);
      if (commentsRes.error) console.error('Error fetching comments:', commentsRes.error);

      // Fetch profiles in memory for owners of updates/collection items to avoid missing relation errors
      const profileIdsToFetch = new Set<string>();
      updates?.forEach((u: any) => { if (u.user_id) profileIdsToFetch.add(u.user_id); });
      watches?.forEach((w: any) => { if (w.user_id) profileIdsToFetch.add(w.user_id); });
      listings?.forEach((l: any) => { if (l.user_id) profileIdsToFetch.add(l.user_id); });
      comments?.forEach((c: any) => {
        if (c.collection_items?.user_id) profileIdsToFetch.add(c.collection_items.user_id);
      });

      let profilesMap: Record<string, any> = {};
      if (profileIdsToFetch.size > 0) {
        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', Array.from(profileIdsToFetch));
        if (profErr) throw profErr;
        profiles?.forEach((p: any) => {
          profilesMap[p.id] = p;
        });
      }

      const processedUpdates = (updates || []).map((u: any) => ({
        ...u,
        profiles: profilesMap[u.user_id] || null,
        activity_type: 'update'
      }));

      const processedWatches = (watches || []).map((w: any) => ({
        ...w,
        profiles: profilesMap[w.user_id] || null,
        activity_type: 'watch',
        created_at: w.last_watched_at
      }));

      const processedComments = (comments || []).map((c: any) => {
        const itemOwnerId = c.collection_items?.user_id;
        const ownerProfile = itemOwnerId ? (profilesMap[itemOwnerId] || null) : null;
        return {
          ...c,
          activity_type: 'comment',
          collection_items: c.collection_items ? {
            ...c.collection_items,
            profiles: ownerProfile
          } : null
        };
      });

      const processedPosts = (posts || []).map((p: any) => {
        let finalMovie = p.movies;
        let finalShow = p.shows;
        if (p.collection_items) {
          if (p.collection_items.movies) {
            finalMovie = p.collection_items.movies;
          }
          if (p.collection_items.shows) {
            finalShow = p.collection_items.shows;
          }
        }
        return {
          ...p,
          movies: finalMovie,
          shows: finalShow,
          activity_type: 'post'
        };
      });

      const processedListings = (listings || []).map((l: any) => ({
        ...l,
        profiles: profilesMap[l.user_id] || null,
        activity_type: 'listing',
        created_at: l.created_at
      }));

      const activity = [
        ...processedPosts,
        ...processedUpdates,
        ...processedComments,
        ...processedWatches,
        ...processedListings
      ];
      
      return activity.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!userId,
    refetchInterval: 10000, // Poll community feed every 10 seconds to keep it fresh
    staleTime: 1000 * 10,    // Cache community feed for 10 seconds to avoid unnecessary rapid queries
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

// 19. Reorder Top 5 Tracked Members
export function useReorderTopFive(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (followingIds: string[]) => {
      if (!userId) throw new Error('Not logged in');
      const promises = followingIds.map((followingId, index) => {
        return supabase
          .from('follows')
          .update({ top_five_order: index } as any)
          .eq('follower_id', userId)
          .eq('following_id', followingId);
      });
      const results = await Promise.all(promises);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following', userId] });
    }
  });
}

// 20. Fetch Specific User's Posts and Reviews
export function useUserPosts(profileId: string | undefined) {
  return useQuery({
    queryKey: ['user_posts', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from('bulletin_posts')
        .select(`
          *,
          profiles(*),
          movies(*),
          shows(*),
          collection_items(
            *,
            movies(*),
            shows(*)
          )
        `)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const mapped = (data || []).map((p: any) => {
        let finalMovie = p.movies;
        let finalShow = p.shows;
        if (p.collection_items) {
          if (p.collection_items.movies) {
            finalMovie = p.collection_items.movies;
          }
          if (p.collection_items.shows) {
            finalShow = p.collection_items.shows;
          }
        }
        return {
          ...p,
          movies: finalMovie,
          shows: finalShow
        };
      });

      return mapped as BulletinPostWithMedia[];
    },
    enabled: !!profileId
  });
}

// 21. Fetch Guestbook Comments on Profile
export function useProfileComments(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profile_comments', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from('profile_comments')
        .select(`
          *,
          author:profiles!profile_comments_author_id_fkey(*)
        `)
        .eq('profile_id', profileId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!profileId
  });
}

// 22. Add Profile Comment
export function useAddProfileComment(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, content, parentId = null }: { profileId: string, content: string, parentId?: string | null }) => {
      if (!userId) throw new Error('Not logged in');
      const { data, error } = await supabase
        .from('profile_comments')
        .insert({
          profile_id: profileId,
          author_id: userId,
          content,
          parent_id: parentId
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile_comments', data.profile_id] });
    }
  });
}

// 23. Update Profile Comment
export function useUpdateProfileComment(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string, content: string }) => {
      if (!userId) throw new Error('Not logged in');
      const { data, error } = await supabase
        .from('profile_comments')
        .update({ content, updated_at: new Date().toISOString() } as any)
        .eq('id', commentId)
        .eq('author_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile_comments', data.profile_id] });
    }
  });
}

// 24. Delete Profile Comment
export function useDeleteProfileComment(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, profileId }: { commentId: string, profileId: string }) => {
      if (!userId) throw new Error('Not logged in');
      const { error } = await supabase
        .from('profile_comments')
        .delete()
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile_comments', variables.profileId] });
    }
  });
}

// 25. Fetch App-wide Leaderboard / Store Charts Stats
export function useAppWideStats() {
  return useQuery({
    queryKey: ['app_wide_stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_app_wide_stats');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10, // Cache app-wide statistics for 10 minutes
    gcTime: 1000 * 60 * 30,    // Keep stats cache in garbage collection memory for 30 minutes
  });
}
