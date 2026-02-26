import { supabase } from '@/lib/supabase';
import { getMovieById, type TmdbMovieResult } from '@/lib/tmdb';
import type { CollectionItemWithMovie, MovieFormat } from '@/types/database';
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
        .select(`*, movies (*)`)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      try {
        const { data, error } = await Promise.race([
          supabasePromise,
          timeoutPromise
        ]) as any;

        if (error) throw error;

        // If we have real data, return it
        if (data && data.length > 0) return data as CollectionItemWithMovie[];

        // Fallback to Mock User (if it's the mock ID and DB is empty)
        if (userId === '00000000-0000-0000-0000-000000000000') {
          console.log('Returning MOCK COLLECTION for empty dev user');
          return [
            {
              id: 'mock-1',
              user_id: '00000000-0000-0000-0000-000000000000',
              movie_id: 'mock-movie-1',
              format: 'VHS',
              status: 'owned',
              is_on_display: true,
              is_grail: true,
              created_at: new Date().toISOString(),
              movies: {
                id: 'mock-movie-1',
                title: '[DEV] ROBOT JOCK (MOCK)',
                poster_path: '/poster.jpg',
                backdrop_path: '/backdrop.jpg',
                release_date: '1989-01-01',
                genres: [{ id: 1, name: 'Sci-Fi' }]
              }
            }
          ] as any;
        }

        return [] as CollectionItemWithMovie[];
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
      tmdbMovie,
      formats,
      status = 'owned',
      edition = null,
    }: {
      tmdbMovie: TmdbMovieResult;
      formats: MovieFormat[];
      status?: 'owned' | 'wishlist';
      edition?: string | null;
    }) => {
      if (!userId) {
        console.error('useAddToCollection: No userId provided');
        throw new Error('Not authenticated');
      }

      console.log('useAddToCollection: Starting for user', userId);

      let movieData = tmdbMovie;
      if (!movieData.genres) {
        try {
          movieData = await getMovieById(tmdbMovie.id);
        } catch (e) {
          console.warn('Failed to fetch full movie details', e);
        }
      }

      let combinedCast = (movieData as any).credits?.cast?.slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profile_path: c.profile_path,
      })) ?? [];

      const director = (movieData as any).credits?.crew?.find((c: any) => c.job === 'Director');
      if (director) {
        combinedCast.push({
          id: director.id,
          name: director.name,
          character: 'Director',
          profile_path: director.profile_path,
        });
      }

      const moviePayload: any = {
        tmdb_id: movieData.id,
        title: movieData.title,
        poster_path: movieData.poster_path,
        backdrop_path: movieData.backdrop_path,
        release_date: movieData.release_date,
        genres: movieData.genres ?? null,
        movie_cast: combinedCast.length > 0 ? combinedCast : null,
      };

      const { data: movieRow, error: movieError } = await supabase
        .from('movies')
        .upsert(moviePayload, { onConflict: 'tmdb_id' })
        .select('id')
        .single();

      if (movieError) throw movieError;

      const movieId = (movieRow as any).id;
      const itemsToInsert = formats.map((format) => ({
        user_id: userId,
        movie_id: movieId,
        format,
        status,
        edition: edition || null,
      }));

      console.log('useAddToCollection: Inserting collection items:', itemsToInsert.length);
      const { error: itemError } = await supabase
        .from('collection_items')
        .insert(itemsToInsert as any);

      if (itemError) {
        // 23505 = unique_violation — same format already exists without a unique edition
        if (itemError.code === '23505') {
          throw new Error('You already own this format. Fill in the Edition field to add another copy (e.g. "Director\'s Cut", "Criterion").');
        }
        console.error('useAddToCollection: Item insert error:', itemError);
        throw itemError;
      }

      console.log('useAddToCollection: All steps successful!');
      return { movieId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] });
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

      // 1. Fetch all distinct movies from collection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: items, error } = await (supabase as any)
        .from('collection_items')
        .select(`
          movies (
            tmdb_id
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;

      // Dedup tmdb_ids
      const tmdbIds = Array.from(new Set(items.map((i: any) => i.movies?.tmdb_id).filter(Boolean))) as number[];

      console.log(`Refreshing ${tmdbIds.length} movies...`);
      setProgress({ current: 0, total: tmdbIds.length });

      // 2. Iterate and update
      for (let i = 0; i < tmdbIds.length; i++) {
        const tmdbId = tmdbIds[i];

        try {
          // Fetch from TMDB with credits
          const movieData = await getMovieById(tmdbId);

          let combinedCast = (movieData as any).credits?.cast?.slice(0, 10).map((c: any) => ({
            id: c.id,
            name: c.name,
            character: c.character,
            profile_path: c.profile_path,
          })) ?? [];

          const director = (movieData as any).credits?.crew?.find((c: any) => c.job === 'Director');
          if (director) {
            combinedCast.push({
              id: director.id,
              name: director.name,
              character: 'Director',
              profile_path: director.profile_path,
            });
          }

          const movie_cast = combinedCast.length > 0 ? combinedCast : null;

          // Update DB
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('movies')
            .update({ movie_cast })
            .eq('tmdb_id', tmdbId);

        } catch (e) {
          console.error(`Failed to refresh movie ${tmdbId}`, e);
        }

        setProgress({ current: i + 1, total: tmdbIds.length });
        // Delay to be nice to API
        await new Promise(r => setTimeout(r, 250));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] });
    },
  });

  return { ...mutation, progress };
}
