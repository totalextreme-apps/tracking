import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMovie } from '@/types/database';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { GlossyCard } from './GlossyCard';
import { VHSCard } from './VHSCard';

type ShareableShelfProps = {
    items: CollectionItemWithMovie[];
    mode?: 'display' | 'thrift';
};

export function ShareableShelf({ items, mode = 'display' }: ShareableShelfProps) {
    // Limit to top 5 items
    const displayItems = items.slice(0, 5);

    return (
        <View className="bg-neutral-950 items-center w-[350px] aspect-[9/16] relative overflow-hidden">

            {/* Background */}
            <Image
                source={mode === 'thrift'
                    ? require('@/assets/images/thrift_background.png')
                    : require('@/assets/images/shelf_background.png')
                }
                style={{ position: 'absolute', width: '100%', height: '100%' }}
                contentFit="cover"
            />
            <View className="absolute inset-0 bg-black/40" />

            {/* Header Logo */}
            <View className="w-full pt-12 pb-6 items-center">
                <Image
                    source={require('@/assets/images/logo_tracking.png')}
                    style={{ width: 180, height: 60 }}
                    contentFit="contain"
                />
            </View>

            {/* Grid of Movies */}
            <View className="flex-1 w-full px-4 flex-row flex-wrap justify-center gap-4 content-start pt-4">
                {displayItems.map((item, idx) => {
                    const movie = item.movies;
                    if (!movie) return null;
                    const posterUrl = getPosterUrl(movie.poster_path);

                    return (
                        <View key={item.id || idx} className="w-[28%] aspect-[2/3] relative mb-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 5 }}>
                            {item.format === 'VHS' ? (
                                <VHSCard posterUrl={posterUrl} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <GlossyCard posterUrl={posterUrl} format={item.format} style={{ width: '100%', height: '100%' }} />
                            )}
                        </View>
                    );
                })}
            </View>

            {/* Footer Text */}
            <View className="absolute bottom-20 items-center">
                <Text className="text-white font-black italic text-2xl tracking-tighter"
                    style={{
                        textShadowColor: 'rgba(245, 158, 11, 0.5)',
                        textShadowOffset: { width: 2, height: 2 },
                        textShadowRadius: 1
                    }}
                >
                    {mode === 'thrift' ? 'WISHLIST GRAILS' : 'NOW ON DISPLAY'}
                </Text>
            </View>

            {/* Footer Date */}
            <View className="absolute bottom-8 items-center bg-black/60 px-4 py-1 rounded-full border border-white/10">
                <Text className="text-amber-500 font-mono text-xs tracking-widest">
                    {new Date().toLocaleDateString().toUpperCase()}
                </Text>
            </View>
        </View>
    );
}
