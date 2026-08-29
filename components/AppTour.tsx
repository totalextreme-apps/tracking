import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useSound } from '@/context/SoundContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const TOUR_KEY = 'has_seen_tour_v2';

export function AppTour() {
    const { authPhase, showCaptcha } = useAuth();
    const { onboardingKey } = useSettings();
    const [visible, setVisible] = useState(false);
    const { playSound } = useSound();

    useEffect(() => {
        checkTourStatus();
    }, [onboardingKey]);

    const checkTourStatus = async () => {
        try {
            const hasSeen = await AsyncStorage.getItem(TOUR_KEY);
            if (hasSeen !== 'true') {
                setVisible(true);
            }
        } catch (e) {
            console.error('Failed to check tour status', e);
        }
    };

    const finishTour = async () => {
        try {
            await Promise.all([
                AsyncStorage.setItem(TOUR_KEY, 'true'),
                AsyncStorage.setItem('has_seen_franchise_announcement_v1', 'true')
            ]);
            setVisible(false);
            playSound('insert');
        } catch (e) {
            console.error('Failed to save tour status', e);
        }
    };

    const isReady = authPhase === 'READY' || authPhase === 'TIMEOUT_RECOVERY';
    if (!visible || !isReady || showCaptcha) return null;

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View className="flex-1 bg-black/90 p-6 sm:p-12 items-center justify-center">
                <Animated.View 
                    entering={FadeIn.duration(400)}
                    exiting={FadeOut.duration(300)}
                    className="w-full bg-neutral-900 border-2 border-amber-500/50 rounded-2xl shadow-2xl overflow-hidden flex-shrink"
                    style={{ maxWidth: 500, maxHeight: '80%' }}
                >
                    <ScrollView className="p-6 sm:p-8" bounces={false}>
                        <View className="items-center mb-6">
                            <View className="bg-neutral-800 border-2 border-amber-500 rounded-full p-4 mb-4">
                                <Ionicons name="film-outline" size={32} color="#f59e0b" />
                            </View>
                            <Text className="text-xl font-mono font-bold text-white tracking-widest text-center uppercase">
                                Welcome to Tracking
                            </Text>
                            <View className="h-px w-16 bg-amber-500/50 mt-3" />
                        </View>

                        <Text className="text-neutral-300 font-mono text-center leading-6 mb-8 text-xs">
                            Your tactile film and TV archivist. Keep track of your physical formats, hunt for grails, and curate your personal shelves.
                        </Text>

                        <View className="gap-y-6 mb-6">
                            {/* Area 1: Catalog & Display */}
                            <View className="flex-row items-start">
                                <View className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/30 items-center justify-center mr-3 mt-0.5">
                                    <Ionicons name="library-outline" size={18} color="#f59e0b" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-amber-500 font-mono font-bold text-sm tracking-wider uppercase mb-1">
                                        Catalog & Display
                                    </Text>
                                    <Text className="text-neutral-400 font-mono text-xs leading-5">
                                        Catalog your formats (VHS, DVD, BluRay, 4K). Tap any title in **The Stacks** to manage details, or double-tap to place your favorites **On Display** on the top shelf.
                                    </Text>
                                </View>
                            </View>

                            {/* Area 2: Thrift Mode & Grails */}
                            <View className="flex-row items-start">
                                <View className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/30 items-center justify-center mr-3 mt-0.5">
                                    <Ionicons name="search-outline" size={18} color="#f59e0b" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-amber-500 font-mono font-bold text-sm tracking-wider uppercase mb-1">
                                        Thrift Hunting
                                    </Text>
                                    <Text className="text-neutral-400 font-mono text-xs leading-5">
                                        Toggle **Thrift Mode** in the top right when hunting in the wild. Your main library turns into your **Wish List**, and the top shelf showcases your rarest hunted **Grails**.
                                    </Text>
                                </View>
                            </View>

                            {/* Area 3: Curations & Series */}
                            <View className="flex-row items-start">
                                <View className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/30 items-center justify-center mr-3 mt-0.5">
                                    <Ionicons name="albums-outline" size={18} color="#f59e0b" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-amber-500 font-mono font-bold text-sm tracking-wider uppercase mb-1">
                                        Mixtapes & Franchises
                                    </Text>
                                    <Text className="text-neutral-400 font-mono text-xs leading-5">
                                        Build custom **Curated Stacks** (mixtapes of movies/shows), or use **Franchise Grouping** to keep movie sequels and sequel timelines grouped together when sorting.
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    <View className="p-6 border-t border-neutral-800 bg-neutral-900 items-center">
                        <Pressable 
                            onPress={finishTour}
                            className="bg-amber-500 px-12 py-3.5 rounded-lg border-b-4 border-r-4 border-amber-700 active:border-b-0 active:border-r-0 active:mt-1 active:ml-1 w-full max-w-[280px]"
                        >
                            <Text className="text-black font-mono font-bold tracking-widest text-center text-md uppercase">
                                Got It
                            </Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}
