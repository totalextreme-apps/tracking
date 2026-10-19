import { ConfirmModal } from '@/components/ConfirmModal';
import { GlossyCard } from '@/components/GlossyCard';
import { ShareModal } from '@/components/ShareModal';
import { StackCard } from '@/components/StackCard';
import { StickerOverlay } from '@/components/StickerOverlay';
import { TrackingLoader } from '@/components/TrackingLoader';
import { VHSCard } from '@/components/VHSCard';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import {
    useBulkUpdateCustomLists,
    useCollection,
    useRenameCustomList,
    useUpdateStackMeta,
} from '@/hooks/useCollection';
import { useCreatePost, useProfile } from '@/hooks/useSocial';
import { getStackMeta } from '@/lib/collection-utils';
import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMedia, MovieFormat } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';

const FORMAT_ORDER: Record<string, number> = {
    '4K': 5,
    'Blu-ray': 4,
    BluRay: 4,
    DVD: 3,
    VHS: 2,
    Digital: 1,
};

const FORMAT_BADGE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
    VHS: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-300' },
    DVD: { bg: 'bg-purple-500/15', border: 'border-purple-500/40', text: 'text-purple-300' },
    BluRay: { bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-300' },
    '4K': { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-300' },
    Digital: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-300' },
};

export default function CuratedStackScreen() {
    const { name, ownerId } = useLocalSearchParams<{ name: string; ownerId?: string }>();
    const decodedName = decodeURIComponent(name || '');
    const { userId } = useAuth();
    const { playSound } = useSound();
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = Platform.OS === 'web' && windowWidth >= 768;

    const targetUserId = ownerId && typeof ownerId === 'string' ? ownerId : userId;
    const isOwner = !ownerId || ownerId === userId;

    const { data: collection, isLoading: collectionLoading } = useCollection(targetUserId);
    const { data: ownerProfile } = useProfile(targetUserId);
    const removeMutation = useBulkUpdateCustomLists(userId);
    const renameMutation = useRenameCustomList(userId);
    const updateMetaMutation = useUpdateStackMeta(userId);
    const createPostMutation = useCreatePost(userId);

    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [confirmRemoveIds, setConfirmRemoveIds] = useState<string[] | null>(null);
    const [shareVisible, setShareVisible] = useState(false);

    // Edit stack details modal state
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editTitle, setEditTitle] = useState(decodedName);
    const [editBlurb, setEditBlurb] = useState('');
    const [editRanked, setEditRanked] = useState(false);

    const meta = useMemo(() => getStackMeta(collection, decodedName), [collection, decodedName]);

    const rawStackItems = useMemo(
        () =>
            collection?.filter(
                (item: CollectionItemWithMedia) => item && item.custom_lists?.includes(decodedName)
            ) || [],
        [collection, decodedName]
    );

    // Group items by title (movie or TV show) while respecting custom rank/itemOrder
    const stacks = useMemo(() => {
        if (rawStackItems.length === 0) return [];

        const orderMap = new Map<string, number>();
        (meta.itemOrder || []).forEach((id, idx) => orderMap.set(id, idx));

        const groups = new Map<string, CollectionItemWithMedia[]>();
        for (const item of rawStackItems) {
            const media = item.movies || item.shows;
            const tmdbId = media?.tmdb_id;
            const key =
                item.media_type === 'tv'
                    ? `tv-${tmdbId || item.show_id || item.shows?.id || item.id}`
                    : `movie-${tmdbId || item.movie_id || item.movies?.id || item.id}`;
            const existing = groups.get(key) || [];
            existing.push(item);
            groups.set(key, existing);
        }

        const grouped: CollectionItemWithMedia[][] = [];
        for (const group of groups.values()) {
            const sortedFormats = [...group].sort((a, b) => {
                if (a.media_type === 'tv' && b.media_type === 'tv') {
                    const sA = a.season_number ?? 0;
                    const sB = b.season_number ?? 0;
                    if (sA !== sB) return sA - sB;
                }
                return (FORMAT_ORDER[b.format] ?? 0) - (FORMAT_ORDER[a.format] ?? 0);
            });
            grouped.push(sortedFormats);
        }

        grouped.sort((a, b) => {
            const bestRankA = Math.min(
                ...a.map((i) => (orderMap.has(i.id) ? orderMap.get(i.id)! : 99999))
            );
            const bestRankB = Math.min(
                ...b.map((i) => (orderMap.has(i.id) ? orderMap.get(i.id)! : 99999))
            );
            if (bestRankA !== bestRankB) return bestRankA - bestRankB;

            const titleA = a[0].movies?.title || a[0].shows?.name || '';
            const titleB = b[0].movies?.title || b[0].shows?.name || '';
            return titleA.localeCompare(titleB);
        });

        return grouped;
    }, [rawStackItems, meta.itemOrder]);

    const formatCounts = useMemo(() => {
        const counts: Partial<Record<MovieFormat, number>> = {};
        rawStackItems.forEach((item) => {
            counts[item.format] = (counts[item.format] || 0) + 1;
        });
        return counts;
    }, [rawStackItems]);

    if (collectionLoading) {
        return (
            <View className="flex-1 bg-neutral-950 items-center justify-center">
                <TrackingLoader label="LOADING STACK" />
            </View>
        );
    }

    const isEmpty = stacks.length === 0;

    const doRemove = async () => {
        if (!confirmRemoveIds || confirmRemoveIds.length === 0) return;
        const ids = confirmRemoveIds;
        setConfirmRemoveIds(null);
        try {
            await removeMutation.mutateAsync({ itemIds: ids, listName: decodedName, isAdding: false });
            playSound('click');
        } catch (e: any) {
            if (Platform.OS !== 'web') Alert.alert('Error', e.message);
        }
    };

    const handleMoveRank = async (index: number, direction: 'up' | 'down') => {
        if (!isOwner) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= stacks.length) return;

        playSound('click');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const reordered = [...stacks];
        const [moved] = reordered.splice(index, 1);
        reordered.splice(targetIndex, 0, moved);

        const newOrderIds = reordered.flatMap((group) => group.map((i) => i.id));

        try {
            await updateMetaMutation.mutateAsync({
                listName: decodedName,
                meta: {
                    ...meta,
                    itemOrder: newOrderIds,
                    updatedAt: Date.now(),
                },
            });
        } catch (e) {
            console.error('Failed to reorder stack:', e);
        }
    };

    const openEditModal = () => {
        playSound('click');
        setEditTitle(decodedName);
        setEditBlurb(meta.description || '');
        setEditRanked(!!meta.isRanked);
        setEditModalVisible(true);
    };

    const handleSaveDetails = async () => {
        const cleanTitle = editTitle.trim();
        if (!cleanTitle) return;

        const currentOrderIds =
            meta.itemOrder && meta.itemOrder.length > 0
                ? meta.itemOrder
                : stacks.flatMap((group) => group.map((i) => i.id));

        const updatedMeta = {
            description: editBlurb.trim(),
            isRanked: editRanked,
            itemOrder: currentOrderIds,
            updatedAt: Date.now(),
        };

        setEditModalVisible(false);
        try {
            if (cleanTitle !== decodedName) {
                await renameMutation.mutateAsync({
                    oldName: decodedName,
                    newName: cleanTitle,
                    meta: updatedMeta,
                });
                router.replace(`/stack/${encodeURIComponent(cleanTitle)}` as any);
            } else {
                await updateMetaMutation.mutateAsync({
                    listName: decodedName,
                    meta: updatedMeta,
                });
            }
            playSound('click');
        } catch (e: any) {
            if (Platform.OS !== 'web') Alert.alert('Error', e.message);
        }
    };

    const handleItemPress = (stack: CollectionItemWithMedia[]) => {
        playSound('click');
        const top = stack[0];
        const ownerParam = targetUserId ? `&ownerId=${targetUserId}` : '';
        if (top.media_type === 'tv' || top.shows) {
            const targetId = top.show_id || top.shows?.id || top.id;
            router.push(
                `/show/${targetId}?season=${top.season_number || 1}&fromStack=${encodeURIComponent(decodedName)}${ownerParam}` as any
            );
        } else {
            const targetId = top.movie_id || top.movies?.id || top.id;
            router.push(
                `/movie/${targetId}?fromStack=${encodeURIComponent(decodedName)}${ownerParam}` as any
            );
        }
    };

    // Build Share messages
    const shareUrl = `https://mediatracking.app/stack/${encodeURIComponent(decodedName)}${
        targetUserId ? `?ownerId=${targetUserId}` : ''
    }`;
    const curatorTag = ownerProfile?.username ? ` by @${ownerProfile.username}` : '';
    const shareLines = stacks.map((stack, idx) => {
        const top = stack[0];
        const rawTitle = top.movies?.title || top.shows?.name || 'Untitled';
        const title =
            top.media_type === 'tv' && top.season_number
                ? `${rawTitle} (S${top.season_number})`
                : rawTitle;
        const dateStr = top.movies?.release_date || top.shows?.first_air_date || '';
        const year = dateStr ? ` (${dateStr.slice(0, 4)})` : '';
        const fmts = Array.from(
            new Set(stack.map((i) => (i.format === 'BluRay' ? 'Blu-ray' : i.format)))
        ).join('/');
        const prefix = meta.isRanked ? `${idx + 1}.` : '•';
        return `${prefix} ${title}${year} [${fmts}]`;
    });
    const blurbSection = meta.description ? `"${meta.description}"\n\n` : '';
    const shareTextMessage = `📼 ${decodedName.toUpperCase()}${
        meta.isRanked ? ' (Ranked Stack)' : ''
    }${curatorTag}\n${blurbSection}${shareLines.join('\n')}\n\nView this Curated Stack on Tracking:\n${shareUrl}`;
    const shareLinkMessage = `Check out "${decodedName}"${curatorTag} on Tracking!\n${
        meta.description ? `"${meta.description}"\n` : ''
    }${shareUrl}`;

    const containerMax = Math.min(windowWidth, 1100);
    const listRowExtraWidth = isOwner ? (meta.isRanked ? 82 : 44) : meta.isRanked ? 42 : 0;
    const cardWidth = containerMax - 32 - listRowExtraWidth;

    const gridCols = isDesktop ? 5 : 3;
    const gridGap = 10;
    const gridItemWidth = (containerMax - 32 - gridGap * (gridCols - 1)) / gridCols;

    return (
        <View className="flex-1 bg-neutral-950">
            {/* Remove Confirmation Modal */}
            <ConfirmModal
                visible={confirmRemoveIds !== null}
                title="Remove from Stack"
                message={`Remove this title from "${decodedName}"?`}
                confirmLabel="REMOVE"
                destructive
                onConfirm={doRemove}
                onCancel={() => setConfirmRemoveIds(null)}
            />

            {/* Edit Stack Details Modal */}
            <Modal
                visible={editModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View className="flex-1 bg-black/80 items-center justify-center px-5">
                    <View className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-md p-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text
                                className="text-amber-500 font-bold text-base uppercase tracking-wider"
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                EDIT STACK DETAILS
                            </Text>
                            <Pressable
                                onPress={() => setEditModalVisible(false)}
                                className="p-1 bg-neutral-900 border border-neutral-800 rounded-full"
                            >
                                <Ionicons name="close" size={16} color="#737373" />
                            </Pressable>
                        </View>

                        <Text className="text-neutral-400 font-mono text-[10px] uppercase mb-1.5">
                            STACK TITLE
                        </Text>
                        <TextInput
                            value={editTitle}
                            onChangeText={setEditTitle}
                            placeholder="Stack title..."
                            placeholderTextColor="#525252"
                            className="bg-neutral-900 border border-neutral-800 text-white font-mono rounded-lg px-3.5 py-2.5 text-sm mb-4"
                        />

                        <Text className="text-neutral-400 font-mono text-[10px] uppercase mb-1.5">
                            BLURB / LINER NOTES
                        </Text>
                        <TextInput
                            value={editBlurb}
                            onChangeText={setEditBlurb}
                            placeholder="Add liner notes or a description for this stack..."
                            placeholderTextColor="#525252"
                            multiline
                            numberOfLines={3}
                            className="bg-neutral-900 border border-neutral-800 text-white font-mono rounded-lg px-3.5 py-2.5 text-xs mb-4"
                            style={{ minHeight: 72, textAlignVertical: 'top' }}
                        />

                        <Pressable
                            onPress={() => {
                                playSound('click');
                                setEditRanked((prev) => !prev);
                            }}
                            className={`flex-row items-center justify-between p-3.5 rounded-xl border mb-6 ${
                                editRanked
                                    ? 'bg-amber-500/15 border-amber-500/50'
                                    : 'bg-neutral-900 border-neutral-800'
                            }`}
                        >
                            <View className="flex-row items-center gap-2.5">
                                <Ionicons
                                    name="trophy"
                                    size={16}
                                    color={editRanked ? '#f59e0b' : '#737373'}
                                />
                                <View>
                                    <Text className="text-white font-mono text-xs font-bold">
                                        RANKED / NUMBERED LIST
                                    </Text>
                                    <Text className="text-neutral-400 font-mono text-[10px]">
                                        Display #1, #2, #3 badges & custom rank order
                                    </Text>
                                </View>
                            </View>
                            <View
                                className={`w-5 h-5 rounded items-center justify-center border ${
                                    editRanked
                                        ? 'bg-amber-500 border-amber-400'
                                        : 'bg-neutral-800 border-neutral-700'
                                }`}
                            >
                                {editRanked && <Ionicons name="checkmark" size={14} color="#000" />}
                            </View>
                        </Pressable>

                        <View className="flex-row justify-end gap-2">
                            <Pressable
                                onPress={() => setEditModalVisible(false)}
                                className="px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800"
                            >
                                <Text className="text-neutral-400 font-mono text-xs font-bold">
                                    CANCEL
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveDetails}
                                className="px-5 py-2.5 rounded-lg bg-amber-500"
                            >
                                <Text className="text-black font-mono text-xs font-bold">
                                    SAVE CHANGES
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Share Modal */}
            <ShareModal
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                title={`SHARE "${decodedName}"`}
                messageLink={shareLinkMessage}
                messageText={shareTextMessage}
                onShareToBoard={
                    isOwner && userId
                        ? async () => {
                              const first = rawStackItems[0];
                              const boardContent = meta.description
                                  ? meta.description
                                  : `Check out my "${decodedName}" Curated Stack (${stacks.length} ${
                                        stacks.length === 1 ? 'title' : 'titles'
                                    })!`;
                              await createPostMutation.mutateAsync({
                                  content: boardContent,
                                  custom_list_name: decodedName,
                                  collection_item_id: first?.id || null,
                                  movie_id: first?.movie_id || null,
                                  show_id: first?.show_id || null,
                              } as any);
                          }
                        : undefined
                }
            />

            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    paddingBottom: 120,
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    maxWidth: 1100,
                    alignSelf: 'center',
                    width: '100%',
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* Top Navigation & Action Bar */}
                <View className="flex-row items-center justify-between mb-4 flex-wrap gap-2">
                    <Pressable
                        onPress={() => {
                            playSound('click');
                            if (isOwner) {
                                router.replace('/lists' as any);
                            } else if (router.canGoBack()) {
                                router.back();
                            } else {
                                router.replace('/(tabs)' as any);
                            }
                        }}
                        className="bg-[#0000FF] px-4 py-1.5 rounded-md active:opacity-80"
                    >
                        <Text
                            className="text-white text-[10px] font-bold uppercase tracking-widest"
                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                        >
                            BACK
                        </Text>
                    </Pressable>

                    <View className="flex-row items-center gap-2 flex-wrap">
                        {/* View Mode Toggle (List / Grid) */}
                        <View className="flex-row bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
                            <Pressable
                                onPress={() => {
                                    playSound('click');
                                    setViewMode('list');
                                }}
                                className={`px-2.5 py-1 rounded-md flex-row items-center gap-1 ${
                                    viewMode === 'list' ? 'bg-amber-500' : ''
                                }`}
                            >
                                <Ionicons
                                    name="list"
                                    size={12}
                                    color={viewMode === 'list' ? '#000' : '#a3a3a3'}
                                />
                                <Text
                                    className={`font-mono text-[10px] font-bold ${
                                        viewMode === 'list' ? 'text-black' : 'text-neutral-400'
                                    }`}
                                >
                                    LIST
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => {
                                    playSound('click');
                                    setViewMode('grid');
                                }}
                                className={`px-2.5 py-1 rounded-md flex-row items-center gap-1 ${
                                    viewMode === 'grid' ? 'bg-amber-500' : ''
                                }`}
                            >
                                <Ionicons
                                    name="grid"
                                    size={11}
                                    color={viewMode === 'grid' ? '#000' : '#a3a3a3'}
                                />
                                <Text
                                    className={`font-mono text-[10px] font-bold ${
                                        viewMode === 'grid' ? 'text-black' : 'text-neutral-400'
                                    }`}
                                >
                                    GRID
                                </Text>
                            </Pressable>
                        </View>

                        {/* Share Button */}
                        <Pressable
                            onPress={() => {
                                playSound('click');
                                setShareVisible(true);
                            }}
                            className="bg-amber-500/15 border border-amber-500/50 px-3.5 py-1.5 rounded-lg flex-row items-center gap-1.5 active:opacity-80"
                        >
                            <Ionicons name="share-social-outline" size={13} color="#f59e0b" />
                            <Text
                                className="text-amber-400 text-[10px] font-bold uppercase tracking-widest"
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                SHARE
                            </Text>
                        </Pressable>

                        {isOwner && (
                            <>
                                <Pressable
                                    onPress={openEditModal}
                                    className="bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-lg flex-row items-center gap-1.5 active:opacity-80"
                                >
                                    <FontAwesome name="pencil" size={11} color="#d4d4d4" />
                                    <Text
                                        className="text-neutral-300 text-[10px] font-bold uppercase tracking-widest"
                                        style={{ fontFamily: 'VCR_OSD_MONO' }}
                                    >
                                        BLURB / RANK
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => {
                                        playSound('click');
                                        router.push(
                                            `/create-list?existingListName=${encodeURIComponent(decodedName)}` as any
                                        );
                                    }}
                                    className="bg-amber-600 px-3.5 py-1.5 rounded-lg active:opacity-80 flex-row items-center gap-1.5"
                                >
                                    <FontAwesome name="plus" size={11} color="#fff" />
                                    <Text
                                        className="text-white text-[10px] font-bold uppercase tracking-widest"
                                        style={{ fontFamily: 'VCR_OSD_MONO' }}
                                    >
                                        ADD / EDIT
                                    </Text>
                                </Pressable>
                            </>
                        )}
                    </View>
                </View>

                {/* Stack Hero Header Card */}
                <View className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 mb-5">
                    {/* Curator Badge */}
                    {ownerProfile?.username && (
                        <Pressable
                            onPress={() => {
                                if (targetUserId) {
                                    playSound('click');
                                    router.push(`/profile/${targetUserId}` as any);
                                }
                            }}
                            className="flex-row items-center gap-2 self-start mb-2.5 bg-neutral-950/70 border border-neutral-800 px-2.5 py-1 rounded-full"
                        >
                            {ownerProfile.avatar_url ? (
                                <Image
                                    source={{ uri: ownerProfile.avatar_url }}
                                    style={{ width: 16, height: 16, borderRadius: 8 }}
                                />
                            ) : (
                                <Ionicons name="person-circle-outline" size={15} color="#f59e0b" />
                            )}
                            <Text className="text-neutral-400 font-mono text-[10px]">
                                CURATED BY{' '}
                                <Text className="text-amber-400 font-bold">
                                    @{ownerProfile.username}
                                </Text>
                            </Text>
                        </Pressable>
                    )}

                    {/* Title + Ranked Pill */}
                    <View className="flex-row items-center flex-wrap gap-2.5 mb-2">
                        <Text
                            className="text-amber-500 text-2xl md:text-3xl font-black tracking-widest uppercase"
                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                        >
                            {decodedName}
                        </Text>
                        {meta.isRanked && (
                            <View className="bg-amber-500/20 border border-amber-500/50 px-2.5 py-1 rounded-full flex-row items-center gap-1">
                                <Ionicons name="trophy" size={12} color="#f59e0b" />
                                <Text className="text-amber-400 font-mono text-[10px] font-bold uppercase">
                                    RANKED LIST
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Blurb / Liner Notes */}
                    {meta.description ? (
                        <View className="bg-neutral-950/70 border-l-2 border-amber-500 pl-3.5 pr-3 py-2.5 rounded-r-lg mb-3.5">
                            <Text className="text-neutral-200 font-mono text-xs leading-relaxed">
                                "{meta.description}"
                            </Text>
                        </View>
                    ) : isOwner ? (
                        <Pressable onPress={openEditModal} className="mb-3 self-start">
                            <Text className="text-neutral-500 font-mono text-xs italic underline">
                                + Add a blurb / liner notes or toggle Ranked mode...
                            </Text>
                        </Pressable>
                    ) : null}

                    {/* Stats & Format Breakdown Pills */}
                    <View className="flex-row items-center flex-wrap gap-2">
                        <View className="bg-neutral-800 border border-neutral-700 px-2.5 py-1 rounded-md">
                            <Text className="text-white font-mono text-[10px] font-bold">
                                {stacks.length} {stacks.length === 1 ? 'TITLE' : 'TITLES'}
                            </Text>
                        </View>
                        {Object.entries(formatCounts).map(([fmt, count]) => {
                            const style = FORMAT_BADGE_STYLES[fmt] || {
                                bg: 'bg-neutral-800',
                                border: 'border-neutral-700',
                                text: 'text-neutral-300',
                            };
                            return (
                                <View
                                    key={fmt}
                                    className={`px-2.5 py-1 rounded-md border ${style.bg} ${style.border}`}
                                >
                                    <Text className={`font-mono text-[10px] font-bold ${style.text}`}>
                                        {count} {fmt === 'BluRay' ? 'Blu-ray' : fmt}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Stack Contents */}
                {isEmpty ? (
                    <View className="items-center justify-center py-20 px-8 bg-neutral-900/30 border border-dashed border-neutral-800 rounded-2xl">
                        <FontAwesome name="film" size={48} color="#262626" />
                        <Text className="text-neutral-500 font-mono text-center mt-6">
                            This stack is currently empty.
                        </Text>
                        {isOwner && (
                            <Pressable
                                onPress={() => {
                                    playSound('click');
                                    router.push(
                                        `/create-list?existingListName=${encodeURIComponent(decodedName)}` as any
                                    );
                                }}
                                className="bg-amber-600 px-6 py-2.5 rounded-xl mt-6 active:opacity-80"
                            >
                                <Text className="text-white font-mono font-bold tracking-widest">
                                    + ADD TITLES
                                </Text>
                            </Pressable>
                        )}
                    </View>
                ) : viewMode === 'grid' ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: gridGap }}>
                        {stacks.map((stack, idx) => {
                            const top = stack[0];
                            const posterPath = top.movies?.poster_path || top.shows?.poster_path || null;
                            const posterUrl = top.custom_poster_url || getPosterUrl(posterPath, 'w500');
                            const isPhysical = top.format !== 'Digital';
                            const showSticker = top.is_on_display && isPhysical && top.status === 'owned';
                            const title = top.movies?.title || top.shows?.name || 'Untitled';

                            return (
                                <Pressable
                                    key={top.id}
                                    onPress={() => handleItemPress(stack)}
                                    style={{ width: gridItemWidth, marginBottom: 8 }}
                                    className="active:opacity-85"
                                >
                                    <View style={{ aspectRatio: 2 / 3, position: 'relative' }}>
                                        {top.format === 'VHS' ? (
                                            <VHSCard
                                                posterUrl={posterUrl}
                                                isCustom={!!top.custom_poster_url}
                                                style={{ width: '100%', height: '100%', borderRadius: 6 }}
                                            />
                                        ) : (
                                            <GlossyCard
                                                posterUrl={posterUrl}
                                                format={top.format}
                                                isCustom={!!top.custom_poster_url}
                                                style={{ width: '100%', height: '100%', borderRadius: 6 }}
                                            />
                                        )}

                                        {showSticker && (
                                            <StickerOverlay
                                                visible={true}
                                                size={Math.max(24, gridItemWidth * 0.26)}
                                            />
                                        )}

                                        {/* Ranked Badge */}
                                        {meta.isRanked && (
                                            <View className="absolute top-1.5 left-1.5 bg-amber-500 border-2 border-black px-2 py-0.5 rounded-md shadow">
                                                <Text
                                                    className="text-black font-black text-xs"
                                                    style={{ fontFamily: 'VCR_OSD_MONO' }}
                                                >
                                                    #{idx + 1}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Format pill */}
                                        <View className="absolute bottom-1.5 right-1.5 bg-black/85 border border-white/20 px-1.5 py-0.5 rounded">
                                            <Text className="text-white font-mono text-[8px] font-bold">
                                                {stack
                                                    .map((i) => (i.format === 'BluRay' ? 'BLU' : i.format))
                                                    .join('/')}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text
                                        className="text-neutral-200 font-mono text-[10px] font-bold mt-1.5 text-center"
                                        numberOfLines={1}
                                    >
                                        {meta.isRanked ? `${idx + 1}. ` : ''}
                                        {title}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : (
                    stacks.map((stack, idx) => {
                        const groupIds = stack.map((i) => i.id);
                        return (
                            <View key={stack[0].id} className="flex-row items-center mb-2.5">
                                {/* Rank Badge on the left if Ranked */}
                                {meta.isRanked && (
                                    <View className="w-9 h-16 mr-1.5 rounded-lg bg-neutral-900 border border-amber-500/40 items-center justify-center">
                                        <Text
                                            className="text-amber-400 text-sm font-black"
                                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                                        >
                                            #{idx + 1}
                                        </Text>
                                    </View>
                                )}

                                {/* Stack card */}
                                <View style={{ flex: 1 }}>
                                    <StackCard
                                        stack={stack}
                                        mode="list"
                                        width={cardWidth}
                                        height={76}
                                        stackOffset={4}
                                        onPress={() => handleItemPress(stack)}
                                    />
                                </View>

                                {/* Owner Controls: Up/Down Rank Reorder + Remove */}
                                {isOwner && (
                                    <View className="flex-row items-center ml-2 gap-1">
                                        {meta.isRanked && (
                                            <View className="gap-1">
                                                <Pressable
                                                    onPress={() => handleMoveRank(idx, 'up')}
                                                    disabled={idx === 0 || updateMetaMutation.isPending}
                                                    className={`w-8 h-8 items-center justify-center rounded bg-neutral-900 border border-neutral-800 ${
                                                        idx === 0 ? 'opacity-30' : 'active:bg-neutral-800'
                                                    }`}
                                                >
                                                    <Ionicons name="chevron-up" size={14} color="#f59e0b" />
                                                </Pressable>
                                                <Pressable
                                                    onPress={() => handleMoveRank(idx, 'down')}
                                                    disabled={
                                                        idx === stacks.length - 1 ||
                                                        updateMetaMutation.isPending
                                                    }
                                                    className={`w-8 h-8 items-center justify-center rounded bg-neutral-900 border border-neutral-800 ${
                                                        idx === stacks.length - 1
                                                            ? 'opacity-30'
                                                            : 'active:bg-neutral-800'
                                                    }`}
                                                >
                                                    <Ionicons name="chevron-down" size={14} color="#f59e0b" />
                                                </Pressable>
                                            </View>
                                        )}

                                        <Pressable
                                            onPress={() => setConfirmRemoveIds(groupIds)}
                                            disabled={removeMutation.isPending}
                                            className="w-9 h-9 items-center justify-center rounded-md bg-neutral-900 border border-neutral-800 active:opacity-60"
                                            hitSlop={8}
                                        >
                                            <FontAwesome name="trash" size={14} color="#ef4444" />
                                        </Pressable>
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}

                {/* Visitor Call-to-Action Banner to draw new users to Tracking */}
                {!isOwner && (
                    <View className="mt-8 bg-neutral-900/90 border border-amber-500/30 rounded-2xl p-5 items-center">
                        <Text
                            className="text-amber-500 text-base font-bold uppercase tracking-widest mb-1 text-center"
                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                        >
                            BUILD YOUR OWN VIDEO STORE ON TRACKING
                        </Text>
                        <Text className="text-neutral-400 font-mono text-xs text-center max-w-md mb-4">
                            Catalog your VHS, 4K, Blu-ray & DVD collection, hunt for grails in Thrift Mode, and share your own Curated Stacks.
                        </Text>
                        <View className="flex-row items-center gap-3 flex-wrap justify-center">
                            {targetUserId && ownerProfile?.username && (
                                <Pressable
                                    onPress={() => router.push(`/profile/${targetUserId}` as any)}
                                    className="bg-neutral-800 border border-neutral-700 px-4 py-2.5 rounded-xl"
                                >
                                    <Text className="text-white font-mono text-xs font-bold">
                                        VIEW @{ownerProfile.username.toUpperCase()}'S FULL COLLECTION
                                    </Text>
                                </Pressable>
                            )}
                            <Pressable
                                onPress={() => router.push('/lists' as any)}
                                className="bg-amber-500 px-5 py-2.5 rounded-xl"
                            >
                                <Text className="text-black font-mono text-xs font-bold">
                                    CREATE YOUR OWN STACK →
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
