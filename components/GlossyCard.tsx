import type { MovieFormat } from '@/types/database';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

type GlossyCardProps = {
    posterUrl: string | null;
    format: MovieFormat;
    style?: any;
};

export function GlossyCard({ posterUrl, format, style }: GlossyCardProps) {
    // Overlays for specific formats
    const overlaySource =
        format === 'DVD' ? require('@/assets/images/overlays/dvd-wrap.png') :
            format === 'BluRay' ? require('@/assets/images/overlays/bluray-wrap.png') :
                format === '4K' ? require('@/assets/images/overlays/4k-wrap.png') : null;

    const logoSource =
        format === 'DVD' ? require('@/assets/images/overlays/formats/DVD.png') :
            format === 'BluRay' ? require('@/assets/images/overlays/formats/BluRay.png') :
                format === '4K' ? require('@/assets/images/overlays/formats/4K Ultra.png') : null;

    // Use specific format logos if needed, or rely on the wrap text? 
    // The wraps usually have logos. The previous code had specific logo overlays.
    // I'll keep the previous logo logic as a fallback or addition if the wrap doesn't have it?
    // User said "overlays... make it look like covers are new media". 
    // Usually these wraps include the plastic case + logo banner. 
    // I will assume the wrap is the PRIMARY visual driver now.

    // Legacy format logos (keeping them just in case, or maybe remove if wrap covers it?)
    // If I use the wrap, I probably don't need the separate logo in corner.
    // But let's keep it if format is Digital? GlossyCard is for physical.
    // Digital uses StackCard's digital view.

    return (
        <View
            className="relative aspect-[2/3] rounded-sm overflow-hidden shadow-lg bg-neutral-900"
            style={[{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 }, style]}
        >
            {/* Layer 1: Poster */}
            {/* If overlay exists, we might need to inset the poster slightly to fit inside the case? 
                Standard transparent cases usually overlay the poster. 
            */}
            <Image
                source={posterUrl ? { uri: posterUrl } : require('@/assets/images/icon.png')}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
                contentFit="cover"
                transition={200}
            />

            {/* Layer 2: The Wrap Overlay */}
            {overlaySource && (
                <Image
                    source={overlaySource}
                    style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 10 }}
                    contentFit="fill" // Use fill to fit the aspect ratio of the card
                />
            )}

            {/* Layer 3: Gloss Reflection (Only if no overlay? Or on top of overlay?)
                If the overlay is a "shrink wrap", it might already have gloss.
                Let's keep our gloss but maybe subtler?
                Actually, if we have a specific PNG wrap, it likely has the plastic look.
                I'll Disable generic gloss layers if we have a specific overlay.
            */}

            {!overlaySource && (
                <>
                    <LinearGradient
                        colors={['rgba(255,255,255,0.15)', 'transparent', 'rgba(255,255,255,0.05)', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    />
                    <LinearGradient
                        colors={['rgba(255,255,255,0.3)', 'transparent']}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 0.1 }}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 20 }}
                    />
                    <LinearGradient
                        colors={['rgba(255,255,255,0.2)', 'transparent']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 0.05, y: 0.5 }}
                        style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 10 }}
                    />
                </>
            )}

            {/* Layer 4: Format Logo Overlay */}
            {logoSource && (
                <Image
                    source={logoSource}
                    style={{ position: 'absolute', bottom: 6, right: 6, width: 40, height: 25, opacity: 0.9, zIndex: 20 }}
                    contentFit="contain"
                />
            )}

        </View>
    );
}
