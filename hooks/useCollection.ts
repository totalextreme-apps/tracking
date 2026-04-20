import { supabase } from '@/lib/supabase';
import { getMovieById, getTvShowById, type TmdbMediaResult } from '@/lib/tmdb';
import type { CollectionItemWithMedia, MovieFormat } from '@/types/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export function useCollection(userId: string | undefined) {
  return useQuery({
    queryKey: ['collection', userId],
    queryFn: async () => {
      if (!userId) return [];

      // Try Real Supabase Fetch with Timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Collection fetch timed out')), 6000)
      );

      const supabasePromise = supabase
        .from('collection_items')
        .select(`*, movies (*), shows (*)`)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10000);

      try {
        const { data, error } = await Promise.race([
          supabasePromise,
          timeoutPromise
        ]) as any;

        if (error) throw error;

        // If we have real data, return it
        if (data && data.length > 0) return data as CollectionItemWithMedia[];

        // Fallback to Mock User (if it's the mock ID and DB is empty)
        if (userId === '00000000-0000-0000-0000-000000000000') {
          console.log('Returning MOCK COLLECTION for empty dev user');
          return [
            {
              id: 'mock-1',
              user_id: '00000000-0000-0000-0000-000000000000',
              media_type: 'movie',
              movie_id: 1,
              show_id: null,
              season_number: null,
              format: 'VHS',
              status: 'owned',
              is_on_display: true,
              is_grail: true,
              created_at: new Date().toISOString(),
              movies: {
                id: 1,
                title: '[DEV] ROBOT JOCK (MOCK)',
                poster_path: '/poster.jpg',
                backdrop_path: '/backdrop.jpg',
                release_date: '1989-01-01',
                genres: [{ id: 1, name: 'Sci-Fi' }]
              },
              shows: null
            }
          ] as any;
        }

        return [] as CollectionItemWithMedia[];
      } catch (e) {
        console.error('Fetch error:', e);
        // Fallback for mock user if network is dead
        if (userId === '00000000-0000-0000-0000-000000000000') {
          return [{ id: 'mock-offline', movies: { title: 'OFFLINE MOCK' } }] as any;
        }
        throw e;
      }
    },
    enabled: !!userId,
  });
}

export function useAddToCollection(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tmdbItem,
      formats,
      status = 'owned',
      edition = null,
      seasonNumber = null,
      isBootleg = false,
    }: {
      tmdbItem: TmdbMediaResult;
      formats: MovieFormat[];
      status?: 'owned' | 'wishlist';
      edition?: string | null;
      seasonNumber?: number | null;
      isBootleg?: boolean;
    }) => {
      if (!userId) {
        console.error('useAddToCollection: No userId provided');
        throw new Error('Not authenticated');
      }

      const mediaType = tmdbItem.media_type;
      let itemData = tmdbItem;

      if (!itemData.genres) {
        try {
          if (mediaType === 'movie') {
            itemData = await getMovieById(tmdbItem.id);
          } else {
            itemData = await getTvShowById(tmdbItem.id);
          }
        } catch (e) {
          console.warn('Metadata Fetch Failure:', e);
        }
      }
      let combinedCast = (itemData as any).credits?.cast?.slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profile_path: c.profile_path,
      })) ?? [];

      if (mediaType === 'movie') {
        const director = (itemData as any).credits?.crew?.find((c: any) => c.job === 'Director');
        if (director) {
          combinedCast.push({
            id: director.id,
            name: director.name,
            character: 'Director',
            profile_path: director.profile_path,
          });
        }
      }

      let internalId: number;

      if (mediaType === 'movie') {
        const moviePayload: any = {
          tmdb_id: itemData.id,
          title: itemData.title,
          poster_path: itemData.poster_path,
          backdrop_path: itemData.backdrop_path,
          release_date: itemData.release_date,
          genres: itemData.genres ?? null,
          movie_cast: combinedCast.length > 0 ? combinedCast : null,
        };

        const { data: movieRow, error: movieError } = await supabase
          .from('movies')
          .upsert(moviePayload, { onConflict: 'tmdb_id' })
          .select('id')
          .single();

        if (movieError) {
          console.error('UPSERT ERROR', movieError);
          throw movieError;
        }
        internalId = (movieRow as any).id;
      } else {
        const showPayload: any = {
          tmdb_id: itemData.id,
          name: itemData.name,
          poster_path: itemData.poster_path,
          backdrop_path: itemData.backdrop_path,
          first_air_date: itemData.first_air_date,
          genres: itemData.genres ?? null,
          show_cast: combinedCast.length > 0 ? combinedCast : null,
          number_of_seasons: itemData.number_of_seasons ?? null,
        };

        const { data: showRow, error: showError } = await supabase
          .from('shows')
          .upsert(showPayload, { onConflict: 'tmdb_id' })
          .select('id')
          .single();

        if (showError) throw showError;
        internalId = (showRow as any).id;
      }

      const itemsToInsert = formats.map((format) => ({
        user_id: userId,
        media_type: mediaType,
        movie_id: mediaType === 'movie' ? internalId : null,
        show_id: mediaType === 'tv' ? internalId : null,
        season_number: seasonNumber,
        format,
        status,
        edition: edition || null,
        is_bootleg: !!isBootleg,
      }));

      const { data: insertedItems, error: itemError } = await supabase
        .from('collection_items')
        .insert(itemsToInsert as any)
        .select('id');

      if (itemError) {
        if (itemError.code === '23505') {
          // Check if it's wishlist
          const { data: existingTarget } = await supabase
             .from('collection_items')
             .select('id, status, format')
             .eq('user_id', userId)
             .eq('media_type', mediaType)
             .eq(mediaType === 'movie' ? 'movie_id' : 'show_id', internalId)
             .in('format', formats);

          if (existingTarget && existingTarget.length > 0) {
              const targets = existingTarget as any[];
              const wishlistMatch = targets.find((t: any) => t.status === 'wishlist');
              if (wishlistMatch && status === 'owned') {
                 throw new Error(`WISHLIST_CONFLICT:::${wishlistMatch.id}:::${wishlistMatch.format}`);
              }
          }
          throw new Error('You already own this format/season. Fill in the Edition field to add another copy.');
        }
        throw itemError;
      }

      return { internalId };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['collection', userId] });
    },
  });
}

