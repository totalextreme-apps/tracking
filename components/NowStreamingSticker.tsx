import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

type NowStreamingStickerProps = {
    visible: boolean;
    size?: number;
    scale?: number;
};

export function NowStreamingSticker({ visible, size = 60, scale = 0.7 }: NowStreamingStickerProps) {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
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
                    top: 2, // Adjusted padding from edge
                    left: 2,
                    zIndex: 100,
                    transform: [{ rotate: '-15deg' }, { scale: scale }] // Scale controlled by prop
                },
            ]}
            pointerEvents="none"
        >
            <View
                className="bg-emerald-500 px-1.5 py-0.5 shadow-sm border border-emerald-400"
                style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.3,
                    shadowRadius: 1,
                    elevation: 2,
                }}
            >
                <Text className="text-white font-black text-[8px] text-center leading-tight">
                    NOW
                </Text>
                <Text className="text-white font-black text-[8px] text-center leading-tight">
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
