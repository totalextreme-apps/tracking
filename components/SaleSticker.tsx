import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';

type SaleStickerProps = {
    visible: boolean;
    size?: number;
};

export function SaleSticker({ visible, size = 60 }: SaleStickerProps) {
    // Random rotation between -20 and +20 degrees, fixed per component instance
    const rotation = useMemo(() => Math.random() * 40 - 20, []);

    // Random position - anywhere from 5% to 60% from the top, -10 to 10 from right
    // Using random position to avoid covering the whole card monotonously
    const topPosition = useMemo(() => Math.random() * 55 + 5, []);
    const rightPosition = useMemo(() => Math.random() * 20 - 10, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${rotation}deg` },
            { scale: withSpring(visible ? 1 : 0) },
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
                source={require('@/assets/images/overlays/sticker_sale.png')}
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
