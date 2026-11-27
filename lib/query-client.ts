import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import type { CollectionItemWithMedia, Movie, Show } from '@/types/database';

export const CACHE_SCHEMA_VERSION = 'v2.2-idb-sync';
export const PERSIST_STORAGE_KEY_PREFIX = 'REACT_QUERY_OFFLINE_CACHE';
const SYNC_FINGERPRINT_KEY_PREFIX = 'COLLECTION_SYNC_FP';
const IDB_DB_NAME = 'mediatracking_cache_v1';
const IDB_STORE_NAME = 'kv';

let activeCacheUserId: string | undefined = undefined;

/**
 * Canonical stale times across the application to prevent redundant PostgREST egress.
 */
export const STALE_TIMES = {
    COLLECTION: 1000 * 60 * 15,      // 15 minutes (mutations update cache directly; sync fingerprint avoids full re-downloads)
    PROFILE: 1000 * 60 * 5,          // 5 minutes
    MEDIA_DETAIL: 1000 * 60 * 30,    // 30 minutes for movie/show metadata & cast
    SOCIAL_FEED: 1000 * 60 * 2,      // 2 minutes for bulletin & community feeds
    NOTIFICATIONS: 1000 * 60,        // 1 minute for alerts
    STATS: 1000 * 60 * 10,           // 10 minutes for collection & platform stats
    DIRECTORY: 1000 * 60 * 5,        // 5 minutes for member directory & follows
} as const;

/**
 * Canonical Query Keys for deterministic caching and targeted invalidation.
 */
export const QUERY_KEYS = {
    collection: (userId?: string) => ['collection', userId] as const,
    collectionStats: (userId?: string) => ['collection-stats', userId] as const,
    profile: (userId?: string | null) => ['profile', userId] as const,
    movieDetail: (movieId?: number | null) => ['movies-db-detail', movieId] as const,
    showDetail: (showId?: number | null) => ['shows-db-detail', showId] as const,
    movieCast: (movieId?: number | null) => ['movie-cast', movieId] as const,
    showCast: (showId?: number | null) => ['show-cast', showId] as const,
} as const;

/**
 * Shared in-memory normalized media dictionary so multiple editions/seasons
 * of the same movie or TV show share a single metadata object reference in memory,
 * and detail screens can immediately reuse cached media without re-querying.
 */
const sharedMovieCache = new Map<number, Movie>();
const sharedShowCache = new Map<number, Show>();
const collectionSyncTimestamps = new Map<string, string>();

export function getCachedMovie(id: number | null | undefined): Movie | undefined {
    if (!id) return undefined;
    return sharedMovieCache.get(Number(id));
}

export function setCachedMovie(movie: Movie | null | undefined): Movie | null {
    if (!movie || !movie.id) return null;
    const id = Number(movie.id);
    const existing = sharedMovieCache.get(id);
    const merged = existing
        ? {
              ...existing,
              ...movie,
              // Preserve lazy-loaded cast if the incoming summary omitted it
              movie_cast: (movie as any).movie_cast ?? (existing as any).movie_cast ?? existing.cast ?? null,
              cast: movie.cast ?? (movie as any).movie_cast ?? existing.cast ?? null,
          }
        : movie;
    sharedMovieCache.set(id, merged);
    return merged;
}

export function getCachedShow(id: number | null | undefined): Show | undefined {
    if (!id) return undefined;
    return sharedShowCache.get(Number(id));
}

export function setCachedShow(show: Show | null | undefined): Show | null {
    if (!show || !show.id) return null;
    const id = Number(show.id);
    const existing = sharedShowCache.get(id);
    const merged = existing
        ? {
              ...existing,
              ...show,
              show_cast: show.show_cast ?? existing.show_cast ?? null,
          }
        : show;
    sharedShowCache.set(id, merged);
    return merged;
}

export function getCollectionLastSyncedAt(userId: string): string | undefined {
    return collectionSyncTimestamps.get(userId);
}

export function setCollectionLastSyncedAt(userId: string, isoTimestamp: string): void {
    collectionSyncTimestamps.set(userId, isoTimestamp);
}

/**
 * Controlled retry policy: only retry transient network/5xx failures,
 * never retry PostgREST constraint/RLS/4xx errors.
 */
