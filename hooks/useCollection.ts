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
        .order('created_at', { ascending: false });

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
    }: {
      tmdbItem: TmdbMediaResult;
      formats: MovieFormat[];
      status?: 'owned' | 'wishlist';
      edition?: string | null;
      seasonNumber?: number | null;
    }) => {
      if (!userId) {
        console.error('useAddToCollection: No userId provided');
        throw new Error('Not authenticated');
      }

      const mediaType = tmdbItem.media_type;
      console.log('ADD Step 1: Mutation started for', mediaType, tmdbItem.id);
      let itemData = tmdbItem;

      if (!itemData.genres) {
        console.log('ADD Step 2: Fetching full details from TMDB');
        try {
          if (mediaType === 'movie') {
            itemData = await getMovieById(tmdbItem.id);
          } else {
            itemData = await getTvShowById(tmdbItem.id);
          }
          console.log('ADD Step 2.5: Details fetched');
        } catch (e) {
          console.warn('ADD Step 2 Failure: Failed to fetch details', e);
        }
      }

      console.log('ADD Step 3: Preparing cast data');
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
        console.log('ADD Step 4: Upserting media to database');
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
          console.error('ADD Step 4 Failure: UPSERT ERROR', movieError);
          throw movieError;
        }
        internalId = (movieRow as any).id;
        console.log('ADD Step 4 Complete: Internal ID is', internalId);
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
      }));

      console.log('ADD Step 5: Inserting collection links', itemsToInsert);
      const { error: itemError } = await supabase
        .from('collection_items')
        .insert(itemsToInsert as any);

      if (itemError) {
        if (itemError.code === '23505') {
          console.warn('ADD Step 5 Failure (Conflict): User already owns this');
          throw new Error('You already own this format/season. Fill in the Edition field to add another copy.');
        }
        console.error('ADD Step 5 Failure: ITEM INSERT ERROR', itemError);
        throw itemError;
      }

      console.log('ADD Step 6: Success!');
      return { internalId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', userId] });
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
      updates: {
        status?: 'owned' | 'wishlist';
        is_on_display?: boolean;
        is_grail?: boolean;
        rating?: number;
        notes?: string;
        edition?: string | null;
        custom_poster_url?: string | null;
        custom_backdrop_url?: string | null;
        custom_lists?: string[] | null;
      };
    }) => {
      if (!userId) throw new Error('Not authenticated');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('collection_items')
        .update(updates)
        .eq('id', itemId)
        .eq('user_id', userId);

      if (error) throw error;
      return { itemId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] });
    },
  });
}

export function useRefreshLibrary(userId: string | undefined) {
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');

      // 1. Fetch all items with their media IDs
      const { data: items, error } = await (supabase as any)
        .from('collection_items')
        .select(`
          media_type,
          movie_id,
          show_id,
          movies (tmdb_id),
          shows (tmdb_id)
        `)
        .eq('user_id', userId);

      if (error) throw error;

      // Dedup media items
      const moviesToRefresh = Array.from(new Set(items.filter((i: any) => i.media_type === 'movie').map((i: any) => i.movies?.tmdb_id).filter(Boolean))) as number[];
      const showsToRefresh = Array.from(new Set(items.filter((i: any) => i.media_type === 'tv').map((i: any) => i.shows?.tmdb_id).filter(Boolean))) as number[];

      const total = moviesToRefresh.length + showsToRefresh.length;
      console.log(`Refreshing ${moviesToRefresh.length} movies and ${showsToRefresh.length} shows...`);
      setProgress({ current: 0, total });

      let current = 0;

      // 2. Refresh Movies
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
          await (supabase as any).from('movies').update({ movie_cast: combinedCast }).eq('tmdb_id', tmdbId);
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
          await (supabase as any).from('shows').update({
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] });
    },
  });

  return { ...mutation, progress };
}
