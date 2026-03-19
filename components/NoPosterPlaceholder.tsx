import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

interface Props {
    width: DimensionValue;
    height: DimensionValue;
    style?: ViewStyle;
}

export function NoPosterPlaceholder({ width, height, style }: Props) {
    const scanlineAnim = useRef(new Animated.Value(0)).current;
    const flickerAnim = useRef(new Animated.Value(0.8)).current;
    const noiseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Vertical scanline sweep
        Animated.loop(
            Animated.timing(scanlineAnim, {
                toValue: 1,
                duration: 3000,
                useNativeDriver: true,
            })
        ).start();

        // High frequency flicker
        Animated.loop(
            Animated.sequence([
                Animated.timing(flickerAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
                Animated.timing(flickerAnim, { toValue: 0.7, duration: 50, useNativeDriver: true }),
                Animated.timing(flickerAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
            ])
        ).start();

        // Noise offset animation
        Animated.loop(
            Animated.timing(noiseAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const translateY = scanlineAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-100, 500],
    });

    return (
        <View style={[styles.container, { width, height }, style]}>
            {/* Base Background - Deep Blue/Black */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#02040a' }]} />

            {/* Intense Static Pattern */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: flickerAnim }]}>
                <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                    <Defs>
                        <Pattern id="staticPattern" width="4" height="4" patternUnits="userSpaceOnUse">
                            <Rect width="1" height="1" fill="#1a1c2c" x="0" y="0" />
                            <Rect width="1" height="1" fill="#4d5b9d" x="2" y="0" />
                            <Rect width="1" height="1" fill="#8b9bb4" x="0" y="2" />
                            <Rect width="1" height="1" fill="#000" x="2" y="1" />
                        </Pattern>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#staticPattern)" opacity={0.6} />
                </Svg>
            </Animated.View>

            {/* Major Interference Bars (Blue Tint) */}
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                {[...Array(25)].map((_, i) => (
                    <Rect
                        key={i}
                        x="0"
                        y={`${Math.random() * 100}%`}
                        width={`${20 + Math.random() * 80}%`}
                        height={`${0.5 + Math.random() * 1.5}%`}
                        fill={Math.random() > 0.5 ? "#243b82" : "#8b9bb4"}
                        opacity={0.4}
                    />
                ))}

                {/* Vertical Signal Loss Bars */}
                <Rect x="5%" y="0" width="2" height="100%" fill="#1a1c2c" opacity={0.6} />
                <Rect x="15%" y="0" width="1" height="100%" fill="#4d5b9d" opacity={0.2} />
                <Rect x="94%" y="0" width="1" height="100%" fill="#1a1c2c" opacity={0.6} />

                {/* CRT Screen Lines (Horizontal - Dense) */}
                {[...Array(120)].map((_, i) => (
                    <Rect
                        key={`line-${i}`}
                        x="0"
                        y={`${(i / 120) * 100}%`}
                        width="100%"
                        height="0.5"
                        fill="#000"
                        opacity={0.3}
                    />
                ))}
            </Svg>

            {/* Glowing Interference Sweep */}
            <Animated.View
                style={[
                    styles.scanline,
                    {
                        transform: [{ translateY }],
                    },
                ]}
            />

            {/* Color Aberration / Blue Glow Shadow */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#4d5b9d', opacity: 0.08 }]} />

            {/* Vignette */}
            <LinearGradient
                colors={['rgba(0,0,0,0.9)', 'transparent', 'transparent', 'rgba(0,0,0,0.9)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
        overflow: 'hidden',
        position: 'relative',
    },
    scanline: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 80,
        backgroundColor: 'rgba(77, 91, 157, 0.15)',
        borderTopWidth: 2,
        borderBottomWidth: 2,
        borderColor: 'rgba(139, 155, 180, 0.2)',
    },
});
