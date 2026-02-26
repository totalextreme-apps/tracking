import { ConfirmModal } from '@/components/ConfirmModal';
import { StackCard } from '@/components/StackCard';
import { TrackingLoader } from '@/components/TrackingLoader';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { useBulkUpdateCustomLists, useCollection } from '@/hooks/useCollection';
import { getStacks } from '@/lib/collection-utils';
import type { CollectionItemWithMovie } from '@/types/database';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

export default function CuratedStackScreen() {
    const { name } = useLocalSearchParams<{ name: string }>();
    const decodedName = decodeURIComponent(name || '');
    const { userId } = useAuth();
    const { playSound } = useSound();
    const router = useRouter();
    const { thriftMode } = useThriftMode();
    const { width: windowWidth } = useWindowDimensions();

    const { data: collection, isLoading: collectionLoading } = useCollection(userId);
    const removeMutation = useBulkUpdateCustomLists(userId);
    const [confirmMovieId, setConfirmMovieId] = useState<number | null>(null);

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

    const handleRemoveItem = (movieId: number) => {
        setConfirmMovieId(movieId);
    };

    const doRemove = async () => {
        if (confirmMovieId === null) return;
        const itemsToRemove = stackItems.filter((i: CollectionItemWithMovie) => i.movie_id === confirmMovieId);
        const ids = itemsToRemove.map((i: CollectionItemWithMovie) => i.id);
        setConfirmMovieId(null);
        try {
            await removeMutation.mutateAsync({ itemIds: ids, listName: decodedName, isAdding: false });
            playSound('click');
        } catch (e: any) {
            if (Platform.OS !== 'web') Alert.alert('Error', e.message);
        }
    };

    const cardWidth = Math.min(windowWidth, 1200) - 32;

    return (
        <View className="flex-1 bg-neutral-950">
            <ConfirmModal
                visible={confirmMovieId !== null}
                title="Remove from Stack"
                message={`Remove this film from "${decodedName}"?`}
                confirmLabel="REMOVE"
                destructive
                onConfirm={doRemove}
                onCancel={() => setConfirmMovieId(null)}
            />
            <View
                className="px-4 pt-3 pb-3 border-b border-neutral-900 bg-neutral-950"
                style={{ maxWidth: 1200, alignSelf: 'center', width: '100%' }}
            >
                {/* BACK + ADD row */}
                <View className="flex-row items-center justify-between mb-3">
                    <Pressable
                        onPress={() => { playSound('click'); router.replace('/lists' as any); }}
                        className="bg-[#0000FF] px-4 py-1.5 rounded-md active:opacity-80"
                    >
                        <Text className="text-white text-[10px] font-bold uppercase tracking-widest" style={{ fontFamily: 'VCR_OSD_MONO' }}>BACK</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => {
                            playSound('click');
                            router.push(`/create-list?existingListName=${encodeURIComponent(decodedName)}` as any);
                        }}
                        className="bg-amber-600 px-4 py-1.5 rounded-md active:opacity-80 flex-row items-center gap-2"
                    >
                        <FontAwesome name="plus" size={11} color="#fff" />
                        <Text className="text-white text-[10px] font-bold uppercase tracking-widest" style={{ fontFamily: 'VCR_OSD_MONO' }}>ADD</Text>
                    </Pressable>
                </View>

                {/* Stack name + count */}
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
                        <Pressable
                            onPress={() => {
                                playSound('click');
                                router.push(`/create-list?existingListName=${encodeURIComponent(decodedName)}` as any);
                            }}
                            className="bg-amber-600 px-6 py-2 rounded-md mt-6 active:opacity-80"
                        >
                            <Text className="text-white font-mono font-bold tracking-widest">+ ADD FILMS</Text>
                        </Pressable>
                    </View>
                ) : (
                    stacks.map((stack) => (
                        <View key={stack[0].movie_id} className="flex-row items-center mb-2">
                            {/* Stack card takes all available space */}
                            <View style={{ flex: 1 }}>
                                <StackCard
                                    stack={stack}
                                    mode="list"
                                    width={cardWidth - 44} // leave room for trash button
                                    height={76}
                                    stackOffset={4}
                                    onPress={() => {
                                        playSound('click');
                                        router.push(`/movie/${stack[0].movie_id}?fromStack=${encodeURIComponent(decodedName)}` as any);
                                    }}
                                />
                            </View>

                            {/* Remove button */}
                            <Pressable
                                onPress={() => handleRemoveItem(stack[0].movie_id)}
                                disabled={removeMutation.isPending}
                                className="ml-2 w-9 h-9 items-center justify-center rounded-md bg-neutral-900 border border-neutral-800 active:opacity-60"
                                hitSlop={8}
                            >
                                <FontAwesome name="trash" size={14} color="#ef4444" />
                            </Pressable>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}
