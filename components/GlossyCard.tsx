import type { MovieFormat } from '@/types/database';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { BootlegSticker } from './BootlegSticker';

type GlossyCardProps = {
    posterUrl: string | null;
    format: MovieFormat;
    style?: any;
    isCustom?: boolean;
    isBootleg?: boolean;
};

export function GlossyCard({ posterUrl, format, style, isCustom = false, isBootleg = false }: GlossyCardProps) {
    const overlaySource =
        format === 'DVD' ? require('@/assets/images/overlays/dvd-wrap.png') :
            format === 'BluRay' ? require('@/assets/images/overlays/bluray-wrap.png') :
                format === '4K' ? require('@/assets/images/overlays/4k-wrap.png') : null;

    const logoSource =
        format === 'DVD' ? require('@/assets/images/overlays/formats/DVD.png') :
            format === 'BluRay' ? require('@/assets/images/overlays/formats/BluRay.png') :
                format === '4K' ? require('@/assets/images/overlays/formats/4K Ultra.png') : null;

    const isBluRay = format === 'BluRay' || format === '4K';
    const aspectRatio = isCustom ? (isBluRay ? 0.78 : 0.71) : 2 / 3;
    const baseStyle = style?.height
        ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 }
        : { aspectRatio, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 };

    return (
        <View
            className="relative rounded-sm overflow-hidden shadow-lg bg-neutral-900"
            style={[baseStyle, style, { overflow: 'hidden' }]}
        >
            {/* Layer 1: Poster */}
            <Image
                source={posterUrl ? { uri: posterUrl } : require('@/assets/images/icon.png')}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
                contentFit="cover"
                transition={200}
            />

            {/* Layer 2: The Wrap Overlay */}
            {overlaySource && (
                <Image
                    source={overlaySource}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', zIndex: 10 }}
                    contentFit="fill"
                />
            )}

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

            {/* Layer 5: Format Logo Corner */}
            {logoSource && (
                <Image
                    source={logoSource}
                    style={{ position: 'absolute', bottom: 6, right: 6, width: 30, height: 18, opacity: 0.9, zIndex: 40 }}
                    contentFit="contain"
                />
            )}

            {/* Layer 6: Bootleg Sticker */}
            {isBootleg && <BootlegSticker size={30} />}
        </View>
    );
}