export function useUpdateCollectionItem(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      updates,
    }: {
      itemId: string;
      updates: any;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('collection_items')
        .update(updates)
        .eq('id', itemId)
        .eq('user_id', userId)
        .select() as any;

      if (error) throw error;
      return data[0];
    },
    onMutate: async ({ itemId, updates }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['collection', userId] });

      // Snapshot the previous value
      const previousCollection = queryClient.getQueryData(['collection', userId]);

      // Optimistically update to the new value
      queryClient.setQueryData(['collection', userId], (old: any) => {
        if (!old) return old;
        return old.map((item: any) => 
          item.id === itemId ? { ...item, ...updates } : item
        );
      });

      // Return a context object with the snapshotted value
      return { previousCollection };
    },
    onError: (err, variables, context) => {
      // Rollback to the previous value if mutation fails
      if (context?.previousCollection) {
        queryClient.setQueryData(['collection', userId], context.previousCollection);
      }
      console.error('Update failed:', err);
    },
    onSettled: () => {
      // Always refetch after error or success to keep server in sync
      queryClient.invalidateQueries({ queryKey: ['collection', userId] });
    },
  });
}

export function useBulkUpdateCustomLists(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemIds,
      listName,
      isAdding,
    }: {
      itemIds: string[];
      listName: string;
      isAdding: boolean;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      // Since Supabase doesn't easily support dynamic array append/remove in bulk RPC without custom functions,
      // and we want to keep it simple: we fetch the items, modify their arrays in memory, and upsert/update them.
      // Actually, since we only do this once on "Save Stack", we can just fetch, modify, and update.

      const { data: items, error: fetchError } = await supabase
        .from('collection_items')
        .select('id, custom_lists')
        .in('id', itemIds)
        .eq('user_id', userId);

      if (fetchError) throw fetchError;
      if (!items || items.length === 0) return { itemIds };

      // Run individual updates per item — using .update() ensures we never attempt
      // an INSERT (which would fail due to NOT NULL constraints on movie_id etc.)
      const updatePromises = items.map((item: any) => {
        let currentLists = item.custom_lists || [];
        if (isAdding) {
          if (!currentLists.includes(listName)) {
            currentLists = [...currentLists, listName];
          }
        } else {
          currentLists = currentLists.filter((l: string) => l !== listName);
        }
        return (supabase as any)
          .from('collection_items')
          .update({ custom_lists: currentLists })
          .eq('id', item.id)
          .eq('user_id', userId);
      });

      const results = await Promise.all(updatePromises);
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw firstError;

      return { itemIds, listName };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] });
    },
  });
}

