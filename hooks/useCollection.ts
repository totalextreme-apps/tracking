import { supabase } from '@/lib/supabase';
import { getMovieById, type TmdbMovieResult } from '@/lib/tmdb';
import type { CollectionItemWithMovie, MovieFormat } from '@/types/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useCollection(userId: string | undefined) {
  return useQuery({
    queryKey: ['collection', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_items')
        .select(`*, movies (*)`)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CollectionItemWithMovie[];
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
      if (!userId) throw new Error('Not authenticated');

      let movieData = tmdbMovie;
      if (!movieData.genres) {
        try {
          movieData = await getMovieById(tmdbMovie.id);
        } catch (e) {
          console.log('Failed to fetch full movie details', e);
        }
      }

      const moviePayload = {
        tmdb_id: movieData.id,
        title: movieData.title,
        poster_path: movieData.poster_path,
        backdrop_path: movieData.backdrop_path,
        release_date: movieData.release_date,
        primary_color: null,
        genres: movieData.genres ?? null,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: movieRow, error: movieError } = await (supabase as any)
        .from('movies')
        .upsert(moviePayload, { onConflict: 'tmdb_id' })
        .select('id')
        .single();

      if (movieError) throw movieError;
      const movieId = movieRow.id;

      const itemsToInsert = formats.map((format) => ({
        user_id: userId,
        movie_id: movieId,
        format,
        status,
        edition: edition || null,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: itemError } = await (supabase as any)
        .from('collection_items')
        .insert(itemsToInsert);

      if (itemError) throw itemError;
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
