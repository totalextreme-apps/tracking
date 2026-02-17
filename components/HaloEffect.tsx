import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

type HaloEffectProps = {
    visible: boolean;
    size?: number;
};

export function HaloEffect({ visible, size = 150 }: HaloEffectProps) {
    const pulseValue = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            pulseValue.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 1500 }),
                    withTiming(0, { duration: 1500 })
                ),
                -1,
                true
            );
        } else {
            pulseValue.value = 0;
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => {
        const scale = interpolate(pulseValue.value, [0, 1], [1, 1.15]);
        const opacity = interpolate(pulseValue.value, [0, 0.5, 1], [0.4, 0.7, 0.4]);

        return {
            transform: [{ scale }],
            opacity: visible ? opacity : 0,
        };
    });

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.halo,
                animatedStyle,
                {
                    width: size,
                    height: size,
                },
            ]}
            pointerEvents="none"
        />
    );
}

const styles = StyleSheet.create({
    halo: {
        position: 'absolute',
        borderRadius: 12,
        borderWidth: 3,
        borderColor: 'rgba(0, 255, 200, 0.8)',
        shadowColor: '#00ffc8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 20,
    },
});
