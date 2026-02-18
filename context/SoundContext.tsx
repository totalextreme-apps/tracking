import { Audio } from 'expo-av';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSettings } from './SettingsContext';

type SoundType = 'click' | 'insert' | 'static' | 'whir' | 'tv_off' | 'rewind' | 'eject';

type SoundContextType = {
    playSound: (type: SoundType) => Promise<void>;
    stopSound: (type: SoundType) => Promise<void>;
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
        eject: null,
    });
    // Track active web audio objects to allow stopping them
    const activeWebSounds = React.useRef<Record<string, HTMLAudioElement>>({});
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

            const clickSound = await load(require('@/assets/sounds/ui_click.mp3'));
            const insertSound = await load(require('@/assets/sounds/vhs_insert.mp3'));
            const staticSound = await load(require('@/assets/sounds/static_noise.mp3'));
            // const whirSound = await load(require('@/assets/sounds/mechanical_whir.mp3'));

            const tvOffSound = await load(require('@/assets/sounds/tv_off.mp3'));
            const rewindSound = await load(require('@/assets/sounds/rewind.mp3'));
            const ejectSound = await load(require('@/assets/sounds/vcr_eject.mp3'));

            setSounds({
                click: clickSound,
                insert: insertSound,
                static: staticSound,
                whir: null,
                tv_off: tvOffSound,
                rewind: rewindSound,
                eject: ejectSound,
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
        // Clear web sounds
        activeWebSounds.current = {};
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
                    eject: require('@/assets/sounds/vcr_eject.mp3'),
                };

                const source = paths[type];
                if (source) {
                    const audio = new (window as any).Audio(source);
                    // Store reference to allow stopping
                    activeWebSounds.current[type] = audio;
                    audio.onended = () => {
                        delete activeWebSounds.current[type];
                    };
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

    const stopSound = async (type: SoundType) => {
        // Stop web audio
        if (typeof window !== 'undefined' && activeWebSounds.current[type]) {
            const audio = activeWebSounds.current[type];
            audio.pause();
            audio.currentTime = 0;
            delete activeWebSounds.current[type];
        }

        // Stop native audio
        const sound = sounds[type];
        if (sound) {
            try {
                await sound.stopAsync();
            } catch (e) {
                console.log('Error stopping sound', e);
            }
        }
    };

    return (
        <SoundContext.Provider value={{
            playSound,
            stopSound,
            isMuted: !soundEnabled,
            setIsMuted: () => { }
        }}>
            {children}
        </SoundContext.Provider>
    );
}
