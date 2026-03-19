import { createAudioPlayer } from 'expo-audio';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSettings } from './SettingsContext';

type SoundType = 'click' | 'insert' | 'static' | 'whir' | 'tv_off' | 'rewind' | 'eject' | 'peel';

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
    const [players, setPlayers] = useState<Record<SoundType, any>>({
        click: null,
        insert: null,
        static: null,
        whir: null,
        tv_off: null,
        rewind: null,
        eject: null,
        peel: null,
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
            const load = (source: any) => {
                try {
                    // In expo-audio, we use createAudioPlayer
                    const player = createAudioPlayer(source);
                    return player;
                } catch (e) {
                    console.log('Failed to create audio player', e);
                    return null;
                }
            };

            const clickPlayer = load(require('@/assets/sounds/ui_click.mp3'));
            const insertPlayer = load(require('@/assets/sounds/vhs_insert.mp3'));
            const staticPlayer = load(require('@/assets/sounds/static_noise.mp3'));
            const tvOffPlayer = load(require('@/assets/sounds/tv_off.mp3'));
            const rewindPlayer = load(require('@/assets/sounds/rewind.mp3'));
            const ejectPlayer = load(require('@/assets/sounds/vcr_eject.mp3'));
            const peelPlayer = load(require('@/assets/sounds/sticker_peel.mp3'));

            setPlayers({
                click: clickPlayer,
                insert: insertPlayer,
                static: staticPlayer,
                whir: null,
                tv_off: tvOffPlayer,
                rewind: rewindPlayer,
                eject: ejectPlayer,
                peel: peelPlayer,
            });

        } catch (e) {
            console.error('Error loading sounds', e);
        }
    };

    const unloadSounds = async () => {
        Object.values(players).forEach((player) => {
            if (player && player.terminate) player.terminate();
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
                    peel: require('@/assets/sounds/sticker_peel.mp3'),
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

        const player = players[type];
        if (player) {
            try {
                // If the player is already playing, seek to start
                if (player.playing) {
                    player.seekTo(0);
                }
                player.play();
            } catch (e) {
                console.log('Error playing sound with expo-audio', e);
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
        const player = players[type];
        if (player) {
            try {
                player.pause();
                player.seekTo(0);
            } catch (e) {
                console.log('Error stopping sound with expo-audio', e);
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
