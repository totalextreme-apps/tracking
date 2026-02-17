import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type SettingsContextType = {
    soundEnabled: boolean;
    setSoundEnabled: (enabled: boolean) => void;
    staticEnabled: boolean;
    setStaticEnabled: (enabled: boolean) => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}

const SOUND_KEY = 'settings_sound_enabled';
const STATIC_KEY = 'settings_static_enabled';

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [soundEnabled, setSoundEnabledState] = useState(true);
    const [staticEnabled, setStaticEnabledState] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const sound = await AsyncStorage.getItem(SOUND_KEY);
            const staticEffect = await AsyncStorage.getItem(STATIC_KEY);

            if (sound !== null) setSoundEnabledState(sound === 'true');
            if (staticEffect !== null) setStaticEnabledState(staticEffect === 'true');
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    };

    const setSoundEnabled = async (enabled: boolean) => {
        setSoundEnabledState(enabled);
        await AsyncStorage.setItem(SOUND_KEY, String(enabled));
    };

    const setStaticEnabled = async (enabled: boolean) => {
        setStaticEnabledState(enabled);
        await AsyncStorage.setItem(STATIC_KEY, String(enabled));
    };

    return (
        <SettingsContext.Provider value={{ soundEnabled, setSoundEnabled, staticEnabled, setStaticEnabled }}>
            {children}
        </SettingsContext.Provider>
    );
}
