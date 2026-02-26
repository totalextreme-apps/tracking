import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useCollection } from '@/hooks/useCollection';
import { getCustomLists } from '@/lib/collection-utils';
import type { CollectionItemWithMovie, MovieFormat } from '@/types/database';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { TrackingLoader } from '@/components/TrackingLoader';

// Format badge colours — matches StackCard's FORMAT_COLORS
const FORMAT_COLORS: Record<string, string> = {
    VHS: 'bg-neutral-700',
    DVD: 'bg-blue-900',
    BluRay: 'bg-blue-700',
    '4K': 'bg-violet-800',
    Digital: 'bg-teal-800',
};

export default function ListsScreen() {
    const { userId, isLoading: authLoading } = useAuth();
    const { playSound } = useSound();
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = Platform.OS === 'web' && windowWidth > 1024;

    const { data: collection, isLoading: collectionLoading } = useCollection(userId);

    if (authLoading || (userId && collectionLoading)) {
        return (
            <View className="flex-1 bg-neutral-950 items-center justify-center">
                <TrackingLoader label="LOADING STACKS" />
            </View>
        );
    }

    const customLists = getCustomLists(collection);

    return (
        <View className="flex-1 bg-neutral-950">
            <ScrollView
                className="flex-1 bg-neutral-950"
                contentContainerStyle={{
                    paddingBottom: 100,
                    paddingHorizontal: 20,
                    paddingTop: 20,
                    maxWidth: 1200,
                    alignSelf: 'center',
                    width: '100%',
                }}
            >
                <Text className="text-white/60 font-mono text-xs text-center mb-8 px-4">
                    Create curated lists of your collection from 'Kickass Action Flicks' to 'Tapes for Trade' or 'On Deck this Weekend'.
                </Text>

                <Pressable
                    onPress={() => {
                        playSound('click');
                        router.push('/create-list');
                    }}
                    className="bg-amber-600 p-4 rounded-lg flex-row items-center justify-center mb-8 active:opacity-80"
                >
                    <FontAwesome name="plus" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text className="text-white font-mono font-bold tracking-widest text-center">CREATE CURATED STACK</Text>
                </Pressable>

                {customLists.length === 0 ? (
                    <View className="items-center justify-center py-12">
                        <FontAwesome name="film" size={48} color="#262626" />
                        <Text className="text-neutral-500 font-mono mt-4 text-center px-8">
                            You haven't created any curated stacks yet. Build your first mixtape above!
                        </Text>
                    </View>
                ) : (
                    customLists.map((listName) => {
                        const stackItems: CollectionItemWithMovie[] = collection?.filter(
                            (item: CollectionItemWithMovie) => item.custom_lists?.includes(listName)
                        ) || [];

                        const itemCount = stackItems.length;

                        // Build format breakdown e.g. "2 VHS · 1 DVD · 1 4K"
                        const formatCounts: Partial<Record<MovieFormat, number>> = {};
                        stackItems.forEach((item) => {
                            formatCounts[item.format] = (formatCounts[item.format] || 0) + 1;
                        });

                        return (
                            <Pressable
                                key={listName}
                                onPress={() => {
                                    playSound('click');
                                    router.push(`/stack/${encodeURIComponent(listName)}` as any);
                                }}
                                className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg flex-row items-center justify-between mb-3 active:opacity-80"
                            >
                                <View className="flex-row items-center flex-1">
                                    {/* Play button icon */}
                                    <View className="bg-amber-600 w-10 h-10 rounded items-center justify-center mr-4">
                                        <FontAwesome name="play" size={14} color="#fff" style={{ marginLeft: 2 }} />
                                    </View>

                                    <View className="flex-1 pr-4">
                                        <Text className="text-white font-mono text-base" numberOfLines={1}>{listName}</Text>

                                        {/* Count + format pills on one line */}
                                        <View className="flex-row items-center flex-wrap gap-1.5 mt-1">
                                            <Text className="text-neutral-500 font-mono text-xs">
                                                {itemCount} {itemCount === 1 ? 'FILM' : 'FILMS'}
                                            </Text>
                                            {Object.entries(formatCounts).map(([fmt, count]) => (
                                                <View
                                                    key={fmt}
                                                    className={`px-1.5 py-0.5 rounded ${FORMAT_COLORS[fmt] || 'bg-neutral-700'}`}
                                                >
                                                    <Text className="text-white font-mono text-[9px] font-bold">
                                                        {count} {fmt}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                                <FontAwesome name="chevron-right" size={12} color="#525252" />
                            </Pressable>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
}