function shouldRetryQuery(failureCount: number, error: any): boolean {
    if (failureCount >= 2) return false;
    const code = String(error?.code || error?.status || '');
    if (
        code.startsWith('PGRST') ||
        code.startsWith('23') ||
        code.startsWith('42') ||
        code === '401' ||
        code === '403' ||
        code === '404'
    ) {
        return false;
    }
    return true;
}

// 1. Create a configured QueryClient with bandwidth-efficient defaults
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: STALE_TIMES.COLLECTION,
            gcTime: 1000 * 60 * 60 * 24 * 7, // Keep cached data for 7 days across sessions
            retry: shouldRetryQuery,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
        },
    },
});

// Zero-dependency IndexedDB key-value wrapper for Web (async, non-blocking, supports 20,000+ item collections)
let idbPromise: Promise<IDBDatabase | null> | null = null;

function openWebCacheDB(): Promise<IDBDatabase | null> {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
        return Promise.resolve(null);
    }
    if (!idbPromise) {
        idbPromise = new Promise((resolve) => {
            try {
                const request = window.indexedDB.open(IDB_DB_NAME, 1);
                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
                        db.createObjectStore(IDB_STORE_NAME);
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }
    return idbPromise;
}

async function rawStorageGet(fullKey: string): Promise<string | null> {
    if (Platform.OS === 'web') {
        const db = await openWebCacheDB();
        if (db) {
            return new Promise((resolve) => {
                try {
                    const tx = db.transaction(IDB_STORE_NAME, 'readonly');
                    const req = tx.objectStore(IDB_STORE_NAME).get(fullKey);
                    req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
                    req.onerror = () => resolve(null);
                } catch {
                    resolve(null);
                }
            });
        }
    }
    try {
        return await AsyncStorage.getItem(fullKey);
    } catch {
        return null;
    }
}

async function rawStorageSet(fullKey: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
        const db = await openWebCacheDB();
        if (db) {
            return new Promise((resolve) => {
                try {
                    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
                    tx.objectStore(IDB_STORE_NAME).put(value, fullKey);
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => resolve();
                } catch {
                    resolve();
                }
            });
        }
        // Fallback to localStorage only if payload fits safely under the 5MB cap
        if (value.length > 4_200_000) return;
    }
    try {
        await AsyncStorage.setItem(fullKey, value);
    } catch {
        // Silently skip persistence if storage quota is reached
    }
}

async function rawStorageRemove(fullKey: string): Promise<void> {
    if (Platform.OS === 'web') {
        const db = await openWebCacheDB();
        if (db) {
            await new Promise<void>((resolve) => {
                try {
                    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
                    tx.objectStore(IDB_STORE_NAME).delete(fullKey);
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => resolve();
                } catch {
                    resolve();
                }
            });
        }
    }
    try {
        await AsyncStorage.removeItem(fullKey);
    } catch {
        // ignore
    }
}

// Sync fingerprint helpers for zero-egress returning sessions
const memorySyncFingerprints = new Map<string, string>();

export async function getStoredSyncFingerprint(userId: string): Promise<string | null> {
    const mem = memorySyncFingerprints.get(userId);
    if (mem) return mem;
    const stored = await rawStorageGet(`${SYNC_FINGERPRINT_KEY_PREFIX}:${userId}`);
    if (stored) memorySyncFingerprints.set(userId, stored);
    return stored;
}

export async function setStoredSyncFingerprint(userId: string, fingerprintJson: string): Promise<void> {
    memorySyncFingerprints.set(userId, fingerprintJson);
    await rawStorageSet(`${SYNC_FINGERPRINT_KEY_PREFIX}:${userId}`, fingerprintJson);
}

export async function clearStoredSyncFingerprint(userId: string): Promise<void> {
    memorySyncFingerprints.delete(userId);
    await rawStorageRemove(`${SYNC_FINGERPRINT_KEY_PREFIX}:${userId}`);
}

// User-scoped storage adapter using IndexedDB on Web and AsyncStorage on Native
const SafeUserScopedStorage = {
    getItem: async (key: string): Promise<string | null> => {
        if (typeof window === 'undefined' && Platform.OS === 'web') return null;
        const scopedKey = activeCacheUserId ? `${key}:${activeCacheUserId}` : key;
        return rawStorageGet(scopedKey);
    },
    setItem: async (key: string, value: string): Promise<void> => {
        if (typeof window === 'undefined' && Platform.OS === 'web') return;
        const scopedKey = activeCacheUserId ? `${key}:${activeCacheUserId}` : key;
        await rawStorageSet(scopedKey, value);
    },
    removeItem: async (key: string): Promise<void> => {
        if (typeof window === 'undefined' && Platform.OS === 'web') return;
        const scopedKey = activeCacheUserId ? `${key}:${activeCacheUserId}` : key;
        await rawStorageRemove(scopedKey);
    },
};

// 2. Create an AsyncStorage/IndexedDB Persister
export const asyncStoragePersister = createAsyncStoragePersister({
    storage: SafeUserScopedStorage,
    key: PERSIST_STORAGE_KEY_PREFIX,
    throttleTime: 2500, // Throttle disk writes to once every 2.5s
});

// 3. Configuration for the Provider
export const persistOptions = {
    persister: asyncStoragePersister,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    buster: CACHE_SCHEMA_VERSION,
    dehydrateOptions: {
        shouldDehydrateQuery: (query: any) => {
            if (query.state.status !== 'success') return false;
            const rootKey = query.queryKey?.[0];
            // Only persist the active user's own collection and profile — never persist other users' collections or volatile chat/polling queries
            if (rootKey === 'collection') {
                const queryUserId = query.queryKey?.[1];
                if (!activeCacheUserId || queryUserId !== activeCacheUserId) return false;
                const data = query.state.data;
                // IndexedDB easily supports up to 25,000 slim collection entries
                if (Array.isArray(data) && data.length > 25000) return false;
                return true;
            }
            return rootKey === 'profile' || rootKey === 'collection-stats' || rootKey === 'app_wide_stats';
        },
    },
};

/**
 * Switches or clears the active user's cache scope.
 * Purges in-memory queries and persisted storage on logout or account switch so private data never leaks.
 */
export async function setCacheUserScope(newUserId: string | undefined): Promise<void> {
    const previousUserId = activeCacheUserId;
    if (previousUserId && previousUserId !== newUserId) {
        // User logged out or switched accounts -> purge all private in-memory and persisted caches
        queryClient.clear();
        collectionSyncTimestamps.clear();
        memorySyncFingerprints.delete(previousUserId);
        await Promise.all([
            rawStorageRemove(`${PERSIST_STORAGE_KEY_PREFIX}:${previousUserId}`),
            rawStorageRemove(PERSIST_STORAGE_KEY_PREFIX),
            rawStorageRemove(`${SYNC_FINGERPRINT_KEY_PREFIX}:${previousUserId}`),
        ]);
    }
    activeCacheUserId = newUserId;
}

export async function clearAllUserCaches(): Promise<void> {
    const prev = activeCacheUserId;
    activeCacheUserId = undefined;
    queryClient.clear();
    collectionSyncTimestamps.clear();
    memorySyncFingerprints.clear();
    const tasks: Promise<void>[] = [rawStorageRemove(PERSIST_STORAGE_KEY_PREFIX)];
    if (prev) {
        tasks.push(rawStorageRemove(`${PERSIST_STORAGE_KEY_PREFIX}:${prev}`));
        tasks.push(rawStorageRemove(`${SYNC_FINGERPRINT_KEY_PREFIX}:${prev}`));
    }
    await Promise.all(tasks);
}

let collectionMutationListener: ((userId: string) => void) | null = null;

export function registerCollectionMutationListener(listener: (userId: string) => void): void {
    collectionMutationListener = listener;
}

/**
 * Targeted cache helpers for collection mutations so single/batch edits never require a full collection re-download.
 */
export function updateCollectionCacheItems(
    userId: string | undefined,
    updater: (items: CollectionItemWithMedia[]) => CollectionItemWithMedia[]
): void {
    if (!userId) return;
    queryClient.setQueryData<CollectionItemWithMedia[]>(QUERY_KEYS.collection(userId), (old) => {
        if (!Array.isArray(old)) return old;
        return updater(old);
    });
    if (collectionMutationListener) {
        collectionMutationListener(userId);
    }
}

