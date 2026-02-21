import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import type { Database } from '@/types/database';

import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Custom storage adapter for Web SSR / Native
const ExpoStorage = {
    getItem: (key: string) => {
        if (typeof window === 'undefined') return Promise.resolve(null);
        return AsyncStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
        if (typeof window === 'undefined') return Promise.resolve();
        return AsyncStorage.setItem(key, value);
    },
    removeItem: (key: string) => {
        if (typeof window === 'undefined') return Promise.resolve();
        return AsyncStorage.removeItem(key);
    },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Update auth polling for React Native - Only if AppState is available (Native)
if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
        if (state === 'active') {
            supabase.auth.startAutoRefresh();
        } else {
            supabase.auth.stopAutoRefresh();
        }
    });
}
