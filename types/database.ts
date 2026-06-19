/**
 * TypeScript types for the "Tracking" Supabase schema.
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
  for_sale: boolean;
  for_trade: boolean;
  price: number | null;
  value_estimate: number | null;
  custom_poster_url: string | null;
  custom_backdrop_url: string | null;
  custom_lists: string[] | null;
  rating?: number; // 0-5
  notes?: string | null;
  display_order?: number;
  grail_order?: number;
  last_watched_at?: string | null;
  watch_count?: number;
  created_at: string;
}

export interface CollectionItemWithMedia extends CollectionItem {
  movies: Movie | null;
  shows: Show | null;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface BulletinPost {
  id: string;
  user_id: string;
  collection_item_id: string | null;
  movie_id: number | null;
  show_id: number | null;
  content: string;
  rating: number | null;
  created_at: string;
}

export interface ItemComment {
  id: string;
  collection_item_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface ItemCommentWithProfile extends ItemComment {
  profiles: Profile | null;
}

export interface BulletinPostWithMedia extends BulletinPost {
  profiles: Profile | null;
  movies: Movie | null;
  shows: Show | null;
  collection_items: CollectionItem | null;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  reference_id: string;
  is_read: boolean;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      movies: {
        Row: Movie;
        Insert: Partial<Omit<Movie, 'id'>> & { id?: number };
        Update: Partial<Omit<Movie, 'id'>>;
        Relationships: [];
      };
      shows: {
        Row: Show;
        Insert: Partial<Omit<Show, 'id'>> & { id?: number };
        Update: Partial<Omit<Show, 'id'>>;
        Relationships: [];
      };
      collection_items: {
        Row: CollectionItem;
        Insert: Partial<Omit<CollectionItem, 'id' | 'created_at'>> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<CollectionItem, 'id' | 'user_id'>>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, 'id'>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      follows: {
        Row: Follow;
        Insert: Omit<Follow, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<Follow, 'created_at'>>;
        Relationships: [];
      };
      bulletin_posts: {
        Row: BulletinPost;
        Insert: Omit<BulletinPost, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<BulletinPost, 'id' | 'user_id'>>;
        Relationships: [];
      };
      item_comments: {
        Row: ItemComment;
        Insert: Omit<ItemComment, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ItemComment, 'id' | 'user_id' | 'collection_item_id'>>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at' | 'is_read'> & {
          id?: string;
          created_at?: string;
          is_read?: boolean;
        };
        Update: Partial<Omit<Message, 'id' | 'sender_id'>>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at' | 'is_read'> & {
          id?: string;
          created_at?: string;
          is_read?: boolean;
        };
        Update: Partial<Omit<Notification, 'id' | 'user_id'>>;
        Relationships: [];
      };
      post_comments: {
        Row: PostComment;
        Insert: Omit<PostComment, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<PostComment, 'id' | 'user_id' | 'post_id'>>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  website: string | null;
  bio: string | null;
  movie_preferences?: string[] | null;
  format_preferences?: string[] | null;
  letterboxd_username?: string | null;
  updated_at: string | null;
}
