import type { CollectionItemWithMovie, Movie } from '@/types/database';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const createMovie = (overrides: Partial<Movie> = {}): Movie => ({
  id: 0,
  tmdb_id: 0,
  title: 'Unknown',
  poster_path: null,
  backdrop_path: null,
  release_date: null,
  primary_color: null,
  ...overrides,
});

export const createCollectionItem = (
  movie: Movie,
  overrides: Partial<CollectionItemWithMovie> = {}
): CollectionItemWithMovie => ({
  id: Math.random().toString(36).substring(7),
  user_id: 'demo-user',
  movie_id: movie.id,
  format: 'DVD',
  status: 'owned',
  is_on_display: false,
  is_grail: false,
  digital_provider: null,
  condition: null,
  notes: null,
  created_at: new Date().toISOString(),
  movies: movie,
  ...overrides,
});

export const getPosterUrl = (path: string | null, size = 'w342') =>
  path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;

export const getBackdropUrl = (path: string | null, size = 'w780') =>
  path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;

// Dummy data for UI development
export const DUMMY_MOVIES: Movie[] = [
  createMovie({
    id: 1,
    tmdb_id: 550,
    title: 'Fight Club',
    poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    backdrop_path: '/fCayJrkfRaCRCTh8GqN30f8oyQF.jpg',
    release_date: '1999-10-15',
    primary_color: '#8B4513',
  }),
  createMovie({
    id: 2,
    tmdb_id: 680,
    title: 'Pulp Fiction',
    poster_path: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
    backdrop_path: '/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg',
    release_date: '1994-10-14',
    primary_color: '#2F4F4F',
  }),
  createMovie({
    id: 3,
    tmdb_id: 155,
    title: 'The Dark Knight',
    poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    backdrop_path: '/hbkA33M0LDUkvjMZDCT7Yusrmaa.jpg',
    release_date: '2008-07-18',
    primary_color: '#0D0D0D',
  }),
  createMovie({
    id: 4,
    tmdb_id: 238,
    title: 'The Godfather',
    poster_path: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
    backdrop_path: '/tmU7GeKVybMWFButWEGl2M4GeiP.jpg',
    release_date: '1972-03-15',
    primary_color: '#1a0a00',
  }),
  createMovie({
    id: 5,
    tmdb_id: 424,
    title: 'Schindler\'s List',
    poster_path: '/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg',
    backdrop_path: '/loRmRzQXZeqG78TqZuyvSlEQfZb.jpg',
    release_date: '1993-12-15',
    primary_color: '#1a1a1a',
  }),
  createMovie({
    id: 6,
    tmdb_id: 78,
    title: 'Blade Runner',
    poster_path: '/63N9uy8nd9j7Eog2axPQ8lbr3Wj.jpg',
    backdrop_path: '/eIi3klFf7mp8oL412Signed5odiI.jpg',
    release_date: '1982-06-25',
    primary_color: '#0a1628',
  }),
];

export const DUMMY_ON_DISPLAY: CollectionItemWithMovie[] = [
  createCollectionItem(DUMMY_MOVIES[0], {
    format: 'VHS',
    is_on_display: true,
    condition: 'Sealed',
  }),
  createCollectionItem(DUMMY_MOVIES[1], {
    format: 'Digital',
    is_on_display: true,
    digital_provider: 'iTunes',
  }),
  createCollectionItem(DUMMY_MOVIES[2], {
    format: '4K',
    is_on_display: true,
    condition: 'Like New',
  }),
];

// Stacks: Group by movie. Multiple formats = stack. Highest quality on top.
export const DUMMY_STACKS: CollectionItemWithMovie[][] = [
  [
    createCollectionItem(DUMMY_MOVIES[0], { format: '4K' }),
    createCollectionItem(DUMMY_MOVIES[0], { format: 'VHS' }),
  ],
  [createCollectionItem(DUMMY_MOVIES[3], { format: 'BluRay' })],
  [
    createCollectionItem(DUMMY_MOVIES[4], { format: 'DVD' }),
    createCollectionItem(DUMMY_MOVIES[4], { format: 'Digital', digital_provider: 'Plex' }),
  ],
  [createCollectionItem(DUMMY_MOVIES[5], { format: 'VHS', is_grail: true })],
  [createCollectionItem(DUMMY_MOVIES[1], { format: 'DVD' })],
  [createCollectionItem(DUMMY_MOVIES[2], { format: 'BluRay' })],
];

// Thrift Mode: wishlist items (ghost cards, grails)
export const DUMMY_WISHLIST_ON_DISPLAY: CollectionItemWithMovie[] = [
  createCollectionItem(DUMMY_MOVIES[1], {
    format: 'VHS',
    status: 'wishlist',
    is_on_display: true,
  }),
  createCollectionItem(DUMMY_MOVIES[4], {
    format: '4K',
    status: 'wishlist',
    is_on_display: true,
  }),
];

export const DUMMY_WISHLIST_STACKS: CollectionItemWithMovie[][] = [
  [createCollectionItem(DUMMY_MOVIES[5], { format: 'VHS', status: 'wishlist', is_grail: true })],
  [createCollectionItem(DUMMY_MOVIES[3], { format: 'BluRay', status: 'wishlist' })],
  [createCollectionItem(DUMMY_MOVIES[1], { format: 'DVD', status: 'wishlist' })],
];