/** Rename a custom list across all collection items that contain it */
export function useRenameCustomList(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      if (!userId) throw new Error('Not authenticated');
      if (!newName.trim() || newName.trim() === oldName) return;

      // Fetch all items that have oldName in their custom_lists
      const { data: items, error: fetchError } = await supabase
        .from('collection_items')
        .select('id, custom_lists')
        .contains('custom_lists', [oldName])
        .eq('user_id', userId);

      if (fetchError) throw fetchError;
      if (!items || items.length === 0) return;

      const updatePromises = items.map((item: any) => {
        const updated = (item.custom_lists || []).map((l: string) =>
          l === oldName ? newName.trim() : l
        );
        return (supabase as any)
          .from('collection_items')
          .update({ custom_lists: updated })
          .eq('id', item.id)
          .eq('user_id', userId);
      });

      const results = await Promise.all(updatePromises);
      const firstError = results.find((r: any) => r.error)?.error;
      if (firstError) throw firstError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['collection'] });
    },
  });
}

export function useDeleteCollectionItem(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('collection_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', userId);

      if (error) throw error;
      return itemId;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['collection'] });
    },
  });
}

export function useRefreshLibrary(userId: string | undefined) {
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');

      // 1. Fetch all items (including those with null media joins)
      const { data: items, error } = await supabase
        .from('collection_items')
        .select(`
          id,
          media_type,
          movie_id,
          show_id,
          movies (id, tmdb_id),
          shows (id, tmdb_id)
        `)
        .eq('user_id', userId);

      if (error) throw error;

      // Identify items missing metadata
      const orphans = items.filter((i: any) => 
        (i.media_type === 'movie' && !i.movies) || 
        (i.media_type === 'tv' && !i.shows)
      );

      // Identify items that have metadata but need refresh
      const existingMovies = items.filter((i: any) => i.media_type === 'movie' && i.movies?.tmdb_id).map((i: any) => i.movies.tmdb_id);
      const existingShows = items.filter((i: any) => i.media_type === 'tv' && i.shows?.tmdb_id).map((i: any) => i.shows.tmdb_id);

      const moviesToRefresh = Array.from(new Set(existingMovies)) as number[];
      const showsToRefresh = Array.from(new Set(existingShows)) as number[];

      const total = moviesToRefresh.length + showsToRefresh.length + orphans.length;
      console.log(`Refreshing ${moviesToRefresh.length} movies, ${showsToRefresh.length} shows, and repairing ${orphans.length} orphans...`);
      setProgress({ current: 0, total });

      let current = 0;

      // 2. Repair Orphans (Phase 2)
      for (const orphan of orphans) {
        try {
          // HEURISTIC: If the join failed, but we have a movie_id, it might be a TMDB ID
          // instead of an internal ID. We attempt to recover it by fetching TMDB.
          const suspectedTmdbId = orphan.media_type === 'movie' ? orphan.movie_id : orphan.show_id;
          
          if (suspectedTmdbId) {
            console.log(`Deep Repair: Attempting recovery for orphan ${orphan.id} with suspected ID ${suspectedTmdbId}`);
            if (orphan.media_type === 'movie') {
               try {
                 const data = await getMovieById(suspectedTmdbId);
                 const { data: movieRow } = await supabase.from('movies').upsert({
                   tmdb_id: data.id,
                   title: data.title,
                   poster_path: data.poster_path,
                   backdrop_path: data.backdrop_path,
                   release_date: data.release_date,
                   genres: data.genres ?? null,
                 }, { onConflict: 'tmdb_id' }).select('id').single();
                 
                 if (movieRow) {
                   await supabase.from('collection_items').update({ movie_id: (movieRow as any).id }).eq('id', orphan.id);
                 }
               } catch (err) {
                 console.warn(`TMDB ID ${suspectedTmdbId} not found for movie orphan.`);
               }
            } else {
               try {
                 const data = await getTvShowById(suspectedTmdbId);
                 const { data: showRow } = await supabase.from('shows').upsert({
                   tmdb_id: data.id,
                   name: data.name,
                   poster_path: data.poster_path,
                   backdrop_path: data.backdrop_path,
                   first_air_date: data.first_air_date,
                   genres: data.genres ?? null,
                 }, { onConflict: 'tmdb_id' }).select('id').single();
                 
                 if (showRow) {
                   await supabase.from('collection_items').update({ show_id: (showRow as any).id }).eq('id', orphan.id);
                 }
               } catch (err) {
                 console.warn(`TMDB ID ${suspectedTmdbId} not found for show orphan.`);
               }
            }
          }
        } catch (e) {
          console.error('Failed to repair orphan', orphan.id, e);
        }
        current++;
        setProgress({ current, total });
        await new Promise(r => setTimeout(r, 200));
      }

      // 3. Refresh Movies
      for (const tmdbId of moviesToRefresh) {
        try {
          const movieData = await getMovieById(tmdbId);
          let combinedCast = (movieData as any).credits?.cast?.slice(0, 10).map((c: any) => ({
            id: c.id,
            name: c.name,
            character: c.character,
            profile_path: c.profile_path,
          })) ?? [];
          const director = (movieData as any).credits?.crew?.find((c: any) => c.job === 'Director');
          if (director) {
            combinedCast.push({ id: director.id, name: director.name, character: 'Director', profile_path: director.profile_path });
          }
          await supabase.from('movies').update({ movie_cast: combinedCast }).eq('tmdb_id', tmdbId);
        } catch (e) {
          console.error(`Failed to refresh movie ${tmdbId}`, e);
        }
        current++;
        setProgress({ current, total });
        await new Promise(r => setTimeout(r, 250));
      }

      // 3. Refresh Shows
      for (const tmdbId of showsToRefresh) {
        try {
          const showData = await getTvShowById(tmdbId);
          let combinedCast = (showData as any).credits?.cast?.slice(0, 10).map((c: any) => ({
            id: c.id,
            name: c.name,
            character: c.character,
            profile_path: c.profile_path,
          })) ?? [];
          await supabase.from('shows').update({
            show_cast: combinedCast,
            number_of_seasons: showData.number_of_seasons
          }).eq('tmdb_id', tmdbId);
        } catch (e) {
          console.error(`Failed to refresh show ${tmdbId}`, e);
        }
        current++;
        setProgress({ current, total });
        await new Promise(r => setTimeout(r, 250));
      }

      // 2. Refresh Movies... (keep existing)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['collection'] });
    },
  });

  return { ...mutation, progress };
}

