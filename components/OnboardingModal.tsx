import { useSound } from '@/context/SoundContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const ONBOARDING_KEY = 'has_seen_onboarding_v1';
const { width, height } = Dimensions.get('window');

interface OnboardingModalProps {
    forceShow?: boolean;
    onClose?: () => void;
}

export function OnboardingModal({ forceShow, onClose }: OnboardingModalProps) {
    const [visible, setVisible] = useState(false);
    const [step, setStep] = useState(0);
    const { playSound } = useSound();

    useEffect(() => {
        checkOnboarding();
    }, [forceShow]);

    const checkOnboarding = async () => {
        if (forceShow) {
            setVisible(true);
            setStep(0);
            return;
        }

        try {
            const hasSeen = await AsyncStorage.getItem(ONBOARDING_KEY);
            if (hasSeen !== 'true') {
                setVisible(true);
            }
        } catch (e) {
            console.error('Failed to check onboarding status', e);
        }
    };

    const handleNext = async () => {
        playSound('click');
        if (step < 2) {
            setStep(step + 1);
        } else {
            await finishOnboarding();
        }
    };

    const finishOnboarding = async () => {
        try {
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
            setVisible(false);
            playSound('insert'); // Play insert sound as "starting" the app
            if (onClose) onClose();
        } catch (e) {
            console.error('Failed to save onboarding status', e);
        }
    };

    if (!visible) return null;

    const slides = [
        {
            title: "WELCOME TO THE STACKS",
            icon: "film-outline",
            text: "Your personal archive for physical media.\n\nIn The Stacks, you can track what you own and set On Display selections.\n\nUse Thrift Mode to track what you want and mark your Grail finds.",
            color: "#f59e0b", // Amber
        },
        {
            title: "MASTER THE CONTROLS",
            icon: "finger-print-outline",
            text: "• DOUBLE TAP a card to mark as On Display (in The Stacks) or as a Grail (Thrift Mode).\n• PULL DOWN to REWIND (Refresh)\n• TAP to view movie info and edit items\n• LONG PRESS to mark item as ACQUIRED (Thrift Mode)",
            color: "#22c55e", // Green
        },
        {
            title: "EXPORT YOUR COLLECTION",
            icon: "download-outline",
            text: "The settings menu has options to export your collection as CSV or PDF files.\n\nHappy TRACKING. Enjoy the static!",
            color: "#ef4444", // Red
        }
    ];

    const currentSlide = slides[step];

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View style={StyleSheet.absoluteFill}>
                {/* Background: Dark with Blur */}
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                <View className="absolute inset-0 bg-black/80" />

                {/* Static Noise Overlay (Subtle) */}
                <Image
                    source={require('@/assets/images/static_noise.png')}
                    style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.05 }}
                    contentFit="cover"
                />

                <View className="flex-1 items-center justify-center p-8">
                    {/* TV Frame / Container */}
                    <View className="w-full bg-neutral-900 border-2 border-neutral-700 rounded-3xl p-6 shadow-2xl items-center overflow-hidden">

                        {/* Slide Content */}
                        <Animated.View
                            key={step}
                            entering={FadeIn.duration(300)}
                            exiting={FadeOut.duration(300)}
                            className="items-center w-full"
                        >
                            <View className="w-20 h-20 rounded-full items-center justify-center mb-6 bg-neutral-800 border-2" style={{ borderColor: currentSlide.color }}>
                                <Ionicons name={currentSlide.icon as any} size={40} color={currentSlide.color} />
                            </View>

                            <Text className="text-2xl font-mono font-bold text-center mb-4 tracking-widest text-white">
                                {currentSlide.title}
                            </Text>

                            <View className="h-px w-16 bg-neutral-700 mb-6" />

                            <Text className="text-neutral-300 font-mono text-center leading-6 mb-8 text-sm">
                                {currentSlide.text}
                            </Text>
                        </Animated.View>

                        {/* Pagination Dots */}
                        <View className="flex-row gap-2 mb-8">
                            {slides.map((_, i) => (
                                <View
                                    key={i}
                                    className={`w-2 h-2 rounded-full ${i === step ? 'bg-amber-500' : 'bg-neutral-700'}`}
                                />
                            ))}
                        </View>

                        {/* VCR Controls */}
                        <Pressable
                            onPress={handleNext}
                            className="w-full bg-neutral-800 border-b-4 border-r-4 border-neutral-950 p-4 rounded-xl items-center active:border-b-0 active:border-r-0 active:mt-1 active:ml-1"
                            style={{ backgroundColor: currentSlide.color }}
                        >
                            <Text className="text-black font-mono font-bold text-lg tracking-widest">
                                {step === 2 ? "EJECT TAPE (START)" : "NEXT >>"}
                            </Text>
                        </Pressable>

                    </View>
                </View>
            </View>
        </Modal>
    );
}
