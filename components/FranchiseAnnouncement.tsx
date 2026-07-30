import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const ANNOUNCEMENT_KEY = 'has_seen_franchise_announcement_v1';

export function FranchiseAnnouncement() {
    const { authPhase, showCaptcha } = useAuth();
    const [visible, setVisible] = useState(false);
    const { playSound } = useSound();

    useEffect(() => {
        checkAnnouncementStatus();
    }, [authPhase]);

    const checkAnnouncementStatus = async () => {
        try {
            const hasSeen = await AsyncStorage.getItem(ANNOUNCEMENT_KEY);
            if (hasSeen !== 'true') {
                setVisible(true);
            }
        } catch (e) {
            console.error('Failed to check franchise announcement status', e);
        }
    };

    const dismissAnnouncement = async () => {
        try {
            await AsyncStorage.setItem(ANNOUNCEMENT_KEY, 'true');
            setVisible(false);
            playSound('insert');
        } catch (e) {
            console.error('Failed to save franchise announcement status', e);
        }
    };

    const isReady = authPhase === 'READY' || authPhase === 'TIMEOUT_RECOVERY';
    if (!visible || !isReady || showCaptcha) return null;

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View className="flex-1 bg-black/95 p-6 sm:p-12 items-center justify-center">
                <Animated.View 
                    entering={FadeIn.duration(400)}
                    exiting={FadeOut.duration(300)}
                    className="w-full bg-neutral-900 border-2 border-amber-500/50 rounded-2xl shadow-2xl overflow-hidden flex-shrink"
                    style={{ maxWidth: 500, maxHeight: '80%' }}
                >
                    <ScrollView className="p-6 sm:p-8" bounces={false}>
                        <View className="items-center mb-6">
                            <View className="bg-neutral-800 border-2 border-amber-500 rounded-full p-4 mb-4">
                                <Ionicons name="layers-outline" size={32} color="#f59e0b" />
                            </View>
                            <Text 
                                className="text-xl font-bold text-white tracking-widest text-center uppercase"
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                NEW FEATURE: FRANCHISE GROUPING
                            </Text>
                            <View className="h-px w-16 bg-amber-500/50 mt-4" />
                        </View>

                        <Text className="text-neutral-300 font-mono text-center leading-6 mb-8 text-sm">
                            Keep movie series and sequel collections grouped together, stopping them from getting split up when sorting alphabetically!
                        </Text>

                        <View className="gap-y-6 mb-8">
                            <View className="flex-row items-start">
                                <View className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/30 items-center justify-center mr-3 mt-0.5">
                                    <Ionicons name="create-outline" size={16} color="#f59e0b" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-amber-500 font-mono font-bold text-sm tracking-wider uppercase mb-1">
                                        1. Tag Your Items
                                    </Text>
                                    <Text className="text-neutral-400 font-mono text-xs leading-5">
                                        Open any film or show format details and type in a Franchise name (e.g. "Terminator") and an Order number (e.g. 1, 2, 3).
                                    </Text>
                                </View>
                            </View>

                            <View className="flex-row items-start">
                                <View className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/30 items-center justify-center mr-3 mt-0.5">
                                    <Ionicons name="swap-vertical-outline" size={16} color="#f59e0b" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-amber-500 font-mono font-bold text-sm tracking-wider uppercase mb-1">
                                        2. Toggle Grouping
                                    </Text>
                                    <Text className="text-neutral-400 font-mono text-xs leading-5">
                                        When sorting your library by NAME, click the new "FRANCHISE" button to switch between grouped order and strict alphabetical order.
                                    </Text>
                                </View>
                            </View>

                            <View className="flex-row items-start">
                                <View className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/30 items-center justify-center mr-3 mt-0.5">
                                    <Ionicons name="search-outline" size={16} color="#f59e0b" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-amber-500 font-mono font-bold text-sm tracking-wider uppercase mb-1">
                                        3. Franchise Search
                                    </Text>
                                    <Text className="text-neutral-400 font-mono text-xs leading-5">
                                        Search for your franchise names in the main search bar to quickly pull up the entire collection series.
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    <View className="p-6 border-t border-neutral-800 bg-neutral-900 items-center">
                        <Pressable 
                            onPress={dismissAnnouncement}
                            className="bg-amber-500 px-12 py-3.5 rounded-lg border-b-4 border-r-4 border-amber-700 active:border-b-0 active:border-r-0 active:mt-1 active:ml-1 w-full max-w-[280px]"
                        >
                            <Text className="text-black font-mono font-bold tracking-widest text-center text-md uppercase">
                                START GROUPING
                            </Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}
