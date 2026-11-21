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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface ActiveDragState {
    activeKey: string;
    startIndex: number;
    currentIndex: number;
    dx: number;
    dy: number;
    mode: 'grid' | 'list';
}

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

    // Default to Grid view
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isReorderMode, setIsReorderMode] = useState(false);
    const [confirmRemoveIds, setConfirmRemoveIds] = useState<string[] | null>(null);
    const [shareVisible, setShareVisible] = useState(false);

    // Quick "Jump to Rank #" modal when tapping a rank badge
    const [jumpRankFromIndex, setJumpRankFromIndex] = useState<number | null>(null);

    // Optimistic item order IDs and ranked toggle for instant zero-lag updates
    const [optimisticOrderIds, setOptimisticOrderIds] = useState<string[] | null>(null);
    const [optimisticRanked, setOptimisticRanked] = useState<boolean | null>(null);

    // Drag-and-drop state
    const [dragState, setDragState] = useState<ActiveDragState | null>(null);
    const [measuredGridHeight, setMeasuredGridHeight] = useState<number>(0);
    const [measuredListHeight, setMeasuredListHeight] = useState<number>(86);

    // Edit stack details modal state
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editTitle, setEditTitle] = useState(decodedName);
    const [editBlurb, setEditBlurb] = useState('');
    const [editRanked, setEditRanked] = useState(false);

    const meta = useMemo(() => getStackMeta(collection, decodedName), [collection, decodedName]);
    const isRanked = optimisticRanked !== null ? optimisticRanked : !!meta.isRanked;

    // Sync optimistic state when collection meta updates
    useEffect(() => {
        setOptimisticOrderIds(null);
        setOptimisticRanked(null);
    }, [meta.updatedAt, decodedName]);

    const rawStackItems = useMemo(
        () =>
            collection?.filter(
                (item: CollectionItemWithMedia) => item && item.custom_lists?.includes(decodedName)
            ) || [],
        [collection, decodedName]
    );

    const activeOrderIds = optimisticOrderIds ?? meta.itemOrder ?? [];

    // Group items by title (movie or TV show) while respecting custom rank/itemOrder
    const baseStacks = useMemo(() => {
        if (rawStackItems.length === 0) return [];

        const orderMap = new Map<string, number>();
        activeOrderIds.forEach((id, idx) => orderMap.set(id, idx));

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
    }, [rawStackItems, activeOrderIds]);

    // Live-reordered stacks during active drag
    const stacks = useMemo(() => {
        if (!dragState) return baseStacks;
        const { startIndex, currentIndex } = dragState;
        if (
            startIndex < 0 ||
            startIndex >= baseStacks.length ||
            currentIndex < 0 ||
            currentIndex >= baseStacks.length ||
            startIndex === currentIndex
        ) {
            return baseStacks;
        }
        const copy = [...baseStacks];
        const [moved] = copy.splice(startIndex, 1);
        copy.splice(currentIndex, 0, moved);
        return copy;
    }, [baseStacks, dragState]);

    const formatCounts = useMemo(() => {
        const counts: Partial<Record<MovieFormat, number>> = {};
        rawStackItems.forEach((item) => {
            counts[item.format] = (counts[item.format] || 0) + 1;
        });
        return counts;
    }, [rawStackItems]);

    const containerMax = Math.min(windowWidth, 1100);
    const listRowExtraWidth = isOwner ? 86 : isRanked ? 44 : 0;
    const cardWidth = containerMax - 32 - listRowExtraWidth;

    const gridCols = isDesktop ? 5 : 3;
    const gridGap = 10;
    const gridItemWidth = (containerMax - 32 - gridGap * (gridCols - 1)) / gridCols;
    const gridStepX = gridItemWidth + gridGap;
    const gridStepY =
        (measuredGridHeight > 0 ? measuredGridHeight : gridItemWidth * 1.5 + 24) + gridGap + 8;

    const commitReorderedStacks = useCallback(
        (reordered: CollectionItemWithMedia[][]) => {
            const newOrderIds = reordered.flatMap((group) => group.map((i) => i.id));
            setOptimisticOrderIds(newOrderIds);
            playSound('click');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            updateMetaMutation.mutate({
                listName: decodedName,
                meta: {
                    ...meta,
                    isRanked,
                    itemOrder: newOrderIds,
                    updatedAt: Date.now(),
                },
            });
        },
        [decodedName, meta, isRanked, playSound, updateMetaMutation]
    );

    const handleToggleRankedQuick = useCallback(() => {
        if (!isOwner) return;
        const nextRanked = !isRanked;
        setOptimisticRanked(nextRanked);
        playSound('click');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const currentOrderIds =
            activeOrderIds.length > 0
                ? activeOrderIds
                : baseStacks.flatMap((group) => group.map((i) => i.id));

        updateMetaMutation.mutate({
            listName: decodedName,
            meta: {
                ...meta,
                isRanked: nextRanked,
                itemOrder: currentOrderIds,
                updatedAt: Date.now(),
            },
        });
    }, [isOwner, isRanked, playSound, activeOrderIds, baseStacks, updateMetaMutation, decodedName, meta]);

    const handleMoveToIndex = useCallback(
        (fromIndex: number, toIndex: number) => {
            if (!isOwner) return;
            if (
                fromIndex < 0 ||
                fromIndex >= baseStacks.length ||
                toIndex < 0 ||
                toIndex >= baseStacks.length ||
                fromIndex === toIndex
            ) {
                return;
            }
            const reordered = [...baseStacks];
            const [moved] = reordered.splice(fromIndex, 1);
            reordered.splice(toIndex, 0, moved);
            commitReorderedStacks(reordered);
        },
        [isOwner, baseStacks, commitReorderedStacks]
    );

    // Mutable ref for active drag tracking so window/touch listeners always have fresh geometry
    const dragRef = useRef<{
        activeKey: string;
        startIndex: number;
        currentIndex: number;
        startX: number;
        startY: number;
        mode: 'grid' | 'list';
        hasMoved: boolean;
        baseSnapshot: CollectionItemWithMedia[][];
        gridCols: number;
        gridStepX: number;
        gridStepY: number;
        listStepY: number;
    } | null>(null);

    const updateDragPosition = useCallback((clientX: number, clientY: number) => {
        const ref = dragRef.current;
        if (!ref) return;

        const dx = clientX - ref.startX;
        const dy = clientY - ref.startY;

        if (!ref.hasMoved && Math.hypot(dx, dy) < 4) {
            return;
        }
        ref.hasMoved = true;

        const totalItems = ref.baseSnapshot.length;
        let nextIndex = ref.startIndex;

        if (ref.mode === 'grid') {
            const startCol = ref.startIndex % ref.gridCols;
            const startRow = Math.floor(ref.startIndex / ref.gridCols);
            const totalRows = Math.ceil(totalItems / ref.gridCols);

            const hoverCol = Math.max(
                0,
                Math.min(ref.gridCols - 1, Math.round((startCol * ref.gridStepX + dx) / ref.gridStepX))
            );
            const hoverRow = Math.max(
                0,
                Math.min(totalRows - 1, Math.round((startRow * ref.gridStepY + dy) / ref.gridStepY))
            );
            nextIndex = Math.max(0, Math.min(totalItems - 1, hoverRow * ref.gridCols + hoverCol));
        } else {
            nextIndex = Math.max(
                0,
                Math.min(totalItems - 1, Math.round((ref.startIndex * ref.listStepY + dy) / ref.listStepY))
            );
        }

        if (nextIndex !== ref.currentIndex) {
            ref.currentIndex = nextIndex;
            Haptics.selectionAsync();
        }

        setDragState({
            activeKey: ref.activeKey,
            startIndex: ref.startIndex,
            currentIndex: ref.currentIndex,
            dx,
            dy,
            mode: ref.mode,
        });
    }, []);

    const finishDrag = useCallback(() => {
        const ref = dragRef.current;
        if (!ref) return;
        dragRef.current = null;
        setDragState(null);

        if (ref.hasMoved && ref.currentIndex !== ref.startIndex) {
            const reordered = [...ref.baseSnapshot];
            const [moved] = reordered.splice(ref.startIndex, 1);
            reordered.splice(ref.currentIndex, 0, moved);
            commitReorderedStacks(reordered);
        }
    }, [commitReorderedStacks]);

    const beginDrag = useCallback(
        (
            clientX: number,
            clientY: number,
            key: string,
            index: number,
            mode: 'grid' | 'list',
            immediate = false
        ) => {
            if (!isOwner) return;

            dragRef.current = {
                activeKey: key,
                startIndex: index,
                currentIndex: index,
                startX: clientX,
                startY: clientY,
                mode,
                hasMoved: immediate,
                baseSnapshot: baseStacks,
                gridCols,
                gridStepX,
                gridStepY,
                listStepY: measuredListHeight > 0 ? measuredListHeight : 86,
            };

            if (immediate) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setDragState({
                    activeKey: key,
                    startIndex: index,
                    currentIndex: index,
                    dx: 0,
                    dy: 0,
                    mode,
                });
            }

            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const onTouchMove = (ev: TouchEvent) => {
                    if (!dragRef.current) return;
                    // Crucial for iOS Safari / Mobile Web: prevent native page scroll while dragging
                    if (ev.cancelable) ev.preventDefault();
                    const t = ev.touches[0];
                    if (t) updateDragPosition(t.clientX, t.clientY);
                };
                const onMouseMove = (ev: MouseEvent) => {
                    if (!dragRef.current) return;
                    if (dragRef.current.hasMoved) ev.preventDefault();
                    updateDragPosition(ev.clientX, ev.clientY);
                };
                const onEnd = () => {
                    window.removeEventListener('touchmove', onTouchMove);
                    window.removeEventListener('touchend', onEnd);
                    window.removeEventListener('touchcancel', onEnd);
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onEnd);
                    finishDrag();
                };
                window.addEventListener('touchmove', onTouchMove, { passive: false });
                window.addEventListener('touchend', onEnd);
                window.addEventListener('touchcancel', onEnd);
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onEnd);
            }
        },
        [
            isOwner,
            baseStacks,
            gridCols,
            gridStepX,
            gridStepY,
            measuredListHeight,
            updateDragPosition,
            finishDrag,
        ]
    );

    // Helper to create cross-platform drag props for any handle or card
    const makeDragProps = (key: string, idx: number, mode: 'grid' | 'list', stopProp = false) => {
        if (!isOwner) return {};
        if (Platform.OS === 'web') {
            return {
                onTouchStart: (e: any) => {
                    if (stopProp && e.stopPropagation) e.stopPropagation();
                    const t = e.nativeEvent?.touches?.[0] || e.touches?.[0];
                    if (t) beginDrag(t.clientX, t.clientY, key, idx, mode, true);
                },
                onMouseDown: (e: any) => {
                    if (stopProp && e.stopPropagation) e.stopPropagation();
                    if (e.button !== undefined && e.button !== 0) return;
                    beginDrag(e.clientX, e.clientY, key, idx, mode, false);
                },
                onDragStart: (e: any) => e.preventDefault(),
            } as any;
        }
        return {
            onTouchStart: (e: any) => {
                if (stopProp && e.stopPropagation) e.stopPropagation();
                beginDrag(e.nativeEvent.pageX, e.nativeEvent.pageY, key, idx, mode, true);
            },
            onTouchMove: (e: any) => {
                if (stopProp && e.stopPropagation) e.stopPropagation();
                updateDragPosition(e.nativeEvent.pageX, e.nativeEvent.pageY);
            },
            onTouchEnd: (e: any) => {
                if (stopProp && e.stopPropagation) e.stopPropagation();
                finishDrag();
            },
            onTouchCancel: () => finishDrag(),
        };
    };

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

    const openEditModal = () => {
        playSound('click');
        setEditTitle(decodedName);
        setEditBlurb(meta.description || '');
        setEditRanked(isRanked);
        setEditModalVisible(true);
    };

    const handleSaveDetails = async () => {
        const cleanTitle = editTitle.trim();
        if (!cleanTitle) return;

        const currentOrderIds =
            activeOrderIds.length > 0
                ? activeOrderIds
                : stacks.flatMap((group) => group.map((i) => i.id));

        const updatedMeta = {
            description: editBlurb.trim(),
            isRanked: editRanked,
            itemOrder: currentOrderIds,
            updatedAt: Date.now(),
        };

        setOptimisticRanked(editRanked);
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
        if (dragState) return;
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
        const prefix = isRanked ? `${idx + 1}.` : '•';
        return `${prefix} ${title}${year} [${fmts}]`;
    });
    const blurbSection = meta.description ? `"${meta.description}"\n\n` : '';
    const shareTextMessage = `📼 ${decodedName.toUpperCase()}${
        isRanked ? ' (Ranked Stack)' : ''
    }${curatorTag}\n${blurbSection}${shareLines.join('\n')}\n\nView this Curated Stack on Tracking:\n${shareUrl}`;
    const shareLinkMessage = `Check out "${decodedName}"${curatorTag} on Tracking!\n${
        meta.description ? `"${meta.description}"\n` : ''
    }${shareUrl}`;

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

            {/* Quick Jump to Position Modal */}
            <Modal
                visible={jumpRankFromIndex !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setJumpRankFromIndex(null)}
            >
                <Pressable
                    onPress={() => setJumpRankFromIndex(null)}
                    className="flex-1 bg-black/80 items-center justify-center px-5"
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-sm p-5"
                    >
                        <View className="flex-row items-center justify-between mb-3">
                            <View className="flex-1 pr-2">
                                <Text
                                    className="text-amber-500 font-bold text-sm uppercase tracking-wider"
                                    style={{ fontFamily: 'VCR_OSD_MONO' }}
                                >
                                    MOVE TO POSITION #
                                </Text>
                                {jumpRankFromIndex !== null && baseStacks[jumpRankFromIndex] && (
                                    <Text className="text-neutral-400 font-mono text-xs mt-0.5" numberOfLines={1}>
                                        {baseStacks[jumpRankFromIndex][0]?.movies?.title ||
                                            baseStacks[jumpRankFromIndex][0]?.shows?.name}
                                    </Text>
                                )}
                            </View>
                            <Pressable
                                onPress={() => setJumpRankFromIndex(null)}
                                className="p-1.5 bg-neutral-900 border border-neutral-800 rounded-full"
                            >
                                <Ionicons name="close" size={16} color="#737373" />
                            </Pressable>
                        </View>

                        <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                            <View className="flex-row flex-wrap gap-2 py-1">
                                {baseStacks.map((_, targetIdx) => {
                                    const isCurrent = targetIdx === jumpRankFromIndex;
                                    return (
                                        <Pressable
                                            key={targetIdx}
                                            onPress={() => {
                                                if (jumpRankFromIndex !== null) {
                                                    handleMoveToIndex(jumpRankFromIndex, targetIdx);
                                                }
                                                setJumpRankFromIndex(null);
                                            }}
                                            className={`px-3.5 py-2 rounded-lg border min-w-[52px] items-center ${
                                                isCurrent
                                                    ? 'bg-amber-500 border-amber-400'
                                                    : 'bg-neutral-900 border-neutral-800 active:bg-neutral-800'
                                            }`}
                                        >
                                            <Text
                                                className={`font-black text-xs ${
                                                    isCurrent ? 'text-black' : 'text-amber-400'
                                                }`}
                                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                                            >
                                                #{targetIdx + 1}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

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
                                        Display #1, #2, #3 badges on posters
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
                scrollEnabled={dragState === null && !isReorderMode}
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
                {/* ROW 1: BACK + VIEW TOGGLE (GRID / LIST) + SHARE */}
                <View className="flex-row items-center justify-between mb-2.5 w-full">
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
                        className="bg-[#0000FF] px-3.5 py-2 rounded-lg active:opacity-80"
                    >
                        <Text
                            className="text-white text-[10px] font-bold uppercase tracking-widest"
                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                        >
                            BACK
                        </Text>
                    </Pressable>

                    <View className="flex-row items-center gap-2">
                        {/* View Mode Toggle (GRID first by default, then LIST) */}
                        <View className="flex-row bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
                            <Pressable
                                onPress={() => {
                                    playSound('click');
                                    setViewMode('grid');
                                }}
                                className={`px-3 py-1.5 rounded-md flex-row items-center gap-1.5 ${
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
                            <Pressable
                                onPress={() => {
                                    playSound('click');
                                    setViewMode('list');
                                }}
                                className={`px-3 py-1.5 rounded-md flex-row items-center gap-1.5 ${
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
                        </View>

                        {/* Share Button */}
                        <Pressable
                            onPress={() => {
                                playSound('click');
                                setShareVisible(true);
                            }}
                            className="bg-amber-500/15 border border-amber-500/50 px-3.5 py-2 rounded-lg flex-row items-center gap-1.5 active:opacity-80"
                        >
                            <Ionicons name="share-social-outline" size={13} color="#f59e0b" />
                            <Text
                                className="text-amber-400 text-[10px] font-bold uppercase tracking-widest"
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                SHARE
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* ROW 2: OWNER ACTION BAR (4 Equal-Width Buttons — Never Overflows Screen) */}
                {isOwner && (
                    <View className="flex-row items-center gap-1.5 mb-3.5 w-full">
                        {stacks.length > 1 && (
                            <Pressable
                                onPress={() => {
                                    playSound('click');
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setIsReorderMode((prev) => !prev);
                                }}
                                className={`flex-1 py-2 px-2 rounded-lg border flex-row items-center justify-center gap-1 ${
                                    isReorderMode
                                        ? 'bg-amber-500 border-amber-400'
                                        : 'bg-neutral-900 border-amber-500/40'
                                }`}
                            >
                                <Ionicons
                                    name="move"
                                    size={12}
                                    color={isReorderMode ? '#000' : '#f59e0b'}
                                />
                                <Text
                                    numberOfLines={1}
                                    className={`text-[10px] font-bold uppercase ${
                                        isReorderMode ? 'text-black' : 'text-amber-400'
                                    }`}
                                    style={{ fontFamily: 'VCR_OSD_MONO' }}
                                >
                                    {isReorderMode ? 'DONE' : 'REORDER'}
                                </Text>
                            </Pressable>
                        )}

                        <Pressable
                            onPress={handleToggleRankedQuick}
                            className={`flex-1 py-2 px-2 rounded-lg border flex-row items-center justify-center gap-1 ${
                                isRanked
                                    ? 'bg-amber-500/20 border-amber-500'
                                    : 'bg-neutral-900 border-neutral-800'
                            }`}
                        >
                            <Ionicons
                                name="trophy"
                                size={11}
                                color={isRanked ? '#f59e0b' : '#737373'}
                            />
                            <Text
                                numberOfLines={1}
                                className={`text-[10px] font-bold uppercase ${
                                    isRanked ? 'text-amber-400' : 'text-neutral-400'
                                }`}
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                {isRanked ? 'RANKED #' : 'UNRANKED'}
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={openEditModal}
                            className="flex-1 bg-neutral-900 border border-neutral-800 py-2 px-2 rounded-lg flex-row items-center justify-center gap-1 active:opacity-80"
                        >
                            <FontAwesome name="pencil" size={10} color="#d4d4d4" />
                            <Text
                                numberOfLines={1}
                                className="text-neutral-300 text-[10px] font-bold uppercase"
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                BLURB
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => {
                                playSound('click');
                                router.push(
                                    `/create-list?existingListName=${encodeURIComponent(decodedName)}` as any
                                );
                            }}
                            className="flex-1 bg-amber-600 py-2 px-2 rounded-lg active:opacity-80 flex-row items-center justify-center gap-1"
                        >
                            <FontAwesome name="plus" size={10} color="#fff" />
                            <Text
                                numberOfLines={1}
                                className="text-white text-[10px] font-bold uppercase"
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                TITLES
                            </Text>
                        </Pressable>
                    </View>
                )}

                {/* Stack Hero Header Card */}
                <View className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 md:p-5 mb-4">
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
                        {isRanked && (
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
                        <Pressable
                            onPress={isOwner ? openEditModal : undefined}
                            className="bg-neutral-950/70 border-l-2 border-amber-500 pl-3.5 pr-3 py-2.5 rounded-r-lg mb-3.5"
                        >
                            <Text className="text-neutral-200 font-mono text-xs leading-relaxed">
                                "{meta.description}"
                            </Text>
                        </Pressable>
                    ) : isOwner ? (
                        <Pressable onPress={openEditModal} className="mb-3 self-start">
                            <Text className="text-neutral-500 font-mono text-xs italic underline">
                                + Add a blurb / liner notes...
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

                {/* Active Reorder Banner */}
                {isOwner && isReorderMode && (
                    <View className="mb-4 px-3.5 py-2.5 rounded-xl border bg-amber-500/15 border-amber-500/60 flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2 flex-1 pr-2">
                            <Ionicons name="move" size={14} color="#f59e0b" />
                            <Text className="text-amber-300 font-mono text-[11px] flex-1">
                                DRAG MODE ACTIVE: Touch & drag any poster to reorder, or tap # to jump to a position.
                            </Text>
                        </View>
                        <Pressable
                            onPress={() => {
                                playSound('click');
                                setIsReorderMode(false);
                            }}
                            className="px-3 py-1 rounded-md bg-amber-500"
                        >
                            <Text className="text-black font-mono text-[10px] font-bold">
                                DONE
                            </Text>
                        </Pressable>
                    </View>
                )}

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
                            const isDraggingThis = dragState?.activeKey === top.id;

                            // Compute smooth residual translation while dragging in grid
                            let translateX = 0;
                            let translateY = 0;
                            if (isDraggingThis && dragState) {
                                const startCol = dragState.startIndex % gridCols;
                                const startRow = Math.floor(dragState.startIndex / gridCols);
                                const currCol = idx % gridCols;
                                const currRow = Math.floor(idx / gridCols);
                                translateX = dragState.dx - (currCol - startCol) * gridStepX;
                                translateY = dragState.dy - (currRow - startRow) * gridStepY;
                            }

                            const canDragCardDirectly = isOwner && isReorderMode;

                            return (
                                <View
                                    key={top.id}
                                    onLayout={
                                        idx === 0
                                            ? (e) => {
                                                  const h = e.nativeEvent.layout.height;
                                                  if (h > 0 && Math.abs(h - measuredGridHeight) > 2) {
                                                      setMeasuredGridHeight(h);
                                                  }
                                              }
                                            : undefined
                                    }
                                    {...(canDragCardDirectly ? makeDragProps(top.id, idx, 'grid', false) : {})}
                                    style={[
                                        {
                                            width: gridItemWidth,
                                            marginBottom: 8,
                                            zIndex: isDraggingThis ? 999 : 1,
                                            transform: isDraggingThis
                                                ? [
                                                      { translateX },
                                                      { translateY },
                                                      { scale: 1.05 },
                                                  ]
                                                : [],
                                        },
                                        canDragCardDirectly && Platform.OS === 'web'
                                            ? ({
                                                  touchAction: 'none',
                                                  userSelect: 'none',
                                                  WebkitUserSelect: 'none',
                                                  cursor: isDraggingThis ? 'grabbing' : 'grab',
                                              } as any)
                                            : null,
                                    ]}
                                >
                                    <Pressable
                                        onPress={() => {
                                            if (canDragCardDirectly) return;
                                            handleItemPress(stack);
                                        }}
                                        disabled={isDraggingThis}
                                        className="active:opacity-90"
                                    >
                                        <View
                                            style={{
                                                aspectRatio: 2 / 3,
                                                position: 'relative',
                                                borderRadius: 8,
                                                borderWidth: isDraggingThis
                                                    ? 2.5
                                                    : canDragCardDirectly
                                                      ? 1.5
                                                      : 0,
                                                borderColor: isDraggingThis
                                                    ? '#f59e0b'
                                                    : canDragCardDirectly
                                                      ? 'rgba(245, 158, 11, 0.5)'
                                                      : 'transparent',
                                            }}
                                        >
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

                                            {/* Top-Left Drag Handle / Rank Badge (Shown when Ranked OR for Owner) */}
                                            {(isRanked || isOwner) && (
                                                <View
                                                    {...(isOwner ? makeDragProps(top.id, idx, 'grid', true) : {})}
                                                    style={[
                                                        {
                                                            position: 'absolute',
                                                            top: 6,
                                                            left: 6,
                                                            zIndex: 20,
                                                        },
                                                        isOwner && Platform.OS === 'web'
                                                            ? ({
                                                                  touchAction: 'none',
                                                                  userSelect: 'none',
                                                                  WebkitUserSelect: 'none',
                                                                  cursor: 'grab',
                                                              } as any)
                                                            : null,
                                                    ]}
                                                >
                                                    <Pressable
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            if (!isOwner) return;
                                                            playSound('click');
                                                            setJumpRankFromIndex(idx);
                                                        }}
                                                        className={`border-2 border-black px-2 py-1 rounded-md shadow flex-row items-center gap-1 ${
                                                            isRanked
                                                                ? 'bg-amber-500'
                                                                : 'bg-black/80 border-white/25'
                                                        }`}
                                                    >
                                                        {isRanked && (
                                                            <Text
                                                                className="text-black font-black text-xs"
                                                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                                                            >
                                                                #{idx + 1}
                                                            </Text>
                                                        )}
                                                        {isOwner && (
                                                            <Ionicons
                                                                name="reorder-two"
                                                                size={13}
                                                                color={isRanked ? '#000' : '#f59e0b'}
                                                            />
                                                        )}
                                                    </Pressable>
                                                </View>
                                            )}

                                            {/* Remove button in top-right when in Reorder Mode */}
                                            {isOwner && isReorderMode && (
                                                <Pressable
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmRemoveIds(stack.map((i) => i.id));
                                                    }}
                                                    className="absolute top-1.5 right-1.5 bg-red-600/90 border border-black w-6 h-6 rounded-full items-center justify-center z-20"
                                                >
                                                    <Ionicons name="close" size={14} color="#fff" />
                                                </Pressable>
                                            )}

                                            {/* Format pill */}
                                            <View className="absolute bottom-1.5 right-1.5 bg-black/85 border border-white/20 px-1.5 py-0.5 rounded">
                                                <Text className="text-white font-mono text-[8px] font-bold">
                                                    {stack
                                                        .map((i) =>
                                                            i.format === 'BluRay' ? 'BLU' : i.format
                                                        )
                                                        .join('/')}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text
                                            className="text-neutral-200 font-mono text-[10px] font-bold mt-1.5 text-center"
                                            numberOfLines={1}
                                        >
                                            {isRanked ? `${idx + 1}. ` : ''}
                                            {title}
                                        </Text>
                                    </Pressable>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    stacks.map((stack, idx) => {
                        const top = stack[0];
                        const groupIds = stack.map((i) => i.id);
                        const isDraggingThis = dragState?.activeKey === top.id;
                        const listStep = measuredListHeight > 0 ? measuredListHeight : 86;
                        const translateY =
                            isDraggingThis && dragState
                                ? dragState.dy - (idx - dragState.startIndex) * listStep
                                : 0;
                        const canDragRowDirectly = isOwner && isReorderMode;

                        return (
                            <View
                                key={top.id}
                                onLayout={
                                    idx === 0
                                        ? (e) => {
                                              const h = e.nativeEvent.layout.height + 10;
                                              if (h > 20 && Math.abs(h - measuredListHeight) > 2) {
                                                  setMeasuredListHeight(h);
                                              }
                                          }
                                        : undefined
                                }
                                {...(canDragRowDirectly ? makeDragProps(top.id, idx, 'list', false) : {})}
                                style={[
                                    {
                                        zIndex: isDraggingThis ? 999 : 1,
                                        transform: isDraggingThis
                                            ? [{ translateY }, { scale: 1.02 }]
                                            : [],
                                    },
                                    canDragRowDirectly && Platform.OS === 'web'
                                        ? ({
                                              touchAction: 'none',
                                              userSelect: 'none',
                                              WebkitUserSelect: 'none',
                                              cursor: isDraggingThis ? 'grabbing' : 'grab',
                                          } as any)
                                        : null,
                                ]}
                                className="flex-row items-center mb-2.5"
                            >
                                {/* Draggable Handle on the left (always shown for Owner or Ranked) */}
                                {(isRanked || isOwner) && (
                                    <View
                                        {...(isOwner ? makeDragProps(top.id, idx, 'list', true) : {})}
                                        style={
                                            isOwner && Platform.OS === 'web'
                                                ? ({
                                                      touchAction: 'none',
                                                      userSelect: 'none',
                                                      WebkitUserSelect: 'none',
                                                      cursor: 'grab',
                                                  } as any)
                                                : undefined
                                        }
                                    >
                                        <Pressable
                                            onPress={() => {
                                                if (!isOwner) return;
                                                playSound('click');
                                                setJumpRankFromIndex(idx);
                                            }}
                                            className={`w-10 h-16 mr-1.5 rounded-lg border items-center justify-center ${
                                                isDraggingThis
                                                    ? 'bg-amber-500 border-amber-300'
                                                    : 'bg-neutral-900 border-amber-500/40'
                                            }`}
                                        >
                                            {isRanked && (
                                                <Text
                                                    className={`text-sm font-black ${
                                                        isDraggingThis ? 'text-black' : 'text-amber-400'
                                                    }`}
                                                    style={{ fontFamily: 'VCR_OSD_MONO' }}
                                                >
                                                    #{idx + 1}
                                                </Text>
                                            )}
                                            {isOwner && (
                                                <Ionicons
                                                    name="reorder-three"
                                                    size={16}
                                                    color={isDraggingThis ? '#000' : '#f59e0b'}
                                                />
                                            )}
                                        </Pressable>
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
                                        onPress={() => {
                                            if (canDragRowDirectly) return;
                                            handleItemPress(stack);
                                        }}
                                    />
                                </View>

                                {/* Owner Controls: Up/Down Nudge + Remove */}
                                {isOwner && (
                                    <View className="flex-row items-center ml-2 gap-1">
                                        {stacks.length > 1 && (
                                            <View className="gap-1">
                                                <Pressable
                                                    onPress={() => handleMoveToIndex(idx, idx - 1)}
                                                    disabled={idx === 0}
                                                    className={`w-8 h-8 items-center justify-center rounded bg-neutral-900 border border-neutral-800 ${
                                                        idx === 0 ? 'opacity-30' : 'active:bg-neutral-800'
                                                    }`}
                                                >
                                                    <Ionicons name="chevron-up" size={14} color="#f59e0b" />
                                                </Pressable>
                                                <Pressable
                                                    onPress={() => handleMoveToIndex(idx, idx + 1)}
                                                    disabled={idx === stacks.length - 1}
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
