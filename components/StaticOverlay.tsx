import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface StaticOverlayProps {
    visible: boolean;
}

export function StaticOverlay({ visible }: StaticOverlayProps) {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const opacityAnim = useRef(new Animated.Value(0)).current;

    // Jitter animations
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Fade in
            opacityAnim.setValue(0.8);

            // Random flicker loop for opacity
            const flicker = () => {
                Animated.sequence([
                    Animated.timing(opacityAnim, { toValue: Math.random() * 0.4 + 0.4, duration: 50, useNativeDriver: true }),
                    Animated.timing(opacityAnim, { toValue: Math.random() * 0.4 + 0.4, duration: 50, useNativeDriver: true }),
                ]).start(() => {
                    if (visible) flicker();
                });
            };
            flicker();

            // Random Jitter loop for position
            const jitter = () => {
                Animated.parallel([
                    Animated.timing(translateX, { toValue: Math.random() * 20 - 10, duration: 30, useNativeDriver: true }),
                    Animated.timing(translateY, { toValue: Math.random() * 20 - 10, duration: 30, useNativeDriver: true }),
                ]).start(() => {
                    if (visible) jitter();
                });
            };
            jitter();

        } else {
            opacityAnim.setValue(0);
            translateX.setValue(0);
            translateY.setValue(0);
        }
    }, [visible]);

    useEffect(() => {
        let soundObject: Audio.Sound | null = null;

        async function playStatic() {
            if (visible) {
                try {
                    const { sound } = await Audio.Sound.createAsync(
                        require('@/assets/sounds/static_noise.mp3'),
                        { shouldPlay: true, isLooping: true, volume: 0.3 } // Reduced volume
                    );
                    soundObject = sound;
                    setSound(sound);
                } catch (e) {
                    console.error("Failed to load static sound", e);
                }
            } else {
                // Should not happen if unmount cleans up, but for safety
            }
        }

        playStatic();

        return () => {
            if (soundObject) {
                soundObject.stopAsync().then(() => {
                    soundObject?.unloadAsync();
                }).catch((e) => console.log("Error unloading sound", e));
            }
        };
    }, [visible]);

    if (!visible) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" className="z-[9999]">
            {/* Noise Layer with Jitter */}
            <Animated.Image
                source={require('@/assets/images/static_noise.png')}
                style={[
                    StyleSheet.absoluteFill,
                    {
                        opacity: opacityAnim,
                        transform: [{ translateX }, { translateY }],
                        width: '110%',
                        height: '110%',
                        left: '-5%',
                        top: '-5%'
                    }
                ]}
                resizeMode="cover"
            />
            <View className="absolute inset-0 bg-black/20" />
        </View>
    );
}

