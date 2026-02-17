import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

type StickerOverlayProps = {
    visible: boolean;
    size?: number;
};

export function StickerOverlay({ visible, size = 60 }: StickerOverlayProps) {
    // Random rotation between -15 and +15 degrees, fixed per component instance
    const rotation = useMemo(() => Math.random() * 30 - 15, []);

    // Random position - anywhere from 10% to 70% from the top, -5 to 15 from right
    const topPosition = useMemo(() => Math.random() * 60 + 10, []);
    const rightPosition = useMemo(() => Math.random() * 20 - 5, []);

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
                    width: size,
                    height: size,
                    top: `${topPosition}%`,
                    right: rightPosition,
                },
            ]}
            pointerEvents="none"
        >
            <Image
                source={require('@/assets/images/overlays/sticker_staffpick.png')}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        zIndex: 100,
    },
});
