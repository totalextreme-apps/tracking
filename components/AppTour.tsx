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
            await AsyncStorage.setItem(TOUR_KEY, 'true');
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
                    style={{ maxWidth: 600, maxHeight: '90%' }}
                >
                    <ScrollView className="p-6 sm:p-8" bounces={false}>
                        <View className="items-center mb-8">
                            <View className="bg-neutral-800 border-2 border-amber-500 rounded-full p-4 mb-4">
                                <Ionicons name="film-outline" size={32} color="#f59e0b" />
                            </View>
                            <Text className="text-2xl font-mono font-bold text-white tracking-widest text-center uppercase">
                                Welcome to Tracking
                            </Text>
                            <View className="h-px w-16 bg-amber-500/50 mt-4" />
                        </View>

                        <Text className="text-neutral-300 font-mono text-center leading-6 mb-10 text-sm">
                            Your personal archive for physical and digital media. Here is a quick breakdown to help you get started.
                        </Text>

                        <View className="gap-y-8 mb-8">
                            {/* Feature 1 */}
                            <View>
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="star-outline" size={24} color="#f59e0b" />
                                    <Text className="text-amber-500 font-mono font-bold text-lg ml-3 tracking-widest uppercase">
                                        On Display
                                    </Text>
                                </View>
                                <Text className="text-neutral-400 font-mono text-sm leading-5">
                                    <Text className="text-neutral-200 font-bold">Where:</Text> The horizontal shelf at the top of your screen.{"\n"}
                                    <Text className="text-neutral-200 font-bold">How to use:</Text> This shelf is for your absolute favorites. Double-tap any card in your Stacks to put it 'On Display'.
                                </Text>
                            </View>

                            {/* Feature 2 */}
                            <View>
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="library-outline" size={24} color="#f59e0b" />
                                    <Text className="text-amber-500 font-mono font-bold text-lg ml-3 tracking-widest uppercase">
                                        The Stacks
                                    </Text>
                                </View>
                                <Text className="text-neutral-400 font-mono text-sm leading-5">
                                    <Text className="text-neutral-200 font-bold">Where:</Text> The main grid below the display shelf.{"\n"}
                                    <Text className="text-neutral-200 font-bold">How to use:</Text> Your entire collection lives here. Tap any item to view its details, or long-press for quick actions.
                                </Text>
                            </View>

                            {/* Feature 3: Curated Stacks */}
                            <View>
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="albums-outline" size={24} color="#f59e0b" />
                                    <Text className="text-amber-500 font-mono font-bold text-lg ml-3 tracking-widest uppercase">
                                        Curated Stacks
                                    </Text>
                                </View>
                                <Text className="text-neutral-400 font-mono text-sm leading-5">
                                    <Text className="text-neutral-200 font-bold">Where:</Text> The 'Curated' tab at the bottom of the screen.{"\n"}
                                    <Text className="text-neutral-200 font-bold">How to use:</Text> Build your own mixtapes of movies and shows. Create custom lists like "Tapes for Trade" or "On Deck this Weekend" and add items to them from their details pages.
                                </Text>
                            </View>

                            {/* Feature 4: Thrift Mode & Grails */}
                            <View>
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="search-outline" size={24} color="#f59e0b" />
                                    <Text className="text-amber-500 font-mono font-bold text-lg ml-3 tracking-widest uppercase">
                                        Thrift Mode & Grails
                                    </Text>
                                </View>
                                <Text className="text-neutral-400 font-mono text-sm leading-5">
                                    <Text className="text-neutral-200 font-bold">Where:</Text> The toggle switch in the top right corner.{"\n"}
                                    <Text className="text-neutral-200 font-bold">How to use:</Text> Toggle this on when hunting for tapes in the wild. Your main grid turns into your WISH LIST. The top shelf becomes your GRAILS highlighting your rarest or most prized hunted finds.
                                </Text>
                            </View>

                            {/* Feature 5 */}
                            <View>
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="add-circle-outline" size={24} color="#f59e0b" />
                                    <Text className="text-amber-500 font-mono font-bold text-lg ml-3 tracking-widest uppercase">
                                        Add to Collection
                                    </Text>
                                </View>
                                <Text className="text-neutral-400 font-mono text-sm leading-5">
                                    <Text className="text-neutral-200 font-bold">Where:</Text> The big '+' tab at the bottom.{"\n"}
                                    <Text className="text-neutral-200 font-bold">How to use:</Text> Tap to search our massive database and add new movies and shows directly to your Stacks.
                                </Text>
                            </View>

                            {/* Feature 6: Backup & Export */}
                            <View>
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="download-outline" size={24} color="#f59e0b" />
                                    <Text className="text-amber-500 font-mono font-bold text-lg ml-3 tracking-widest uppercase">
                                        Export & Backup
                                    </Text>
                                </View>
                                <Text className="text-neutral-400 font-mono text-sm leading-5">
                                    <Text className="text-neutral-200 font-bold">Where:</Text> In the 'Settings' tab menu.{"\n"}
                                    <Text className="text-neutral-200 font-bold">How to use:</Text> You can export your entire collection to a CSV spreadsheet, or print out a physical Inventory Receipt as a PDF right from your device.
                                </Text>
                            </View>
                        </View>
                    </ScrollView>

                    <View className="p-6 border-t border-neutral-800 bg-neutral-900 items-center">
                        <Pressable 
                            onPress={finishTour}
                            className="bg-amber-500 px-12 py-4 rounded-lg border-b-4 border-r-4 border-amber-700 active:border-b-0 active:border-r-0 active:mt-1 active:ml-1 w-full max-w-[300px]"
                        >
                            <Text className="text-black font-mono font-bold tracking-widest text-center text-lg uppercase">
                                Got It
                            </Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}
