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
    const posterUrl = getPosterUrl(movie.poster_path);

    return (
        <View className="bg-neutral-950 p-6 items-center justify-center w-[300px] aspect-[4/5] border-8 border-white">
            {/* VCR Date Overlay */}
            <View className="absolute top-4 right-4 z-10">
                <Text className="text-green-500 font-mono text-xs shadow-lg" style={{ textShadowColor: 'rgba(0, 255, 0, 0.8)', textShadowRadius: 4 }}>
                    {new Date().toLocaleDateString().toUpperCase()}
                </Text>
            </View>

            {/* Branding */}
            <View className="absolute top-4 left-4 z-10">
                <Text className="text-white font-black italic tracking-tighter text-sm">
                    MY<Text className="text-amber-500">STACKS</Text>
                </Text>
            </View>

            {/* Main Poster */}
            <View className="w-48 h-72 bg-neutral-800 rounded shadow-2xl mb-4 border border-neutral-700 overflow-hidden relative">
                <Image source={{ uri: posterUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                {/* Gloss Overlays */}
                <View className="absolute top-0 right-0 w-full h-full bg-gradient-to-tr from-transparent via-white/5 to-white/10" />
            </View>

            {/* Metadata */}
            <Text className="text-white font-bold text-center text-lg mb-1 leading-5" numberOfLines={2}>
                {movie.title}
            </Text>
            <Text className="text-neutral-500 font-mono text-xs mb-3">
                {movie.release_date?.substring(0, 4)}
            </Text>

            {/* Formats */}
            <View className="flex-row gap-2 flex-wrap justify-center">
                {items.map(item => (
                    <View key={item.id} className="px-2 py-1 bg-neutral-800 rounded border border-neutral-700">
                        <Text className="text-amber-500 font-mono text-[10px] font-bold">{item.format}</Text>
                    </View>
                ))}
            </View>

            {/* Footer / URL */}
            <View className="absolute bottom-2">
                <Text className="text-neutral-700 text-[8px] font-mono tracking-widest">TRACKING.APP</Text>
            </View>
        </View>
    );
}
