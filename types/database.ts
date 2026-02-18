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

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface CollectionItem {
  id: string;
  user_id: string;
  movie_id: number;
  format: MovieFormat;
  status: ItemStatus;
  is_on_display: boolean;
  is_grail: boolean;
  edition: string | null;
  digital_provider: string | null;
  condition: string | null;
  notes: string | null;
  rating?: number; // 0-5
  created_at: string;
}

export interface CollectionItemWithMovie extends CollectionItem {
  movies: Movie | null;
}

export interface Database {
  public: {
    Tables: {
      movies: {
        Row: Movie;
        Insert: Omit<Movie, 'id'> & { id?: number };
        Update: Partial<Omit<Movie, 'id'>>;
      };
      collection_items: {
        Row: CollectionItem;
        Insert: Omit<CollectionItem, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<CollectionItem, 'id' | 'user_id'>>;
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
