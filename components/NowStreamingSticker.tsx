import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

type NowStreamingStickerProps = {
    visible: boolean;
    size?: number;
};

export function NowStreamingSticker({ visible, size = 60 }: NowStreamingStickerProps) {
    // Random rotation between -15 and +15 degrees
    const rotation = useMemo(() => Math.random() * 30 - 15, []);

    // Position similar to SaleSticker - typically top right or left
    // Let's place it top-leftish for variety, or keep consistent with Staff Pick?
    // Staff Pick is top right. Let's do top right for consistency.
    const topPosition = useMemo(() => Math.random() * 20 + 5, []); // 5-25% from top
    const rightPosition = useMemo(() => Math.random() * 10 - 5, []); // -5 to 5 px from right

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${rotation}deg` },
            { scale: withSpring(visible ? 1 : 0, { damping: 12, stiffness: 200 }) },
        ],
        opacity: withSpring(visible ? 1 : 0),
    }));

    return (
        <Animated.View
            style={[
                styles.container,
                animatedStyle,
                {
                    top: `${topPosition}%`,
                    right: rightPosition,
                    zIndex: 100,
                },
            ]}
            pointerEvents="none"
        >
            <View
                className="bg-emerald-500 px-2 py-1 shadow-lg border border-emerald-400"
                style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.5,
                    shadowRadius: 3,
                    elevation: 5,
                    transform: [{ rotate: '-5deg' }]
                }}
            >
                <Text className="text-white font-black text-[10px] text-center leading-3">
                    NOW
                </Text>
                <Text className="text-white font-black text-[10px] text-center leading-3">
                    STREAMING
                </Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
    },
});
