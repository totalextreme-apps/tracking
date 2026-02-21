import { Image } from 'expo-image';
import { View } from 'react-native';

type VHSCardProps = {
    posterUrl: string | null;
    style?: any;
    isCustom?: boolean;
};

export function VHSCard({ posterUrl, style, isCustom = false }: VHSCardProps) {
    const aspectRatio = isCustom ? 2 / 3.5 : 2 / 3;

    return (
        <View
            className="relative rounded-xl overflow-hidden shadow-lg bg-neutral-900"
            style={[{ aspectRatio, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 5 }, style]}
        >
            {/* Layer 1: Poster */}
            <Image
                source={posterUrl ? { uri: posterUrl } : require('@/assets/images/icon.png')}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
                contentFit="cover"
                transition={200}
            />

            {/* Layer 2: Aging Filter */}
            {/* mix-blend-overlay is not supported natively in RN, so we use opacity for effect */}
            <View className="absolute inset-0 bg-amber-900/30 mix-blend-overlay" />

            {/* Layer 3: Scuff Overlay */}
            <Image
                source={require('@/assets/images/overlays/vhs-worn.png')}
                style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.9 }}
                contentFit="fill"
            />

            {/* Layer 4: Format Logo */}
            <Image
                source={require('@/assets/images/overlays/formats/VHS.png')}
                style={{ position: 'absolute', bottom: 6, right: 6, width: 40, height: 25, opacity: 0.9 }}
                contentFit="contain"
            />
        </View>
    );
}
