import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface Props {
    width: DimensionValue;
    height: DimensionValue;
    style?: ViewStyle;
}

export function NoPosterPlaceholder({ width, height, style }: Props) {
    const scanlineAnim = useRef(new Animated.Value(0)).current;
    const glitchAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(scanlineAnim, {
                toValue: 1,
                duration: 4000,
                useNativeDriver: true,
            })
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(glitchAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(glitchAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.delay(2000),
            ])
        ).start();
    }, [scanlineAnim, glitchAnim]);

    const translateY = scanlineAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-100, 400], // Adjust based on height if needed
    });

    const glitchOpacity = glitchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.3],
    });

    return (
        <View style={[styles.container, { width, height }, style]}>
            {/* Background base */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#050505' }]} />

            {/* Glitch Overlay */}
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#222', opacity: glitchOpacity }]} />

            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                    <LinearGradient id="scanlineGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="transparent" stopOpacity="0" />
                        <Stop offset="0.5" stopColor="#33ff33" stopOpacity="0.2" />
                        <Stop offset="1" stopColor="transparent" stopOpacity="0" />
                    </LinearGradient>
                </Defs>

                {/* Static Noise Pattern (Simplified) */}
                {[...Array(10)].map((_, i) => (
                    <Rect
                        key={i}
                        x={`${Math.random() * 100}%`}
                        y={`${Math.random() * 100}%`}
                        width={`${Math.random() * 40}%`}
                        height="1"
                        fill="#1a1a1a"
                        opacity={0.5}
                    />
                ))}

                {/* Vertical Noise */}
                <Rect x="10%" y="0" width="1" height="100%" fill="#111" />
                <Rect x="90%" y="0" width="1" height="100%" fill="#111" />
            </Svg>

            {/* Moving Scanline */}
            <Animated.View
                style={[
                    styles.scanline,
                    {
                        transform: [{ translateY }],
                    },
                ]}
            />

            {/* Vignette/Rounded CRT effect overlap */}
            <View style={styles.vignette} />

            {/* Some "NO SIGNAL" or "ERROR" text style elements */}
            <View style={{ position: 'absolute', bottom: 10, left: 10 }}>
                <View style={{ width: 10, height: 2, backgroundColor: '#333', marginBottom: 2 }} />
                <View style={{ width: 6, height: 2, backgroundColor: '#333' }} />
            </View>
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
        height: 40,
        backgroundColor: 'rgba(51, 255, 51, 0.05)',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(51, 255, 51, 0.1)',
    },
    vignette: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
    },
});
