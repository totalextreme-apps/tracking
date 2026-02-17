import { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

export function EmptyState() {
    // Shared Values
    const textOpacity = useSharedValue(1);
    const trackingLineY = useSharedValue(-50);
    const trackingLineOpacity = useSharedValue(0.3);
    const noiseOpacity = useSharedValue(0.1);

    useEffect(() => {
        // Text Flicker (Random-ish)
        textOpacity.value = withRepeat(
            withSequence(
                withTiming(0.8, { duration: 100 }),
                withTiming(1, { duration: 100 }),
                withDelay(2000, withTiming(0.4, { duration: 50 })), // Glitch
                withTiming(1, { duration: 50 }),
                withDelay(500, withTiming(1, { duration: 1000 }))
            ),
            -1,
            true
        );

        // Tracking Line Movement (Top to Bottom Loop)
        trackingLineY.value = withRepeat(
            withTiming(height, { duration: 8000, easing: Easing.linear }),
            -1,
            false
        );

        // Tracking Line Flicker
        trackingLineOpacity.value = withRepeat(
            withSequence(
                withTiming(0.1, { duration: 200 }),
                withTiming(0.4, { duration: 300 })
            ),
            -1,
            true
        );

    }, []);

    const animatedText = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [
            // Subtle jitter? Maybe too expensive for JS thread if logic is complex, 
            // but simple random values need to serve as shared values or derived.
            // Keeping it simple for now.
        ]
    }));

    const animatedTrackingLine = useAnimatedStyle(() => ({
        transform: [{ translateY: trackingLineY.value }],
        opacity: trackingLineOpacity.value
    }));

    return (
        <View className="flex-1 bg-[#0000AA] relative overflow-hidden items-center justify-center min-h-[500px]">
            {/* Scanlines / Noise Texture (Simulated with simple views for performance) */}
            {/* In a real app, an Image background with a noise texture set to repeat would be better. */}

            {/* Tracking Line */}
            <Animated.View
                className="absolute w-full h-1 bg-white/20 z-10"
                style={[{ top: 0 }, animatedTrackingLine]}
            />

            {/* VCR UI Overlay */}
            <View className="absolute top-12 left-8 z-20">
                <Text className="text-white font-mono text-xl">PLAY</Text>
            </View>

            <View className="absolute top-12 right-8 z-20">
                <Text className="text-white font-mono text-xl">SP</Text>
            </View>

            <View className="absolute bottom-32 left-8 z-20">
                <Text className="text-white font-mono text-xl">NO DATA</Text>
            </View>

            <View className="absolute bottom-32 right-8 z-20">
                <Text className="text-white font-mono text-xl">00:00:00</Text>
            </View>

            {/* Main Content */}
            <Animated.View style={animatedText} className="items-center z-30">
                <Text
                    className="text-white font-mono text-5xl font-bold tracking-widest text-center mb-2 pt-4 pb-2 leading-relaxed"
                    style={{ textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 }}
                >
                    NO SIGNAL
                </Text>
                <Text className="text-white/80 font-mono text-lg text-center tracking-widest mt-4">
                    INSERT TAPE
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    // Additional styles if needed
});
