import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMovie } from '@/types/database';

const FORMAT_ORDER: Record<string, number> = {
    '4K': 5,
    BluRay: 4,
    DVD: 3,
    VHS: 2,
    Digital: 1,
    // Add others if needed
};

function sortByQuality(items: CollectionItemWithMovie[]): CollectionItemWithMovie[] {
    return [...items].sort(
        (a, b) => (FORMAT_ORDER[b.format] ?? 0) - (FORMAT_ORDER[a.format] ?? 0)
    );
}

type StackListItemProps = {
    stack: CollectionItemWithMovie[];
    onPress?: () => void;
    onAcquiredPress?: (item: CollectionItemWithMovie) => void;
};

export function StackListItem({ stack, onPress, onAcquiredPress }: StackListItemProps) {
    const sorted = sortByQuality(stack);
    const topItem = sorted[0];
    const movie = topItem.movies!;
    const posterUrl = getPosterUrl(movie.poster_path, 'w92');

    const handlePress = () => {
        Haptics.selectionAsync();
        onPress?.();
    };

    const handleAcquired = () => {
        if (onAcquiredPress) {
            onAcquiredPress(topItem);
        }
    };

    return (
        <Pressable
            onPress={handlePress}
            className="flex-row p-3 bg-neutral-900 mb-2 rounded-lg active:bg-neutral-800 border-b border-neutral-800"
        >
            {/* Poster */}
            <View className="w-12 h-18 bg-neutral-800 rounded overflow-hidden mr-3" style={{ width: 48, height: 72 }}>
                {posterUrl ? (
                    <Image source={{ uri: posterUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                    <View className="flex-1 items-center justify-center">
                        <Text className="text-neutral-600 font-mono text-xs">?</Text>
                    </View>
                )}
            </View>

            {/* Info */}
            <View className="flex-1 justify-center">
                <Text className="text-white font-bold font-mono text-base mb-1" numberOfLines={1}>
                    {movie.title}
                </Text>
                <Text className="text-neutral-500 font-mono text-xs mb-2">
                    {movie.release_date?.slice(0, 4) ?? '—'}
                </Text>

                {/* Formats */}
                <View className="flex-row flex-wrap gap-1">
                    {sorted.map((item) => (
                        <View key={item.id} className={`px-1.5 py-0.5 rounded ${item.status === 'wishlist' ? 'bg-neutral-800 border border-neutral-700' : 'bg-neutral-700'}`}>
                            <Text className={`font-mono text-[10px] ${item.status === 'wishlist' ? 'text-amber-500' : 'text-neutral-300'}`}>
                                {item.format}
                                {item.status === 'wishlist' && '*'}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Optional Action for Wishlist mode? Or just chevron */}
            {/* If wishlist mode, usually we tap to acquire. The parent handles passing handler. */}
        </Pressable>
    );
}
