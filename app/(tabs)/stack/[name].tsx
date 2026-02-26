import { StackCard } from '@/components/StackCard';
import { TrackingLoader } from '@/components/TrackingLoader';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { useCollection } from '@/hooks/useCollection';
import { getStacks } from '@/lib/collection-utils';
import type { CollectionItemWithMovie } from '@/types/database';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

export default function CuratedStackScreen() {
    const { name } = useLocalSearchParams<{ name: string }>();
    const decodedName = decodeURIComponent(name || '');
    const { userId } = useAuth();
    const { playSound } = useSound();
    const router = useRouter();
    const { thriftMode } = useThriftMode();
    const { width: windowWidth } = useWindowDimensions();

    const { data: collection, isLoading: collectionLoading } = useCollection(userId);

    if (collectionLoading) {
        return (
            <View className="flex-1 bg-neutral-950 items-center justify-center">
                <TrackingLoader label="LOADING STACKS" />
            </View>
        );
    }

    const stackItems = collection?.filter((item: CollectionItemWithMovie) =>
        item.custom_lists?.includes(decodedName)
    ) || [];

    const stacks = getStacks(stackItems, thriftMode, 'title', 'asc');
    const isEmpty = stacks.length === 0;

    return (
        <View className="flex-1 bg-neutral-950">
            <View
                className="px-4 pt-3 pb-3 border-b border-neutral-900 bg-neutral-950"
                style={{ maxWidth: 1200, alignSelf: 'center', width: '100%' }}
            >
                <Pressable
                    onPress={() => { playSound('click'); router.back(); }}
                    className="bg-[#0000FF] px-4 py-1.5 rounded-md self-start active:opacity-80 mb-3"
                >
                    <Text className="text-white text-[10px] font-bold uppercase tracking-widest" style={{ fontFamily: 'VCR_OSD_MONO' }}>BACK</Text>
                </Pressable>

                <Text className="text-amber-500 text-2xl font-black tracking-widest uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>
                    {decodedName}
                </Text>
                <Text className="text-neutral-500 font-mono text-xs">
                    {stackItems.length} {stackItems.length === 1 ? 'FILM' : 'FILMS'}
                </Text>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    paddingBottom: 100,
                    paddingHorizontal: 16,
                    paddingTop: 8,
                    maxWidth: 1200,
                    alignSelf: 'center',
                    width: '100%',
                }}
                showsVerticalScrollIndicator={false}
            >
                {isEmpty ? (
                    <View className="items-center justify-center py-20 px-8">
                        <FontAwesome name="film" size={48} color="#262626" />
                        <Text className="text-neutral-500 font-mono text-center mt-6">
                            This stack is currently empty.
                        </Text>
                    </View>
                ) : (
                    stacks.map((stack) => {
                        // Account for the ScrollView's paddingHorizontal:16 on each side
                        const cardWidth = Math.min(windowWidth, 1200) - 32;
                        return (
                            <View key={stack[0].movie_id} style={{ width: '100%', marginBottom: 8 }}>
                                <StackCard
                                    stack={stack}
                                    mode="list"
                                    width={cardWidth}
                                    height={76}
                                    stackOffset={4}
                                    onPress={() => {
                                        playSound('click');
                                        router.push(`/movie/${stack[0].movie_id}`);
                                    }}
                                />
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
}
