import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const TOUR_KEY = 'has_seen_tour_v1';
const { width, height } = Dimensions.get('window');

interface TourStep {
    title: string;
    text: string;
    icon: keyof typeof Ionicons.prototype.name;
    target?: { x: number; y: number; w: number; h: number };
    action?: () => void;
}

export function AppTour() {
    const { authPhase, showCaptcha } = useAuth();
    const [visible, setVisible] = useState(false);
    const [step, setStep] = useState(0);
    const { playSound } = useSound();
    const { thriftMode, setThriftMode } = useThriftMode();
    const isDesktop = Platform.OS === 'web' && width > 1024;

    useEffect(() => {
        checkTourStatus();
    }, []);

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

    const handleNext = () => {
        playSound('click');
        if (step < steps.length - 1) {
            if (steps[step + 1].action) {
                steps[step + 1].action!();
            }
            setStep(step + 1);
        } else {
            finishTour();
        }
    };

    const finishTour = async () => {
        try {
            await AsyncStorage.setItem(TOUR_KEY, 'true');
            setVisible(false);
            playSound('insert');
            setThriftMode(false); // Reset just in case
        } catch (e) {
            console.error('Failed to save tour status', e);
        }
    };

    const steps: TourStep[] = [
        {
            title: "WELCOME TO TRACKING",
            icon: "film-outline",
            text: "Your personal archive for physical and digital media.\n\nLet's take a quick tour of your new video store.",
        },
        {
            title: "ON DISPLAY",
            icon: "star-outline",
            text: "This horizontal shelf is for your favorites.\n\nDouble-tap any card in the grid below to put it 'On Display' here.",
            target: isDesktop ? { x: 32, y: 220, w: width - 64, h: 280 } : { x: 0, y: 180, w: width, h: 260 },
        },
        {
            title: "THE STACKS",
            icon: "library-outline",
            text: "This is your main collection. All your owned movies and shows live here.\n\nTap to view details, or long-press for quick actions.",
            target: isDesktop ? { x: 32, y: 520, w: width - 64, h: 400 } : { x: 16, y: 460, w: width - 32, h: 500 },
        },
        {
            title: "THRIFT MODE",
            icon: "search-outline",
            text: "Hunting for new tapes? Toggle Thrift Mode to switch the app into 'Hunt' mode.",
            target: isDesktop ? { x: width - 280, y: 20, w: 250, h: 60 } : { x: width - 160, y: 40, w: 150, h: 60 },
            action: () => setThriftMode(true)
        },
        {
            title: "GRAILS & WISH LIST",
            icon: "trophy-outline",
            text: "In Thrift Mode, the shelf becomes your GRAILS (rare finds) and the grid becomes your WISH LIST.",
            target: isDesktop ? { x: 32, y: 220, w: width - 64, h: 700 } : { x: 0, y: 180, w: width, h: 800 },
        },
        {
            title: "ADD TO COLLECTION",
            icon: "add-circle-outline",
            text: "Found something new? Tap the + button to search our massive database and add it to your Stacks.",
            target: isDesktop ? { x: width - 350, y: 20, w: 60, h: 60 } : { x: width - 350, y: 40, w: 60, h: 60 },
            action: () => setThriftMode(false)
        },
        {
            title: "YOU'RE READY",
            icon: "checkmark-circle-outline",
            text: "Happy tracking! Enjoy the tactile feel of your digital archive.",
        }
    ];

    const currentStep = steps[step];

    const spotlightStyle = useAnimatedStyle(() => {
        if (!currentStep.target) return { opacity: 0 };
        return {
            opacity: withTiming(1),
            left: withTiming(currentStep.target.x),
            top: withTiming(currentStep.target.y),
            width: withTiming(currentStep.target.w),
            height: withTiming(currentStep.target.h),
        };
    });

    const isReady = authPhase === 'READY' || authPhase === 'TIMEOUT_RECOVERY';
    if (!visible || !isReady || showCaptcha) return null;

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View className="flex-1">
                {/* Backdrop with Hole */}
                <View style={StyleSheet.absoluteFill}>
                    <BlurView intensity={10} style={StyleSheet.absoluteFill} tint="dark" />
                    <View className="absolute inset-0 bg-black/70" />
                    
                    {/* Spotlight hole - using a simple layout for now */}
                    {currentStep.target && (
                        <Animated.View 
                            style={[
                                spotlightStyle,
                                {
                                    position: 'absolute',
                                    borderRadius: 16,
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    borderWidth: 2,
                                    borderColor: '#f59e0b',
                                    borderStyle: 'dashed'
                                }
                            ]}
                        />
                    )}
                </View>

                {/* Content Overlay */}
                <View className="flex-1 items-center justify-end pb-20 px-8 pointer-events-none">
                    <Animated.View 
                        key={step}
                        entering={FadeIn.duration(400)}
                        exiting={FadeOut.duration(300)}
                        className="w-full bg-neutral-900 border-2 border-amber-500/50 rounded-2xl p-6 shadow-2xl items-center pointer-events-auto"
                        style={{ maxWidth: 500 }}
                    >
                        <View className="absolute -top-10 bg-neutral-900 border-2 border-amber-500 rounded-full p-4">
                            <Ionicons name={currentStep.icon as any} size={32} color="#f59e0b" />
                        </View>

                        <Text className="text-xl font-mono font-bold text-white mt-6 mb-4 tracking-widest text-center uppercase">
                            {currentStep.title}
                        </Text>

                        <View className="h-px w-12 bg-amber-500/30 mb-4" />

                        <Text className="text-neutral-300 font-mono text-center leading-6 mb-8 text-sm">
                            {currentStep.text}
                        </Text>

                        <View className="flex-row items-center justify-between w-full">
                            <Pressable onPress={finishTour} className="px-4 py-2">
                                <Text className="text-neutral-600 font-mono text-xs uppercase tracking-widest">Skip</Text>
                            </Pressable>

                            <Pressable 
                                onPress={handleNext}
                                className="bg-amber-500 px-8 py-3 rounded-lg border-b-4 border-r-4 border-amber-700 active:border-b-0 active:border-r-0 active:mt-1 active:ml-1"
                            >
                                <Text className="text-black font-mono font-bold tracking-widest">
                                    {step === steps.length - 1 ? "FINISH" : "NEXT >>"}
                                </Text>
                            </Pressable>
                        </View>
                    </Animated.View>
                </View>

                {/* Static Noise Overlay */}
                <Image
                    source={require('@/assets/images/static_noise.png')}
                    style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.03 }}
                    pointerEvents="none"
                    contentFit="cover"
                />
            </View>
        </Modal>
    );
}
