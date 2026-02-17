import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/react-query-persist-client/async-storage-persister';

// 1. Create a configured QueryClient with longer stale times for offline
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is considered fresh for 1 minute
            staleTime: 1000 * 60,
            // Keep unused data in garbage collection for 24 hours (for offline access)
            gcTime: 1000 * 60 * 60 * 24,
            // Retry failed requests automatically
            retry: 2,
        },
    },
});

// 2. Create an AsyncStorage Persister
// This tells TanStack Query HOW to save data (to AsyncStorage)
export const asyncStoragePersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    throttleTime: 1000, // Save at most once per second to avoid perf issues
});

// 3. Configuration for the Provider
export const persistOptions = {
    persister: asyncStoragePersister,
    maxAge: 1000 * 60 * 60 * 24, // Consistently persist data for 24 hours
};
