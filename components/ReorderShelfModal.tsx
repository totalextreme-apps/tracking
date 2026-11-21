import { GlossyCard } from '@/components/GlossyCard';
import { VHSCard } from '@/components/VHSCard';
import { useSound } from '@/context/SoundContext';
import { getPosterUrl } from '@/lib/dummy-data';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';

interface ReorderShelfModalProps {
    visible: boolean;
    onClose: () => void;
    items: any[];
    userId: string;
    type: 'display' | 'grail';
}

interface ActiveDragState {
    activeId: string;
    startIndex: number;
    currentIndex: number;
    dx: number;
    dy: number;
    mode: 'grid' | 'list';
}

export function ReorderShelfModal({
    visible,
    onClose,
    items,
    userId,
    type,
}: ReorderShelfModalProps) {
    const [baseData, setBaseData] = useState<any[]>(items || []);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isSaving, setIsSaving] = useState(false);
    const [dragState, setDragState] = useState<ActiveDragState | null>(null);
    const [jumpFromIndex, setJumpFromIndex] = useState<number | null>(null);
    const [measuredGridHeight, setMeasuredGridHeight] = useState<number>(0);
    const [measuredListHeight, setMeasuredListHeight] = useState<number>(76);

    const queryClient = useQueryClient();
    const { playSound } = useSound();
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = Platform.OS === 'web' && windowWidth >= 768;

    // Sync data when modal opens
    useEffect(() => {
        if (visible && items) {
            setBaseData(items);
            setDragState(null);
            setJumpFromIndex(null);
        }
    }, [visible, items]);

    // Live-reordered array while dragging
    const displayedData = useMemo(() => {
        if (!dragState) return baseData;
        const { startIndex, currentIndex } = dragState;
        if (
            startIndex < 0 ||
            startIndex >= baseData.length ||
            currentIndex < 0 ||
            currentIndex >= baseData.length ||
            startIndex === currentIndex
        ) {
            return baseData;
        }
        const copy = [...baseData];
        const [moved] = copy.splice(startIndex, 1);
        copy.splice(currentIndex, 0, moved);
        return copy;
    }, [baseData, dragState]);

    const modalMaxWidth = Math.min(windowWidth, 820);
    const gridCols = isDesktop ? 4 : 3;
    const gridGap = 10;
    const gridItemWidth = (modalMaxWidth - 32 - gridGap * (gridCols - 1)) / gridCols;
    const gridStepX = gridItemWidth + gridGap;
    const gridStepY =
        (measuredGridHeight > 0 ? measuredGridHeight : gridItemWidth * 1.5 + 24) + gridGap + 6;

    const dragRef = useRef<{
        activeId: string;
        startIndex: number;
        currentIndex: number;
        startX: number;
        startY: number;
        mode: 'grid' | 'list';
        hasMoved: boolean;
        snapshot: any[];
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

        const total = ref.snapshot.length;
        let nextIndex = ref.startIndex;

        if (ref.mode === 'grid') {
            const startCol = ref.startIndex % ref.gridCols;
            const startRow = Math.floor(ref.startIndex / ref.gridCols);
            const totalRows = Math.ceil(total / ref.gridCols);

            const hoverCol = Math.max(
                0,
                Math.min(ref.gridCols - 1, Math.round((startCol * ref.gridStepX + dx) / ref.gridStepX))
            );
            const hoverRow = Math.max(
                0,
                Math.min(totalRows - 1, Math.round((startRow * ref.gridStepY + dy) / ref.gridStepY))
            );
            nextIndex = Math.max(0, Math.min(total - 1, hoverRow * ref.gridCols + hoverCol));
        } else {
            nextIndex = Math.max(
                0,
                Math.min(total - 1, Math.round((ref.startIndex * ref.listStepY + dy) / ref.listStepY))
            );
        }

        if (nextIndex !== ref.currentIndex) {
            ref.currentIndex = nextIndex;
            Haptics.selectionAsync();
        }

        setDragState({
            activeId: ref.activeId,
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
            const reordered = [...ref.snapshot];
            const [moved] = reordered.splice(ref.startIndex, 1);
            reordered.splice(ref.currentIndex, 0, moved);
            setBaseData(reordered);
            playSound('click');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [playSound]);

    const beginDrag = useCallback(
        (
            clientX: number,
            clientY: number,
            id: string,
            index: number,
            mode: 'grid' | 'list',
            immediate = false
        ) => {
            dragRef.current = {
                activeId: id,
                startIndex: index,
                currentIndex: index,
                startX: clientX,
                startY: clientY,
                mode,
                hasMoved: immediate,
                snapshot: baseData,
                gridCols,
                gridStepX,
                gridStepY,
                listStepY: measuredListHeight > 0 ? measuredListHeight : 76,
            };

            if (immediate) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setDragState({
                    activeId: id,
                    startIndex: index,
                    currentIndex: index,
                    dx: 0,
                    dy: 0,
                    mode,
                });
            }

            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const onMouseMove = (ev: MouseEvent) => {
                    if (dragRef.current?.hasMoved) {
                        ev.preventDefault();
                    }
                    updateDragPosition(ev.clientX, ev.clientY);
                };
                const onTouchMove = (ev: TouchEvent) => {
                    if (!dragRef.current) return;
                    const t = ev.touches[0];
                    if (!t) return;
                    if (ev.cancelable) ev.preventDefault();
                    updateDragPosition(t.clientX, t.clientY);
                };
                const onUp = () => {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onUp);
                    window.removeEventListener('touchmove', onTouchMove);
                    window.removeEventListener('touchend', onUp);
                    window.removeEventListener('touchcancel', onUp);
                    finishDrag();
                };
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onUp);
                window.addEventListener('touchmove', onTouchMove, { passive: false });
                window.addEventListener('touchend', onUp);
                window.addEventListener('touchcancel', onUp);
            }
        },
        [baseData, gridCols, gridStepX, gridStepY, measuredListHeight, updateDragPosition, finishDrag]
    );

    const makeModalDragProps = useCallback(
        (id: string, idx: number, mode: 'grid' | 'list') => {
            if (Platform.OS === 'web') {
                return {
                    onMouseDown: (e: any) => {
                        if (e.button !== undefined && e.button !== 0) return;
                        beginDrag(e.clientX, e.clientY, id, idx, mode, false);
                    },
                    onTouchStart: (e: any) => {
                        const t = e.nativeEvent?.touches?.[0] || e.touches?.[0] || e.nativeEvent;
                        const cx = t?.clientX ?? t?.pageX ?? 0;
                        const cy = t?.clientY ?? t?.pageY ?? 0;
                        beginDrag(cx, cy, id, idx, mode, true);
                    },
                    onDragStart: (e: any) => e.preventDefault(),
                } as any;
            }
            return {
                onTouchStart: (e: any) =>
                    beginDrag(e.nativeEvent.pageX, e.nativeEvent.pageY, id, idx, mode, true),
                onTouchMove: (e: any) =>
                    updateDragPosition(e.nativeEvent.pageX, e.nativeEvent.pageY),
                onTouchEnd: () => finishDrag(),
                onTouchCancel: () => finishDrag(),
            };
        },
        [beginDrag, updateDragPosition, finishDrag]
    );

    const moveItemToIndex = (fromIdx: number, toIdx: number) => {
        if (
            fromIdx < 0 ||
            fromIdx >= baseData.length ||
            toIdx < 0 ||
            toIdx >= baseData.length ||
            fromIdx === toIdx
        ) {
            return;
        }
        playSound('click');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const copy = [...baseData];
        const [moved] = copy.splice(fromIdx, 1);
        copy.splice(toIdx, 0, moved);
        setBaseData(copy);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const itemIds = baseData.map((i) => i.id);
            const orderField = type === 'display' ? 'display_order' : 'grail_order';
            const rankMap = new Map<string, number>();
            itemIds.forEach((id, idx) => rankMap.set(id, idx + 1));

            // Optimistically update the React Query cache immediately so the shelf updates in 0ms
            queryClient.setQueryData(['collection', userId], (old: any) => {
                if (!Array.isArray(old)) return old;
                return old.map((item: any) => {
                    if (!rankMap.has(item.id)) return item;
                    return {
                        ...item,
                        [orderField]: rankMap.get(item.id),
                    };
                });
            });

            const { error } = await (supabase.rpc as any)('update_collection_order', {
                item_ids: itemIds,
                order_type: type,
            });
            if (error) throw error;

            playSound('click');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            queryClient.invalidateQueries({ queryKey: ['collection', userId] });
            onClose();
        } catch (e) {
            console.error(e);
            alert('Failed to save order.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="formSheet"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-neutral-950">
                {/* Quick Jump to Rank Modal */}
                <Modal
                    visible={jumpFromIndex !== null}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setJumpFromIndex(null)}
                >
                    <Pressable
                        onPress={() => setJumpFromIndex(null)}
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
                                    {jumpFromIndex !== null && baseData[jumpFromIndex] && (
                                        <Text
                                            className="text-neutral-400 font-mono text-xs mt-0.5"
                                            numberOfLines={1}
                                        >
                                            {baseData[jumpFromIndex]?.movies?.title ||
                                                baseData[jumpFromIndex]?.shows?.name}
                                        </Text>
                                    )}
                                </View>
                                <Pressable
                                    onPress={() => setJumpFromIndex(null)}
                                    className="p-1.5 bg-neutral-900 border border-neutral-800 rounded-full"
                                >
                                    <Ionicons name="close" size={16} color="#737373" />
                                </Pressable>
                            </View>

                            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                                <View className="flex-row flex-wrap gap-2 py-1">
                                    {baseData.map((_, targetIdx) => {
                                        const isCurrent = targetIdx === jumpFromIndex;
                                        return (
                                            <Pressable
                                                key={targetIdx}
                                                onPress={() => {
                                                    if (jumpFromIndex !== null) {
                                                        moveItemToIndex(jumpFromIndex, targetIdx);
                                                    }
                                                    setJumpFromIndex(null);
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

                {/* Header Bar */}
                <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-neutral-800 bg-black">
                    <Pressable
                        onPress={onClose}
                        className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800"
                    >
                        <Text className="text-neutral-400 font-mono text-xs font-bold">CANCEL</Text>
                    </Pressable>

                    <View className="items-center">
                        <Text
                            className="text-amber-500 font-bold text-base uppercase tracking-widest"
                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                        >
                            REORDER {type === 'display' ? 'ON DISPLAY' : 'THE GRAILS'}
                        </Text>
                    </View>

                    <Pressable
                        onPress={handleSave}
                        disabled={isSaving}
                        className="px-4 py-1.5 rounded-lg bg-amber-500 active:opacity-80"
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color="#000" />
                        ) : (
                            <Text className="text-black font-mono text-xs font-bold">SAVE</Text>
                        )}
                    </Pressable>
                </View>

                {/* Subheader: Instructions + Grid/List View Toggle */}
                <View className="px-4 py-2.5 bg-neutral-900/90 border-b border-neutral-800 flex-row items-center justify-between gap-2">
                    <View className="flex-row items-center gap-2 flex-1">
                        <Ionicons name="move" size={14} color="#f59e0b" />
                        <Text className="text-neutral-300 font-mono text-[11px] flex-1">
                            Drag & drop any title to reorder, or tap its # badge to jump to a spot.
                        </Text>
                    </View>

                    <View className="flex-row bg-neutral-950 border border-neutral-800 rounded-lg p-0.5">
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
                    </View>
                </View>

                {/* Draggable Content Area */}
                <ScrollView
                    className="flex-1"
                    scrollEnabled={dragState === null}
                    contentContainerStyle={{
                        padding: 16,
                        paddingBottom: 80,
                        maxWidth: modalMaxWidth,
                        alignSelf: 'center',
                        width: '100%',
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    {viewMode === 'grid' ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: gridGap }}>
                            {displayedData.map((item, idx) => {
                                const title = item.movies?.title || item.shows?.name || 'Untitled';
                                const posterPath =
                                    item.movies?.poster_path || item.shows?.poster_path || null;
                                const posterUrl =
                                    item.custom_poster_url || getPosterUrl(posterPath, 'w500');
                                const isDraggingThis = dragState?.activeId === item.id;

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

                                return (
                                    <View
                                        key={item.id}
                                        onLayout={
                                            idx === 0
                                                ? (e) => {
                                                      const h = e.nativeEvent.layout.height;
                                                      if (
                                                          h > 0 &&
                                                          Math.abs(h - measuredGridHeight) > 2
                                                      ) {
                                                          setMeasuredGridHeight(h);
                                                      }
                                                  }
                                                : undefined
                                        }
                                        {...makeModalDragProps(item.id, idx, 'grid')}
                                        style={[
                                            {
                                                width: gridItemWidth,
                                                marginBottom: 6,
                                                zIndex: isDraggingThis ? 999 : 1,
                                                transform: isDraggingThis
                                                    ? [
                                                          { translateX },
                                                          { translateY },
                                                          { scale: 1.06 },
                                                      ]
                                                    : [],
                                            },
                                            Platform.OS === 'web'
                                                ? ({
                                                      touchAction: 'none',
                                                      userSelect: 'none',
                                                      WebkitUserSelect: 'none',
                                                      cursor: isDraggingThis ? 'grabbing' : 'grab',
                                                  } as any)
                                                : null,
                                        ]}
                                    >
                                        <View
                                            style={{
                                                aspectRatio: 2 / 3,
                                                position: 'relative',
                                                borderRadius: 8,
                                                borderWidth: isDraggingThis ? 2.5 : 1.5,
                                                borderColor: isDraggingThis
                                                    ? '#f59e0b'
                                                    : 'rgba(245, 158, 11, 0.35)',
                                            }}
                                        >
                                            {item.format === 'VHS' ? (
                                                <VHSCard
                                                    posterUrl={posterUrl}
                                                    isCustom={!!item.custom_poster_url}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        borderRadius: 6,
                                                    }}
                                                />
                                            ) : (
                                                <GlossyCard
                                                    posterUrl={posterUrl}
                                                    format={item.format}
                                                    isCustom={!!item.custom_poster_url}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        borderRadius: 6,
                                                    }}
                                                />
                                            )}

                                            {/* Rank Badge (Tap to Jump) */}
                                            <Pressable
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    playSound('click');
                                                    setJumpFromIndex(idx);
                                                }}
                                                className="absolute top-1.5 left-1.5 bg-amber-500 border-2 border-black px-2 py-0.5 rounded-md shadow flex-row items-center gap-1"
                                            >
                                                <Text
                                                    className="text-black font-black text-xs"
                                                    style={{ fontFamily: 'VCR_OSD_MONO' }}
                                                >
                                                    #{idx + 1}
                                                </Text>
                                                <Ionicons name="reorder-two" size={12} color="#000" />
                                            </Pressable>

                                            {/* Format Pill */}
                                            <View className="absolute bottom-1.5 right-1.5 bg-black/85 border border-white/20 px-1.5 py-0.5 rounded">
                                                <Text className="text-white font-mono text-[8px] font-bold">
                                                    {item.format === 'BluRay' ? 'BLU' : item.format}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text
                                            className="text-neutral-200 font-mono text-[10px] font-bold mt-1.5 text-center"
                                            numberOfLines={1}
                                        >
                                            {idx + 1}. {title}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        displayedData.map((item, idx) => {
                            const title = item.movies?.title || item.shows?.name || 'Untitled';
                            const posterPath =
                                item.movies?.poster_path || item.shows?.poster_path || null;
                            const posterUrl =
                                item.custom_poster_url || getPosterUrl(posterPath, 'w185');
                            const isDraggingThis = dragState?.activeId === item.id;
                            const listStep = measuredListHeight > 0 ? measuredListHeight : 76;
                            const translateY =
                                isDraggingThis && dragState
                                    ? dragState.dy - (idx - dragState.startIndex) * listStep
                                    : 0;

                            return (
                                <View
                                    key={item.id}
                                    onLayout={
                                        idx === 0
                                            ? (e) => {
                                                  const h = e.nativeEvent.layout.height + 8;
                                                  if (h > 20 && Math.abs(h - measuredListHeight) > 2) {
                                                      setMeasuredListHeight(h);
                                                  }
                                              }
                                            : undefined
                                    }
                                    {...makeModalDragProps(item.id, idx, 'list')}
                                    style={[
                                        {
                                            zIndex: isDraggingThis ? 999 : 1,
                                            transform: isDraggingThis
                                                ? [{ translateY }, { scale: 1.02 }]
                                                : [],
                                        },
                                        Platform.OS === 'web'
                                            ? ({
                                                  touchAction: 'none',
                                                  userSelect: 'none',
                                                  cursor: isDraggingThis ? 'grabbing' : 'grab',
                                              } as any)
                                            : null,
                                    ]}
                                    className={`flex-row items-center p-2.5 mb-2 rounded-xl border ${
                                        isDraggingThis
                                            ? 'bg-neutral-900 border-amber-500'
                                            : 'bg-neutral-900/80 border-neutral-800'
                                    }`}
                                >
                                    {/* Rank Handle */}
                                    <Pressable
                                        onPress={() => {
                                            playSound('click');
                                            setJumpFromIndex(idx);
                                        }}
                                        className="w-10 h-12 rounded-lg bg-neutral-950 border border-amber-500/40 items-center justify-center mr-3"
                                    >
                                        <Text
                                            className="text-amber-400 font-black text-xs"
                                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                                        >
                                            #{idx + 1}
                                        </Text>
                                        <Ionicons name="reorder-three" size={14} color="#a3a3a3" />
                                    </Pressable>

                                    {posterUrl ? (
                                        <Image
                                            source={{ uri: posterUrl }}
                                            style={{
                                                width: 36,
                                                height: 52,
                                                borderRadius: 4,
                                                marginRight: 12,
                                                backgroundColor: '#222',
                                            }}
                                            contentFit="cover"
                                        />
                                    ) : null}

                                    <View className="flex-1 pr-2">
                                        <Text
                                            className="text-white font-mono text-xs font-bold"
                                            numberOfLines={1}
                                        >
                                            {title}
                                        </Text>
                                        <Text className="text-amber-500 font-mono text-[10px]">
                                            {item.format === 'BluRay' ? 'Blu-ray' : item.format}
                                        </Text>
                                    </View>

                                    {/* Up/Down Nudge Buttons */}
                                    <View className="flex-row items-center gap-1">
                                        <Pressable
                                            onPress={() => moveItemToIndex(idx, idx - 1)}
                                            disabled={idx === 0}
                                            className={`w-8 h-8 rounded bg-neutral-950 border border-neutral-800 items-center justify-center ${
                                                idx === 0 ? 'opacity-25' : 'active:bg-neutral-800'
                                            }`}
                                        >
                                            <Ionicons name="chevron-up" size={16} color="#f59e0b" />
                                        </Pressable>
                                        <Pressable
                                            onPress={() => moveItemToIndex(idx, idx + 1)}
                                            disabled={idx === displayedData.length - 1}
                                            className={`w-8 h-8 rounded bg-neutral-950 border border-neutral-800 items-center justify-center ${
                                                idx === displayedData.length - 1
                                                    ? 'opacity-25'
                                                    : 'active:bg-neutral-800'
                                            }`}
                                        >
                                            <Ionicons name="chevron-down" size={16} color="#f59e0b" />
                                        </Pressable>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}
