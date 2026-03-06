import { ConfirmModal } from '@/components/ConfirmModal';
import { TrackingLoader } from '@/components/TrackingLoader';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useBulkUpdateCustomLists, useCollection, useRenameCustomList } from '@/hooks/useCollection';
import { getCustomLists } from '@/lib/collection-utils';
import type { CollectionItemWithMedia, MovieFormat } from '@/types/database';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

const FORMAT_COLORS: Record<string, string> = {
    VHS: 'bg-neutral-700',
    DVD: 'bg-blue-900',
    BluRay: 'bg-blue-700',
    '4K': 'bg-violet-800',
    Digital: 'bg-teal-800',
};

type DialogState =
    | { type: 'none' }
    | { type: 'delete'; listName: string; itemIds: string[] }
    | { type: 'rename'; listName: string };

export default function ListsScreen() {
    const { userId, isLoading: authLoading } = useAuth();
    const { playSound } = useSound();
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();

    const { data: collection, isLoading: collectionLoading } = useCollection(userId);
    const removeMutation = useBulkUpdateCustomLists(userId);
    const renameMutation = useRenameCustomList(userId);

    const [dialog, setDialog] = useState<DialogState>({ type: 'none' });

    if (authLoading || (userId && collectionLoading)) {
        return (
            <View className="flex-1 bg-neutral-950 items-center justify-center">
                <TrackingLoader label="LOADING STACKS" />
            </View>
        );
    }

    const customLists = getCustomLists(collection);

    const handleDeleteConfirm = async () => {
        if (dialog.type !== 'delete') return;
        const { listName, itemIds } = dialog;
        setDialog({ type: 'none' });
        try {
            await removeMutation.mutateAsync({ itemIds, listName, isAdding: false });
            playSound('click');
        } catch (e: any) {
            if (Platform.OS !== 'web') Alert.alert('Error', e.message);
        }
    };

    const handleRenameConfirm = async (newName?: string) => {
        if (dialog.type !== 'rename' || !newName?.trim()) { setDialog({ type: 'none' }); return; }
        const oldName = dialog.listName;
        setDialog({ type: 'none' });
        if (newName.trim() === oldName) return;
        try {
            await renameMutation.mutateAsync({ oldName, newName: newName.trim() });
            playSound('click');
        } catch (e: any) {
            if (Platform.OS !== 'web') Alert.alert('Error', e.message);
        }
    };

    return (
        <View className="flex-1 bg-neutral-950">
            {/* In-app modal for delete confirmation */}
            <ConfirmModal
                visible={dialog.type === 'delete'}
                title="Delete Stack"
                message={dialog.type === 'delete' ? `Delete "${dialog.listName}"? Films stay in your collection — only the list is removed.` : ''}
                confirmLabel="DELETE"
                destructive
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDialog({ type: 'none' })}
            />

            {/* In-app modal for rename */}
            <ConfirmModal
                visible={dialog.type === 'rename'}
                title="Rename Stack"
                promptValue={dialog.type === 'rename' ? dialog.listName : ''}
                confirmLabel="RENAME"
                onConfirm={handleRenameConfirm}
                onCancel={() => setDialog({ type: 'none' })}
            />

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
                    onPress={() => { playSound('click'); router.push('/create-list'); }}
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
                        const stackItems: CollectionItemWithMedia[] = collection?.filter(
                            (item: CollectionItemWithMedia) => item.custom_lists?.includes(listName)
                        ) || [];

                        const itemCount = stackItems.length;
                        const allIds = stackItems.map(i => i.id);

                        const formatCounts: Partial<Record<MovieFormat, number>> = {};
                        stackItems.forEach((item) => {
                            formatCounts[item.format] = (formatCounts[item.format] || 0) + 1;
                        });

                        return (
                            <View key={listName} className="mb-3">
                                <Pressable
                                    onPress={() => { playSound('click'); router.push(`/stack/${encodeURIComponent(listName)}` as any); }}
                                    className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg flex-row items-center active:opacity-80"
                                >
                                    <View className="bg-amber-600 w-10 h-10 rounded items-center justify-center mr-4 flex-shrink-0">
                                        <FontAwesome name="play" size={14} color="#fff" style={{ marginLeft: 2 }} />
                                    </View>

                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text className="text-white font-mono text-base" numberOfLines={1}>{listName}</Text>
                                        <View className="flex-row items-center flex-wrap gap-1.5 mt-1">
                                            <Text className="text-neutral-500 font-mono text-xs">
                                                {itemCount} {itemCount === 1 ? 'FILM' : 'FILMS'}
                                            </Text>
                                            {Object.entries(formatCounts).map(([fmt, count]) => (
                                                <View key={fmt} className={`px-1.5 py-0.5 rounded ${FORMAT_COLORS[fmt] || 'bg-neutral-700'}`}>
                                                    <Text className="text-white font-mono text-[9px] font-bold">{count} {fmt}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>

                                    <FontAwesome name="chevron-right" size={12} color="#525252" style={{ marginLeft: 8 }} />
                                </Pressable>

                                {/* Edit / Delete action row */}
                                <View className="flex-row gap-2 mt-1.5 px-1">
                                    <Pressable
                                        onPress={() => setDialog({ type: 'rename', listName })}
                                        disabled={renameMutation.isPending}
                                        className="flex-row items-center gap-1.5 px-3 py-1 rounded bg-neutral-800 active:opacity-60"
                                    >
                                        <FontAwesome name="pencil" size={11} color="#a3a3a3" />
                                        <Text className="text-neutral-400 font-mono text-[10px]">RENAME</Text>
                                    </Pressable>

                                    <Pressable
                                        onPress={() => setDialog({ type: 'delete', listName, itemIds: allIds })}
                                        disabled={removeMutation.isPending}
                                        className="flex-row items-center gap-1.5 px-3 py-1 rounded bg-neutral-800 active:opacity-60"
                                    >
                                        <FontAwesome name="trash" size={11} color="#ef4444" />
                                        <Text className="text-red-500 font-mono text-[10px]">DELETE</Text>
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
}
