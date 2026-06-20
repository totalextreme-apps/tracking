import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

/**
 * useState that automatically persists its value to AsyncStorage.
 * On mount it reads the stored value; on every change it writes back.
 * Falls back to `defaultValue` if nothing is stored yet or on read error.
 */
export function usePersistedState<T>(
    storageKey: string,
    defaultValue: T
): [T, (value: T) => void, boolean] {
    const [value, setValueRaw] = useState<T>(defaultValue);
    const [isHydrated, setIsHydrated] = useState(false);
    const hasStoredValue = useRef(false);
    const writeTimeoutRef = useRef<any>(null);

    // Read persisted value on mount
    useEffect(() => {
        AsyncStorage.getItem(storageKey)
            .then((stored) => {
                if (stored !== null) {
                    try {
                        setValueRaw(JSON.parse(stored) as T);
                        hasStoredValue.current = true;
                    } catch {
                        // Ignore parse errors — fall back to default
                    }
                }
            })
            .catch(() => { /* ignore read errors */ })
            .finally(() => {
                setIsHydrated(true);
            });
    }, [storageKey]);

    // Keep value in sync with defaultValue if no stored value exists yet
    useEffect(() => {
        if (!isHydrated || !hasStoredValue.current) {
            setValueRaw(defaultValue);
        }
    }, [defaultValue, isHydrated]);

    // Clean up timeout on unmount
    useEffect(() => {
        return () => {
            if (writeTimeoutRef.current) {
                clearTimeout(writeTimeoutRef.current);
            }
        };
    }, []);

    const setValue = (newValue: T) => {
        setValueRaw(newValue);
        hasStoredValue.current = true;
        
        if (writeTimeoutRef.current) {
            clearTimeout(writeTimeoutRef.current);
        }
        writeTimeoutRef.current = setTimeout(() => {
            AsyncStorage.setItem(storageKey, JSON.stringify(newValue)).catch(() => { });
        }, 150);
    };

    return [value, setValue, isHydrated];
}
