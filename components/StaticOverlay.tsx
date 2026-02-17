import { useSound } from '@/context/SoundContext';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface StaticOverlayProps {
    visible: boolean;
}

export function StaticOverlay({ visible }: StaticOverlayProps) {
    const { playSound } = useSound();
    const opacityAnim = useRef(new Animated.Value(0)).current;

    // Jitter animations
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Trigger global static sound
            playSound('static');

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

