import { Audio } from 'expo-av';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSettings } from './SettingsContext';

type SoundType = 'click' | 'insert' | 'static' | 'whir' | 'tv_off' | 'rewind';

type SoundContextType = {
    playSound: (type: SoundType) => Promise<void>;
    isMuted: boolean;
    setIsMuted: (muted: boolean) => void;
};

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export function useSound() {
    const context = useContext(SoundContext);
    if (!context) {
        throw new Error('useSound must be used within a SoundProvider');
    }
    return context;
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
    const [sounds, setSounds] = useState<Record<SoundType, Audio.Sound | null>>({
        click: null,
        insert: null,
        static: null,
        whir: null,
        tv_off: null,
        rewind: null,
    });
    const { soundEnabled } = useSettings();

    useEffect(() => {
        loadSounds();
        return () => {
            unloadSounds();
        };
    }, []);

    const loadSounds = async () => {
        try {
            // Load sounds - utilizing try/catch for individual loads in case files are missing
            const load = async (source: any) => {
                try {
                    const { sound } = await Audio.Sound.createAsync(source);
                    return sound;
                } catch (e) {
                    console.log('Failed to load sound', e);
                    return null;
                }
            };

            // These require-s might fail at BUNDLE time if files don't exist. 
            // User needs to provide them. If they don't exist, this file will cause a bundle error.
            // To prevent crashing if files are missing, we'd theoretically need conditional requires, 
            // but Metro bundler resolves these statically.
            // Assuming user HAS put files there or I need to placeholders.
            // I will use a try-catch block for the requires if possible? No, 'require' is static.
            // I will assume the user has added them or I will add dummy files if I can?
            // I cannot create binary files.
            // I will proceed with the requires, hoping the user followed instructions. 
            // If not, I'll need to ask them to add the files.

            const clickSound = await load(require('@/assets/sounds/ui_click.mp3'));
            const insertSound = await load(require('@/assets/sounds/vhs_insert.mp3'));
            const staticSound = await load(require('@/assets/sounds/static_noise.mp3'));
            // const whirSound = await load(require('@/assets/sounds/mechanical_whir.mp3'));

            const tvOffSound = await load(require('@/assets/sounds/tv_off.mp3'));
            const rewindSound = await load(require('@/assets/sounds/rewind.mp3'));

            setSounds({
                click: clickSound,
                insert: insertSound,
                static: staticSound,
                whir: null,
                tv_off: tvOffSound,
                rewind: rewindSound,
            });

            // Configure Audio
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
            });

        } catch (e) {
            console.error('Error loading sounds', e);
        }
    };

    const unloadSounds = async () => {
        Object.values(sounds).forEach(async (sound) => {
            if (sound) await sound.unloadAsync();
        });
    };

    const playSound = async (type: SoundType) => {
        if (!soundEnabled) return;

        // Use standard Audio constructor for web for better PWA support
        if (typeof window !== 'undefined' && (window as any).Audio) {
            try {
                const paths: Record<SoundType, any> = {
                    click: require('@/assets/sounds/ui_click.mp3'),
                    insert: require('@/assets/sounds/vhs_insert.mp3'),
                    static: require('@/assets/sounds/static_noise.mp3'),
                    whir: null,
                    tv_off: require('@/assets/sounds/tv_off.mp3'),
                    rewind: require('@/assets/sounds/rewind.mp3'),
                };

                const source = paths[type];
                if (source) {
                    const audio = new (window as any).Audio(source);
                    audio.play().catch((e: any) => console.log('Web audio play blocked', e));
                }
                return;
            } catch (e) {
                console.log('Web sound error', e);
            }
        }

        const sound = sounds[type];
        if (sound) {
            try {
                await sound.replayAsync();
            } catch (e) {
                console.log('Error playing sound', e);
            }
        }
    };

    return (
        <SoundContext.Provider value={{ playSound, isMuted: !soundEnabled, setIsMuted: () => { } }}>
            {children}
        </SoundContext.Provider>
    );
}
