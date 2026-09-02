import { Image } from 'expo-image';
import { View } from 'react-native';
import { BootlegSticker } from './BootlegSticker';

type VHSCardProps = {
    posterUrl: string | null;
    style?: any;
    isCustom?: boolean;
    isBootleg?: boolean;
};

export function VHSCard({ posterUrl, style, isCustom = false, isBootleg = false }: VHSCardProps) {
    const aspectRatio = isCustom ? 2 / 3.5 : 2 / 3;
    const baseStyle = style?.height
        ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 5 }
        : { aspectRatio, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 5 };

    return (
        <View
            className="relative rounded overflow-hidden shadow-lg bg-neutral-900"
            style={[baseStyle, style, { overflow: 'hidden' }]}
        >
            {/* Layer 1: Poster */}
            <Image
                source={posterUrl ? { uri: posterUrl } : require('@/assets/images/icon.png')}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
                contentFit="cover"
                transition={200}
            />

            {/* Layer 2: Aging Filter */}
            <View className="absolute inset-0 bg-amber-900/30 mix-blend-overlay" />

            {/* Layer 3: Scuff Overlay */}
            <Image
                source={require('@/assets/images/overlays/vhs-worn.png')}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', opacity: 0.9 }}
                contentFit="fill"
            />

            {/* Layer 4: Format Logo Corner */}
            <Image
                source={require('@/assets/images/overlays/formats/VHS.png')}
                style={{ position: 'absolute', bottom: 6, right: 6, width: 30, height: 18, opacity: 0.9, zIndex: 40 }}
                contentFit="contain"
            />

            {/* Layer 5: Bootleg Sticker */}
            {isBootleg && <BootlegSticker size={30} />}
        </View>
    );
}
