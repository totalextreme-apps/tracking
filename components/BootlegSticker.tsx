import { Image } from 'expo-image';
import { View } from 'react-native';

export function BootlegSticker({ size = 30 }: { size?: number }) {
    return (
        <View style={{ position: 'absolute', bottom: 4, left: 4, zIndex: 9999, elevation: 10, pointerEvents: 'none' }}>
            <Image
                source={require('@/assets/images/overlays/boot_sticker.png')}
                style={{ width: size, height: size }}
                contentFit="contain"
            />
        </View>
    );
}
