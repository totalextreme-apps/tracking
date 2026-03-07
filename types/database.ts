/**
 * TypeScript types for the "Tracking" Supabase schema.
 * Generated from the SQL schema in the Master Prompt.
 */

export type MovieFormat = 'VHS' | 'DVD' | 'BluRay' | '4K' | 'Digital';
export type ItemStatus = 'owned' | 'wishlist';

export interface Movie {
  id: number;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  primary_color: string | null;
  genres: { id: number; name: string }[] | null;
  cast: CastMember[] | null;
}

export interface Show {
  id: number;
  tmdb_id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  primary_color: string | null;
  genres: { id: number; name: string }[] | null;
  show_cast: CastMember[] | null;
  number_of_seasons: number | null;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface CollectionItem {
  id: string;
  user_id: string;
  media_type: 'movie' | 'tv';
  movie_id: number | null;
  show_id: number | null;
  season_number: number | null;
  format: MovieFormat;
  status: ItemStatus;
  is_on_display: boolean;
  is_grail: boolean;
  edition: string | null;
  digital_provider: string | null;
  condition: string | null;
  is_bootleg: boolean;
  custom_poster_url: string | null;
  custom_lists: string[] | null;
  rating?: number; // 0-5
  created_at: string;
}

export interface CollectionItemWithMedia extends CollectionItem {
  movies: Movie | null;
  shows: Show | null;
}

export interface Database {
  public: {
    Tables: {
      movies: {
        Row: Movie;
        Insert: Omit<Movie, 'id'> & { id?: number };
        Update: Partial<Omit<Movie, 'id'>>;
      };
      shows: {
        Row: Show;
        Insert: Omit<Show, 'id'> & { id?: number };
        Update: Partial<Omit<Show, 'id'>>;
      };
      collection_items: {
        Row: CollectionItem;
        Insert: Omit<CollectionItem, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<CollectionItem, 'id' | 'user_id'>> & {
          custom_poster_url?: string | null;
        };
      };
      profiles: {
        Row: Profile;
        Insert: Profile;
        Update: Partial<Profile>;
      };
    };
  };
}

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  website: string | null;
  bio: string | null;
  updated_at: string | null;
}
