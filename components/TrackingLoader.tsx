import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

interface TrackingLoaderProps {
    label?: string;
}

export function TrackingLoader({ label = "AUTO TRACKING" }: TrackingLoaderProps) {
    const progress = useSharedValue(0);
    const textOpacity = useSharedValue(1);

    useEffect(() => {
        // Continuous top-to-bottom tracking line scan
        progress.value = withRepeat(
            withTiming(1, { duration: 2000, easing: Easing.linear }),
            -1,
            false
        );

        // Blinking "TRACKING" text
        textOpacity.value = withRepeat(
            withSequence(
                withTiming(0, { duration: 500 }),
                withTiming(1, { duration: 500 })
            ),
            -1,
            true
        );
    }, []);

    const lineStyle = useAnimatedStyle(() => {
        return {
            top: (interpolate(progress.value, [0, 1], [0, 100]) + '%') as any, // Cast to any to satisfy Reanimated/RN type mismatch
            opacity: interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
        };
    });

    const textStyle = useAnimatedStyle(() => {
        return {
            opacity: textOpacity.value,
        };
    });

    return (
        <View style={styles.container}>
            <Animated.Text style={[styles.text, textStyle]}>{label}</Animated.Text>
            <View style={styles.lineWrapper}>
                <Animated.View style={[styles.scanLine, lineStyle]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    text: {
        color: '#00ff00',
        fontFamily: 'Courier', // Fallback
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        textShadowColor: 'rgba(0, 255, 0, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 4,
    },
    lineWrapper: {
        width: 200,
        height: 4,
        backgroundColor: 'rgba(0, 255, 0, 0.1)',
        overflow: 'hidden',
        borderRadius: 2,
        position: 'relative',
    },
    scanLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: '100%',
        backgroundColor: '#00ff00',
        shadowColor: '#00ff00',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
});
