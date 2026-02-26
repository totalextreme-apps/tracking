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
): [T, (value: T) => void] {
    const [value, setValueRaw] = useState<T>(defaultValue);
    const hydrated = useRef(false);

    // Read persisted value on mount
    useEffect(() => {
        AsyncStorage.getItem(storageKey)
            .then((stored) => {
                if (stored !== null) {
                    try {
                        setValueRaw(JSON.parse(stored) as T);
                    } catch {
                        // Ignore parse errors — fall back to default
                    }
                }
            })
            .catch(() => { /* ignore read errors */ })
            .finally(() => {
                hydrated.current = true;
            });
    }, [storageKey]);

    const setValue = (newValue: T) => {
        setValueRaw(newValue);
        AsyncStorage.setItem(storageKey, JSON.stringify(newValue)).catch(() => { });
    };

    return [value, setValue];
}
