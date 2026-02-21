import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMovie } from '@/types/database';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

type ShareableCardProps = {
    movie: CollectionItemWithMovie['movies'];
    items: CollectionItemWithMovie[];
};

export function ShareableCard({ movie, items }: ShareableCardProps) {
    if (!movie) return null;
    const customPoster = items.find(i => i.custom_poster_url)?.custom_poster_url;
    const posterUrl = customPoster || getPosterUrl(movie.poster_path);

    return (
        <View className="bg-neutral-950 p-6 items-center justify-center w-[320px] aspect-[9/16] border-8 border-white overflow-hidden relative">
            {/* VCR Date Overlay */}
            <View className="absolute top-6 right-6 z-10">
                <Text className="text-green-500 font-mono text-xs shadow-lg" style={{ textShadowColor: 'rgba(0, 255, 0, 0.8)', textShadowRadius: 4 }}>
                    {new Date().toLocaleDateString().toUpperCase()}
                </Text>
            </View>

            {/* Branding - Tracking Logo */}
            <View className="absolute top-8 left-0 right-0 items-center z-10">
                <Image
                    source={require('@/assets/images/logo_tracking.png')}
                    style={{ width: 120, height: 40 }}
                    contentFit="contain"
                />
            </View>

            {/* Main Poster */}
            <View className="mt-12 w-56 h-80 bg-neutral-800 rounded shadow-2xl mb-6 border border-neutral-700 overflow-hidden relative">
                <Image source={{ uri: posterUrl ?? undefined }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                {/* Gloss Overlays */}
                <View className="absolute top-0 right-0 w-full h-full bg-gradient-to-tr from-transparent via-white/5 to-white/10" />
            </View>

            {/* Metadata */}
            <View className="w-full px-4 items-center">
                <Text className="text-white font-bold text-center text-xl mb-1 leading-6" numberOfLines={2}>
                    {movie.title}
                </Text>
                <Text className="text-neutral-500 font-mono text-xs mb-4">
                    {movie.release_date?.substring(0, 4)}
                </Text>

                {/* Formats */}
                <View className="flex-row gap-2 flex-wrap justify-center">
                    {items.map(item => (
                        <View key={item.id} className="px-3 py-1.5 bg-neutral-800 rounded border border-neutral-700">
                            <Text className="text-amber-500 font-mono text-xs font-bold uppercase">{item.format}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Footer / URL */}
            <View className="absolute bottom-4 left-0 right-0 items-center">
                <Text className="text-neutral-700 text-[10px] font-mono tracking-[4px]">TRACKING.APP</Text>
            </View>
        </View>
    );
}