export function useDeepRepair(userId?: string) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { data: items } = await supabase.from('collection_items').select('*').eq('user_id', userId);
      if (!items) return;

      const orphans = items.filter(i => !i.movies && !i.shows && (i.movie_id || i.show_id));
      const totallyNull = items.filter(i => !i.movie_id && !i.show_id);
      const total = orphans.length + totallyNull.length;
      setProgress({ current: 0, total });

      let current = 0;
      for (const item of orphans) {
        try {
          const suspectedTmdbId = item.media_type === 'movie' ? item.movie_id : item.show_id;
          if (suspectedTmdbId && suspectedTmdbId > 0) {
            const data = await (item.media_type === 'movie' ? getMovieById(suspectedTmdbId) : getTvShowById(suspectedTmdbId));
            if (data) {
              const table = item.media_type === 'movie' ? 'movies' : 'shows';
              const { data: row } = await supabase.from(table).upsert({ tmdb_id: data.id, title: (data as any).title || (data as any).name, poster_path: data.poster_path }, { onConflict: 'tmdb_id' }).select('id').single();
              if (row) {
                await supabase.from('collection_items').update({ [item.media_type === 'movie' ? 'movie_id' : 'show_id']: row.id }).eq('id', item.id);
              }
            }
          }
        } catch (e) { console.error('Deep repair failed for item', item.id, e); }
        current++;
        setProgress({ current, total });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] });
    }
  });

  return { ...mutation, progress };
}

export function usePurgeOrphans(userId?: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await supabase.from('collection_items').delete().eq('user_id', userId).is('movie_id', null).is('show_id', null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] });
    }
  });
  return mutation;
}
export function useResetMetadata(userId?: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      // This resets all movie_id and show_id back to NULL for any item that doesn't have a valid join?
      // Actually, we want to reset the titles we just wrongly "repaired".
      // We'll just look for any record where movie_id or show_id is an integer (legacy IDs)
      // and reset them to the raw IDs from the notes or just NULL so they become orphans again.
      
      // Simpler: Just delete the rows in 'movies' and 'shows' that we just created.
      // But we don't know which ones.
      
      // Best way: Just null out all movie_id/show_id in collection_items for this user 
      // where the linked movie/show was created in the last hour?
      // No, too risky.
      
      // Let's just set all movie_id and show_id to NULL.
      // This will make EVERYTHING an orphan, and then we can run a CORRECT repair.
      await supabase.from('collection_items').update({ movie_id: null, show_id: null }).eq('user_id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] });
    }
  });
  return mutation;
}
