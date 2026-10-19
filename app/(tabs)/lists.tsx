import { ConfirmModal } from '@/components/ConfirmModal';
import { ShareModal } from '@/components/ShareModal';
import { TrackingLoader } from '@/components/TrackingLoader';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useBulkUpdateCustomLists, useCollection, useRenameCustomList } from '@/hooks/useCollection';
import { useCreatePost } from '@/hooks/useSocial';
import { getCustomLists, getStackMeta } from '@/lib/collection-utils';
import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMedia, MovieFormat } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

const FORMAT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    VHS: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-300' },
    DVD: { bg: 'bg-purple-500/15', border: 'border-purple-500/40', text: 'text-purple-300' },
    BluRay: { bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-300' },
    '4K': { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-300' },
    Digital: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-300' },
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
    const isDesktop = Platform.OS === 'web' && windowWidth >= 768;

    const { data: collection, isLoading: collectionLoading } = useCollection(userId);
    const removeMutation = useBulkUpdateCustomLists(userId);
    const renameMutation = useRenameCustomList(userId);
    const createPostMutation = useCreatePost(userId);

    const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
    const [shareTarget, setShareTarget] = useState<{
        listName: string;
        title: string;
        linkMessage: string;
        textMessage: string;
        boardContent: string;
        firstItem?: CollectionItemWithMedia;
    } | null>(null);

    const customLists = useMemo(() => getCustomLists(collection), [collection]);

    if (authLoading || (userId && collectionLoading)) {
        return (
            <View className="flex-1 bg-neutral-950 items-center justify-center">
                <TrackingLoader label="LOADING STACKS" />
            </View>
        );
    }

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
        if (dialog.type !== 'rename' || !newName?.trim()) {
            setDialog({ type: 'none' });
            return;
        }
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

    const openShareForStack = (listName: string, orderedItems: CollectionItemWithMedia[]) => {
        playSound('click');
        const meta = getStackMeta(collection, listName);
        const shareUrl = `https://mediatracking.app/stack/${encodeURIComponent(listName)}${userId ? `?ownerId=${userId}` : ''}`;

        // Deduplicate by title for clean plain-text list
        const seenKeys = new Set<string>();
        const uniqueEntries: { title: string; year: string; formats: string[]; item: CollectionItemWithMedia }[] = [];

        for (const item of orderedItems) {
            const media = item.movies || item.shows;
            const key = item.media_type === 'tv'
                ? `tv-${item.show_id || media?.id || item.id}`
                : `movie-${item.movie_id || media?.id || item.id}`;
            const existing = uniqueEntries.find((_, idx) => {
                const eItem = uniqueEntries[idx].item;
                const eMedia = eItem.movies || eItem.shows;
                const eKey = eItem.media_type === 'tv'
                    ? `tv-${eItem.show_id || eMedia?.id || eItem.id}`
                    : `movie-${eItem.movie_id || eMedia?.id || eItem.id}`;
                return eKey === key;
            });
            if (existing) {
                const fmtLabel = item.format === 'BluRay' ? 'Blu-ray' : item.format;
                if (!existing.formats.includes(fmtLabel)) existing.formats.push(fmtLabel);
            } else if (!seenKeys.has(key)) {
                seenKeys.add(key);
                const rawTitle = item.movies?.title || item.shows?.name || 'Untitled';
                const title = item.media_type === 'tv' && item.season_number
                    ? `${rawTitle} (S${item.season_number})`
                    : rawTitle;
                const dateStr = item.movies?.release_date || item.shows?.first_air_date || '';
                const year = dateStr ? dateStr.slice(0, 4) : '';
                const fmtLabel = item.format === 'BluRay' ? 'Blu-ray' : item.format;
                uniqueEntries.push({ title, year, formats: [fmtLabel], item });
            }
        }

        const lines = uniqueEntries.map((entry, idx) => {
            const prefix = meta.isRanked ? `${idx + 1}.` : '•';
            const yr = entry.year ? ` (${entry.year})` : '';
            const fmts = entry.formats.length > 0 ? ` [${entry.formats.join('/')}]` : '';
            return `${prefix} ${entry.title}${yr}${fmts}`;
        });

        const blurbBlock = meta.description ? `"${meta.description}"\n\n` : '';
        const textMessage = `📼 ${listName.toUpperCase()}${meta.isRanked ? ' (Ranked Stack)' : ''}\n${blurbBlock}${lines.join('\n')}\n\nCheck out this Curated Stack on Tracking:\n${shareUrl}`;
        const linkMessage = `Check out my "${listName}" Curated Stack on Tracking!\n${ meta.description ? `"${meta.description}"\n` : '' }${shareUrl}`;
        const boardContent = meta.description
            ? `${meta.description}`
            : `Sharing my "${listName}" Curated Stack (${uniqueEntries.length} ${uniqueEntries.length === 1 ? 'title' : 'titles'})!`;

        setShareTarget({
            listName,
            title: `SHARE "${listName}"`,
            linkMessage,
            textMessage,
            boardContent,
            firstItem: orderedItems[0],
        });
    };

    return (
        <View className="flex-1 bg-neutral-950">
            {/* Delete confirmation */}
            <ConfirmModal
                visible={dialog.type === 'delete'}
                title="Delete Stack"
                message={dialog.type === 'delete' ? `Delete "${dialog.listName}"? Titles stay in your collection — only this Curated Stack is removed.` : ''}
                confirmLabel="DELETE"
                destructive
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDialog({ type: 'none' })}
            />

            {/* Rename modal */}
            <ConfirmModal
                visible={dialog.type === 'rename'}
                title="Rename Stack"
                promptValue={dialog.type === 'rename' ? dialog.listName : ''}
                confirmLabel="RENAME"
                onConfirm={handleRenameConfirm}
                onCancel={() => setDialog({ type: 'none' })}
            />

            {/* Share modal */}
            <ShareModal
                visible={!!shareTarget}
                onClose={() => setShareTarget(null)}
                title={shareTarget?.title || 'SHARE STACK'}
                messageLink={shareTarget?.linkMessage || ''}
                messageText={shareTarget?.textMessage || ''}
                onShareToBoard={
                    shareTarget && userId
                        ? async () => {
                              const first = shareTarget.firstItem;
                              await createPostMutation.mutateAsync({
                                  content: shareTarget.boardContent,
                                  custom_list_name: shareTarget.listName,
                                  collection_item_id: first?.id || null,
                                  movie_id: first?.movie_id || null,
                                  show_id: first?.show_id || null,
                              } as any);
                          }
                        : undefined
                }
            />

            <ScrollView
                className="flex-1 bg-neutral-950"
                contentContainerStyle={{
                    paddingBottom: 120,
                    paddingHorizontal: isDesktop ? 28 : 16,
                    paddingTop: 20,
                    maxWidth: 1100,
                    alignSelf: 'center',
                    width: '100%',
                }}
            >
                {/* Hero Header Banner */}
                <View className="bg-neutral-900/80 border border-neutral-800/90 rounded-2xl p-5 mb-6">
                    <View className="flex-row items-center justify-between flex-wrap gap-4">
                        <View style={{ flex: 1, minWidth: 220 }}>
                            <View className="flex-row items-center gap-2 mb-1.5">
                                <View className="w-2 h-2 rounded-full bg-amber-500" />
                                <Text className="text-amber-500 font-mono text-[10px] font-bold uppercase tracking-widest">
                                    CURATED STACKS & RANKED LISTS
                                </Text>
                            </View>
                            <Text
                                className="text-white text-xl md:text-2xl font-black uppercase tracking-wider mb-1"
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                YOUR VIDEO STORE SHELVES
                            </Text>
                            <Text className="text-neutral-400 font-mono text-xs leading-relaxed">
                                Build custom lists like "Top 10 Horror VHS in My Collection", add liner notes, rank your favorites, and share a direct link with anyone.
                            </Text>
                        </View>

                        <Pressable
                            onPress={() => {
                                playSound('click');
                                router.push('/create-list');
                            }}
                            className="bg-amber-500 px-5 py-3.5 rounded-xl flex-row items-center justify-center active:opacity-80 shadow-lg"
                        >
                            <FontAwesome name="plus" size={14} color="#000" style={{ marginRight: 8 }} />
                            <Text
                                className="text-black font-bold tracking-widest text-xs uppercase"
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                NEW CURATED STACK
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {customLists.length === 0 ? (
                    <View className="items-center justify-center py-16 px-6 bg-neutral-900/30 border border-dashed border-neutral-800 rounded-2xl">
                        <View className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 items-center justify-center mb-4">
                            <Ionicons name="layers-outline" size={32} color="#f59e0b" />
                        </View>
                        <Text
                            className="text-white text-lg uppercase tracking-widest mb-2 text-center"
                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                        >
                            NO CURATED STACKS YET
                        </Text>
                        <Text className="text-neutral-500 font-mono text-xs text-center max-w-md mb-6 leading-relaxed">
                            Create a ranked Top 10, a director spotlight, a Halloween marathon queue, or a trade pile — complete with your own liner notes and shareable link.
                        </Text>
                        <Pressable
                            onPress={() => {
                                playSound('click');
                                router.push('/create-list');
                            }}
                            className="bg-amber-600 px-6 py-3 rounded-xl flex-row items-center gap-2 active:opacity-80"
                        >
                            <FontAwesome name="plus" size={12} color="#fff" />
                            <Text className="text-white font-mono text-xs font-bold tracking-widest uppercase">
                                BUILD YOUR FIRST STACK
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <View style={{ gap: 16 }}>
                        {customLists.map((listName) => {
                            const rawStackItems: CollectionItemWithMedia[] =
                                collection?.filter(
                                    (item: CollectionItemWithMedia) =>
                                        item && item.custom_lists?.includes(listName)
                                ) || [];

                            const meta = getStackMeta(collection, listName);
                            const orderMap = new Map<string, number>();
                            (meta.itemOrder || []).forEach((id, idx) => orderMap.set(id, idx));

                            const stackItems = [...rawStackItems].sort((a, b) => {
                                const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 99999;
                                const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 99999;
                                if (idxA !== idxB) return idxA - idxB;
                                const titleA = a.movies?.title || a.shows?.name || '';
                                const titleB = b.movies?.title || b.shows?.name || '';
                                return titleA.localeCompare(titleB);
                            });

                            const allIds = stackItems.map((i) => i.id);

                            // Unique posters for the fanned collage
                            const previewPosters: { id: string; uri: string | null; format: string }[] = [];
                            const seenMedia = new Set<string>();
                            for (const item of stackItems) {
                                const mediaKey =
                                    item.media_type === 'tv'
                                        ? `tv-${item.show_id || item.shows?.id || item.id}`
                                        : `movie-${item.movie_id || item.movies?.id || item.id}`;
                                if (seenMedia.has(mediaKey)) continue;
                                seenMedia.add(mediaKey);
                                const posterPath = item.movies?.poster_path || item.shows?.poster_path || null;
                                const uri = item.custom_poster_url || getPosterUrl(posterPath, 'w342');
                                previewPosters.push({ id: item.id, uri, format: item.format });
                                if (previewPosters.length >= 4) break;
                            }

                            const uniqueTitleCount = seenMedia.size || stackItems.length;

                            const formatCounts: Partial<Record<MovieFormat, number>> = {};
                            stackItems.forEach((item) => {
                                formatCounts[item.format] = (formatCounts[item.format] || 0) + 1;
                            });

                            return (
                                <View
                                    key={listName}
                                    className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden"
                                >
                                    <Pressable
                                        onPress={() => {
                                            playSound('click');
                                            router.push(`/stack/${encodeURIComponent(listName)}` as any);
                                        }}
                                        className="p-4 md:p-5 flex-row items-center active:opacity-90"
                                    >
                                        {/* Fanned / Overlapping Poster Collage */}
                                        <View
                                            style={{
                                                width: isDesktop ? 136 : 112,
                                                height: isDesktop ? 104 : 90,
                                                marginRight: isDesktop ? 20 : 14,
                                                position: 'relative',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            {previewPosters.length === 0 ? (
                                                <View className="w-16 h-24 rounded-lg bg-neutral-800 border border-neutral-700 items-center justify-center">
                                                    <FontAwesome name="film" size={20} color="#525252" />
                                                </View>
                                            ) : (
                                                previewPosters.map((p, idx) => {
                                                    const spread = isDesktop ? 20 : 15;
                                                    const leftOffset = idx * spread;
                                                    const rotation =
                                                        previewPosters.length > 1
                                                            ? (idx - (previewPosters.length - 1) / 2) * 4
                                                            : 0;
                                                    const zIndex = previewPosters.length - idx;
                                                    return (
                                                        <View
                                                            key={p.id}
                                                            style={{
                                                                position: 'absolute',
                                                                left: leftOffset,
                                                                width: isDesktop ? 64 : 54,
                                                                height: isDesktop ? 96 : 80,
                                                                zIndex,
                                                                transform: [{ rotate: `${rotation}deg` }],
                                                                shadowColor: '#000',
                                                                shadowOffset: { width: 2, height: 4 },
                                                                shadowOpacity: 0.65,
                                                                shadowRadius: 6,
                                                            }}
                                                            className="rounded-md overflow-hidden bg-neutral-800 border border-white/15"
                                                        >
                                                            {p.uri ? (
                                                                <Image
                                                                    source={{ uri: p.uri }}
                                                                    style={{ width: '100%', height: '100%' }}
                                                                    contentFit="cover"
                                                                />
                                                            ) : (
                                                                <View className="flex-1 items-center justify-center bg-neutral-800">
                                                                    <FontAwesome name="film" size={14} color="#525252" />
                                                                </View>
                                                            )}
                                                            {meta.isRanked && idx === 0 && (
                                                                <View className="absolute top-1 left-1 bg-amber-500 px-1.5 py-0.5 rounded">
                                                                    <Text className="text-black font-mono text-[8px] font-black">
                                                                        #1
                                                                    </Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                    );
                                                })
                                            )}
                                        </View>

                                        {/* Stack Details */}
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <View className="flex-row items-center flex-wrap gap-2 mb-1">
                                                <Text
                                                    className="text-white text-lg md:text-xl font-bold uppercase tracking-wide"
                                                    style={{ fontFamily: 'VCR_OSD_MONO' }}
                                                    numberOfLines={1}
                                                >
                                                    {listName}
                                                </Text>
                                                {meta.isRanked && (
                                                    <View className="bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 rounded-full flex-row items-center gap-1">
                                                        <Ionicons name="trophy" size={10} color="#f59e0b" />
                                                        <Text className="text-amber-400 font-mono text-[9px] font-bold uppercase">
                                                            RANKED
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>

                                            {meta.description ? (
                                                <Text
                                                    className="text-neutral-300 font-mono text-xs mb-2.5 leading-relaxed"
                                                    numberOfLines={2}
                                                >
                                                    "{meta.description}"
                                                </Text>
                                            ) : (
                                                <Text className="text-neutral-600 font-mono text-[11px] italic mb-2">
                                                    No liner notes added yet — tap to view or add a blurb.
                                                </Text>
                                            )}

                                            {/* Count + Format Pills */}
                                            <View className="flex-row items-center flex-wrap gap-1.5">
                                                <View className="bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded">
                                                    <Text className="text-neutral-300 font-mono text-[10px] font-bold">
                                                        {uniqueTitleCount} {uniqueTitleCount === 1 ? 'TITLE' : 'TITLES'}
                                                    </Text>
                                                </View>
                                                {Object.entries(formatCounts).map(([fmt, count]) => {
                                                    const style = FORMAT_COLORS[fmt] || {
                                                        bg: 'bg-neutral-800',
                                                        border: 'border-neutral-700',
                                                        text: 'text-neutral-300',
                                                    };
                                                    return (
                                                        <View
                                                            key={fmt}
                                                            className={`px-2 py-0.5 rounded border ${style.bg} ${style.border}`}
                                                        >
                                                            <Text className={`font-mono text-[9px] font-bold ${style.text}`}>
                                                                {count} {fmt === 'BluRay' ? 'Blu-ray' : fmt}
                                                            </Text>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </View>

                                        <Ionicons
                                            name="chevron-forward"
                                            size={18}
                                            color="#737373"
                                            style={{ marginLeft: 8 }}
                                        />
                                    </Pressable>

                                    {/* Action Bar */}
                                    <View className="flex-row items-center justify-between px-4 py-2.5 bg-neutral-950/60 border-t border-neutral-800/80 flex-wrap gap-2">
                                        <View className="flex-row items-center gap-2">
                                            <Pressable
                                                onPress={() => openShareForStack(listName, stackItems)}
                                                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 active:opacity-70"
                                            >
                                                <Ionicons name="share-social-outline" size={12} color="#f59e0b" />
                                                <Text className="text-amber-400 font-mono text-[10px] font-bold">
                                                    SHARE STACK
                                                </Text>
                                            </Pressable>

                                            <Pressable
                                                onPress={() => {
                                                    playSound('click');
                                                    router.push(
                                                        `/create-list?existingListName=${encodeURIComponent(listName)}` as any
                                                    );
                                                }}
                                                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/90 border border-neutral-700 active:opacity-70"
                                            >
                                                <Ionicons name="add-circle-outline" size={12} color="#d4d4d4" />
                                                <Text className="text-neutral-300 font-mono text-[10px] font-bold">
                                                    EDIT / ADD
                                                </Text>
                                            </Pressable>
                                        </View>

                                        <View className="flex-row items-center gap-2">
                                            <Pressable
                                                onPress={() => setDialog({ type: 'rename', listName })}
                                                disabled={renameMutation.isPending}
                                                className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 active:opacity-60"
                                            >
                                                <FontAwesome name="pencil" size={10} color="#a3a3a3" />
                                                <Text className="text-neutral-400 font-mono text-[10px]">RENAME</Text>
                                            </Pressable>

                                            <Pressable
                                                onPress={() =>
                                                    setDialog({ type: 'delete', listName, itemIds: allIds })
                                                }
                                                disabled={removeMutation.isPending}
                                                className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 active:opacity-60"
                                            >
                                                <FontAwesome name="trash" size={10} color="#ef4444" />
                                                <Text className="text-red-500 font-mono text-[10px]">DELETE</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
