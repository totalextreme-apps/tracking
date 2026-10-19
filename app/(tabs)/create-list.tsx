import { GlossyCard } from '@/components/GlossyCard';
import { StickerOverlay } from '@/components/StickerOverlay';
import { TrackingLoader } from '@/components/TrackingLoader';
import { VHSCard } from '@/components/VHSCard';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useBulkUpdateCustomLists, useCollection, useUpdateStackMeta } from '@/hooks/useCollection';
import { getGenres, getStackMeta } from '@/lib/collection-utils';
import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMedia } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Keyboard,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';

const DECADES = ['ALL', '70s', '80s', '90s', '00s', '10s', '20s'] as const;

export default function CreateListScreen() {
    const { userId } = useAuth();
    const { playSound } = useSound();
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = Platform.OS === 'web' && windowWidth > 1024;

    const { data: collection, isLoading: collectionLoading } = useCollection(userId);
    const bulkUpdateMutation = useBulkUpdateCustomLists(userId);
    const updateMetaMutation = useUpdateStackMeta(userId);

    const { existingListName } = useLocalSearchParams<{ existingListName?: string }>();
    const isEditingExisting = !!existingListName;
    const decodedExistingName = existingListName ? decodeURIComponent(existingListName) : '';

    const [listName, setListName] = useState(decodedExistingName);
    const [description, setDescription] = useState('');
    const [isRanked, setIsRanked] = useState(false);
    // Ordered array of selected item IDs so selection order = rank order!
    const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
    const [initialIds, setInitialIds] = useState<string[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [formatFilter, setFormatFilter] = useState<string | null>(null);
    const [genreFilter, setGenreFilter] = useState<string | null>(null);
    const [decadeFilter, setDecadeFilter] = useState<string>('ALL');
    const [minRatingFilter, setMinRatingFilter] = useState<number | null>(null);
    const [statusFilter, setStatusFilter] = useState<'owned' | 'wishlist' | 'all'>('owned');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const defaultCols = isDesktop ? 5 : 3;
    const [numColumns, setNumColumns] = useState(defaultCols);

    const genres = useMemo(() => getGenres(collection), [collection]);

    // Initialize state when screen focuses
    useFocusEffect(
        useCallback(() => {
            if (isEditingExisting && collection) {
                const targetName = decodeURIComponent(existingListName!);
                setListName(targetName);
                const meta = getStackMeta(collection, targetName);
                setDescription(meta.description || '');
                setIsRanked(!!meta.isRanked);

                const existingItems = collection.filter(
                    (i: CollectionItemWithMedia) => i && i.custom_lists?.includes(targetName)
                );
                const orderMap = new Map<string, number>();
                (meta.itemOrder || []).forEach((id, idx) => orderMap.set(id, idx));
                existingItems.sort((a, b) => {
                    const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 99999;
                    const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 99999;
                    return idxA - idxB;
                });
                const ids = existingItems.map((i) => i.id);
                setSelectedOrder(ids);
                setInitialIds(ids);
                setStatusFilter('all');
            } else if (!isEditingExisting) {
                setListName('');
                setDescription('');
                setIsRanked(false);
                setSelectedOrder([]);
                setInitialIds([]);
                setSearchQuery('');
                setFormatFilter(null);
                setGenreFilter(null);
                setDecadeFilter('ALL');
                setMinRatingFilter(null);
                setStatusFilter('owned');
            }
        }, [isEditingExisting, existingListName, collection])
    );

    const selectedSet = useMemo(() => new Set(selectedOrder), [selectedOrder]);

    if (collectionLoading) {
        return (
            <View className="flex-1 bg-neutral-950 items-center justify-center">
                <TrackingLoader label="LOADING STACKS" />
            </View>
        );
    }

    const handleToggleSelect = (item: CollectionItemWithMedia) => {
        playSound('click');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedOrder((prev) => {
            if (prev.includes(item.id)) {
                return prev.filter((id) => id !== item.id);
            }
            return [...prev, item.id];
        });
    };

    const showAlert = (title: string, message?: string) => {
        if (Platform.OS === 'web') {
            window.alert(message ? `${title}\n${message}` : title);
        } else {
            Alert.alert(title, message);
        }
    };

    const handleSave = async () => {
        const cleanName = listName.trim();
        if (!cleanName) {
            showAlert('Name Required', 'Please enter a name for your stack before saving.');
            return;
        }
        if (selectedOrder.length === 0) {
            showAlert('No Titles Selected', 'Please select at least one movie or show to include in this stack.');
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        try {
            const meta = {
                description: description.trim(),
                isRanked,
                itemOrder: selectedOrder,
                updatedAt: Date.now(),
            };

            // Remove any deselected items if editing an existing stack
            const removedIds = initialIds.filter((id) => !selectedSet.has(id));
            if (removedIds.length > 0) {
                await bulkUpdateMutation.mutateAsync({
                    itemIds: removedIds,
                    listName: cleanName,
                    isAdding: false,
                });
            }

            // Add selected items + save metadata
            await bulkUpdateMutation.mutateAsync({
                itemIds: selectedOrder,
                listName: cleanName,
                isAdding: true,
                meta,
            });

            // Ensure all remaining items in the stack carry the updated metadata
            await updateMetaMutation.mutateAsync({
                listName: cleanName,
                meta,
            });

            router.replace(`/stack/${encodeURIComponent(cleanName)}` as any);
        } catch (e: any) {
            showAlert('Save Failed', e.message);
        }
    };

    // Filter Collection (Supports both Movies and TV Shows!)
    const filteredItems = useMemo(() => {
        let items = collection || [];

        if (statusFilter !== 'all') {
            items = items.filter((item: CollectionItemWithMedia) => item.status === statusFilter);
        }

        return items.filter((item: CollectionItemWithMedia) => {
            const media = item.movies || item.shows;
            if (!media) return false;

            const rawTitle = (item.movies?.title || item.shows?.name || '').toLowerCase();
            if (searchQuery) {
                const query = searchQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
                const matchesTitle = rawTitle.replace(/[^a-z0-9]/g, '').includes(query);
                const castList = (item.movies as any)?.cast || (item.movies as any)?.movie_cast || (item.shows as any)?.show_cast || [];
                const matchesCast = Array.isArray(castList) && castList.some((c: any) =>
                    (c?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(query)
                );
                if (!matchesTitle && !matchesCast) return false;
            }

            if (formatFilter) {
                if (formatFilter === 'BOOTLEG') {
                    if (!item.is_bootleg) return false;
                } else if (item.format !== formatFilter) {
                    return false;
                }
            }

            if (genreFilter) {
                const hasGenre =
                    media.genres?.some((g: any) => g?.name === genreFilter) ||
                    media.custom_genre === genreFilter;
                if (!hasGenre) return false;
            }

            if (decadeFilter !== 'ALL') {
                const dateStr = item.movies?.release_date || item.shows?.first_air_date || '';
                const year = parseInt(dateStr.slice(0, 4), 10);
                if (!year) return false;
                const decadeMap: Record<string, [number, number]> = {
                    '70s': [1970, 1979],
                    '80s': [1980, 1989],
                    '90s': [1990, 1999],
                    '00s': [2000, 2009],
                    '10s': [2010, 2019],
                    '20s': [2020, 2029],
                };
                const range = decadeMap[decadeFilter];
                if (range && (year < range[0] || year > range[1])) return false;
            }

            if (minRatingFilter !== null) {
                if ((item.rating || 0) < minRatingFilter) return false;
            }

            return true;
        });
    }, [collection, statusFilter, searchQuery, formatFilter, genreFilter, decadeFilter, minRatingFilter]);

    const containerWidth = Math.min(windowWidth, 1200);
    const gap = 8;
    const totalPadding = 24 + gap * (numColumns - 1);
    const itemWidth = (containerWidth - totalPadding) / numColumns;

    const renderItem = ({ item }: { item: CollectionItemWithMedia }) => {
        const rankIndex = selectedOrder.indexOf(item.id);
        const isSelected = rankIndex !== -1;
        const posterPath = item.movies?.poster_path || item.shows?.poster_path || null;
        const posterUrl = item.custom_poster_url || getPosterUrl(posterPath, 'w500');
        const isPhysical = item.format !== 'Digital';
        const showSticker = item.is_on_display && isPhysical && item.status === 'owned';
        const displayTitle = item.movies?.title || item.shows?.name || 'Untitled';

        return (
            <Pressable
                onPress={() => handleToggleSelect(item)}
                style={{ width: itemWidth, padding: gap / 2 }}
                className="active:opacity-80"
            >
                <View style={{ aspectRatio: 2 / 3, position: 'relative' }}>
                    {item.format === 'VHS' ? (
                        <VHSCard
                            posterUrl={posterUrl}
                            isCustom={!!item.custom_poster_url}
                            style={{ width: '100%', height: '100%', borderRadius: 4 }}
                        />
                    ) : (
                        <GlossyCard
                            posterUrl={posterUrl}
                            format={item.format}
                            isCustom={!!item.custom_poster_url}
                            style={{ width: '100%', height: '100%', borderRadius: 4 }}
                        />
                    )}

                    {/* Format pill in top-right */}
                    <View className="absolute top-1.5 right-1.5 bg-black/80 border border-white/20 px-1.5 py-0.5 rounded">
                        <Text className="text-white font-mono text-[8px] font-bold">
                            {item.format === 'BluRay' ? 'BLU' : item.format}
                            {item.media_type === 'tv' && item.season_number ? `·S${item.season_number}` : ''}
                        </Text>
                    </View>

                    {showSticker && (
                        <StickerOverlay visible={true} size={Math.max(24, itemWidth * 0.28)} />
                    )}

                    {/* Selection highlight + Rank number or Checkmark */}
                    {isSelected && (
                        <View
                            className="absolute inset-0 bg-amber-500/30 items-center justify-center rounded"
                            style={{ borderWidth: 2, borderColor: '#f59e0b', borderRadius: 4 }}
                        >
                            {isRanked ? (
                                <View className="bg-amber-500 px-2.5 py-1 rounded-full border-2 border-black shadow-lg">
                                    <Text
                                        className="text-black font-black text-sm"
                                        style={{ fontFamily: 'VCR_OSD_MONO' }}
                                    >
                                        #{rankIndex + 1}
                                    </Text>
                                </View>
                            ) : (
                                <FontAwesome
                                    name="check-circle"
                                    size={Math.max(18, itemWidth * 0.32)}
                                    color="#f59e0b"
                                />
                            )}
                        </View>
                    )}
                </View>

                {numColumns <= 5 && (
                    <Text
                        className="text-white/70 text-[10px] uppercase font-mono mt-1 text-center"
                        numberOfLines={1}
                    >
                        {displayTitle}
                    </Text>
                )}
            </Pressable>
        );
    };

    const isSaving = bulkUpdateMutation.isPending || updateMetaMutation.isPending;
    const canSave = !!listName.trim() && selectedOrder.length > 0 && !isSaving;

    const activeFilterCount =
        (formatFilter ? 1 : 0) +
        (genreFilter ? 1 : 0) +
        (decadeFilter !== 'ALL' ? 1 : 0) +
        (minRatingFilter !== null ? 1 : 0);

    return (
        <View className="flex-1 bg-neutral-950">
            <View
                className="px-4 pt-3 pb-2 border-b border-neutral-900 bg-neutral-950"
                style={{ maxWidth: 1200, alignSelf: 'center', width: '100%' }}
            >
                {/* Top Action Row: BACK + SELECTED COUNT + SAVE */}
                <View className="flex-row items-center justify-between mb-3">
                    <Pressable
                        onPress={() => {
                            playSound('click');
                            if (isEditingExisting) {
                                router.replace(`/stack/${encodeURIComponent(listName.trim())}` as any);
                            } else {
                                router.back();
                            }
                        }}
                        className="bg-[#0000FF] px-4 py-1.5 rounded-md self-start active:opacity-80"
                    >
                        <Text
                            className="text-white text-[10px] font-bold uppercase tracking-widest"
                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                        >
                            BACK
                        </Text>
                    </Pressable>

                    <View className="flex-row items-center gap-3">
                        {selectedOrder.length > 0 && (
                            <Pressable
                                onPress={() => {
                                    playSound('click');
                                    setSelectedOrder([]);
                                }}
                                className="bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-full"
                            >
                                <Text className="text-amber-400 font-mono text-[10px] font-bold">
                                    {selectedOrder.length} SELECTED · CLEAR
                                </Text>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={handleSave}
                            disabled={!canSave}
                            className={`px-4 py-1.5 rounded-full active:opacity-80 ${
                                canSave ? 'bg-amber-500' : 'bg-neutral-800'
                            }`}
                        >
                            <Text
                                className={`text-[11px] font-bold tracking-widest font-mono ${
                                    canSave ? 'text-black' : 'text-neutral-600'
                                }`}
                            >
                                {isSaving ? 'SAVING...' : 'SAVE STACK'}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* Stack Title + Ranked Mode Toggle */}
                <View className="flex-row items-center gap-2 mb-2">
                    {isEditingExisting ? (
                        <View className="bg-neutral-900 border border-amber-500/40 rounded-lg px-4 py-2.5 flex-1">
                            <Text className="text-amber-500 font-mono text-sm font-bold uppercase tracking-widest">
                                {listName}
                            </Text>
                        </View>
                    ) : (
                        <TextInput
                            nativeID="create-list-name-input"
                            placeholder="STACK TITLE (e.g. Top 10 Horror VHS in My Collection)..."
                            placeholderTextColor="#525252"
                            value={listName}
                            onChangeText={setListName}
                            className="bg-neutral-900 border border-neutral-800 text-white font-mono rounded-lg px-4 py-2.5 flex-1 text-xs md:text-sm"
                            onSubmitEditing={() => Keyboard.dismiss()}
                        />
                    )}

                    <Pressable
                        onPress={() => {
                            playSound('click');
                            setIsRanked((prev) => !prev);
                        }}
                        className={`px-3 py-2.5 rounded-lg border flex-row items-center gap-1.5 ${
                            isRanked
                                ? 'bg-amber-500/20 border-amber-500'
                                : 'bg-neutral-900 border-neutral-800'
                        }`}
                    >
                        <Ionicons
                            name="trophy-outline"
                            size={14}
                            color={isRanked ? '#f59e0b' : '#737373'}
                        />
                        <Text
                            className={`font-mono text-[10px] font-bold uppercase ${
                                isRanked ? 'text-amber-400' : 'text-neutral-400'
                            }`}
                        >
                            {isRanked ? 'RANKED (#1, #2)' : 'UNRANKED'}
                        </Text>
                    </Pressable>
                </View>

                {/* Blurb / Liner Notes Input */}
                <TextInput
                    nativeID="create-list-blurb-input"
                    placeholder="Add an optional blurb / liner notes (why these titles belong together, rules of the list, etc.)..."
                    placeholderTextColor="#525252"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={2}
                    className="bg-neutral-900/70 border border-neutral-800 text-neutral-200 font-mono rounded-lg px-3.5 py-2 mb-2.5 text-xs"
                />

                {/* Search + Status + Filter Toggle Row */}
                <View className="flex-row items-center gap-2 mb-2 flex-wrap">
                    <View className="flex-row items-center bg-neutral-900 border border-neutral-800 rounded-lg px-3 flex-1 min-w-[160px]">
                        <Ionicons name="search" size={13} color="#525252" style={{ marginRight: 6 }} />
                        <TextInput
                            nativeID="create-list-search-input"
                            placeholder="Search title, actor, director..."
                            placeholderTextColor="#525252"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            className="text-white font-mono flex-1 text-xs py-2"
                            style={{ padding: 0 }}
                        />
                        {searchQuery.length > 0 && (
                            <Pressable
                                onPress={() => {
                                    setSearchQuery('');
                                    playSound('click');
                                }}
                                className="p-1"
                            >
                                <FontAwesome name="times-circle" size={14} color="#525252" />
                            </Pressable>
                        )}
                    </View>

                    {(['owned', 'wishlist', 'all'] as const).map((s) => {
                        const isActive = statusFilter === s;
                        const label = s === 'owned' ? 'OWNED' : s === 'wishlist' ? 'WISHLIST' : 'ALL';
                        return (
                            <Pressable
                                key={s}
                                onPress={() => setStatusFilter(s)}
                                className={`px-2.5 py-2 rounded-lg border ${
                                    isActive
                                        ? 'bg-amber-600 border-amber-500'
                                        : 'bg-neutral-900 border-neutral-800'
                                }`}
                            >
                                <Text
                                    className={`font-mono text-[10px] font-bold ${
                                        isActive ? 'text-white' : 'text-neutral-400'
                                    }`}
                                >
                                    {label}
                                </Text>
                            </Pressable>
                        );
                    })}

                    <Pressable
                        onPress={() => {
                            playSound('click');
                            setShowAdvancedFilters((prev) => !prev);
                        }}
                        className={`px-3 py-2 rounded-lg border flex-row items-center gap-1.5 ${
                            showAdvancedFilters || activeFilterCount > 0
                                ? 'bg-amber-500/20 border-amber-500/60'
                                : 'bg-neutral-900 border-neutral-800'
                        }`}
                    >
                        <Ionicons
                            name="options-outline"
                            size={13}
                            color={showAdvancedFilters || activeFilterCount > 0 ? '#f59e0b' : '#a3a3a3'}
                        />
                        <Text
                            className={`font-mono text-[10px] font-bold ${
                                showAdvancedFilters || activeFilterCount > 0
                                    ? 'text-amber-400'
                                    : 'text-neutral-300'
                            }`}
                        >
                            FILTERS{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                        </Text>
                    </Pressable>
                </View>

                {/* Format Pills Row (Always visible for fast VHS/4K filtering) */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-2"
                    contentContainerStyle={{ gap: 6, alignItems: 'center' }}
                >
                    {['ALL', 'VHS', 'DVD', 'BluRay', '4K', 'Digital', 'BOOTLEG'].map((fmt) => {
                        const isActive = formatFilter === fmt || (fmt === 'ALL' && !formatFilter);
                        return (
                            <Pressable
                                key={fmt}
                                onPress={() => setFormatFilter(fmt === 'ALL' ? null : fmt)}
                                className={`px-2.5 py-1.5 rounded-md border ${
                                    isActive
                                        ? 'bg-amber-600 border-amber-500'
                                        : 'bg-neutral-900 border-neutral-800'
                                }`}
                            >
                                <Text
                                    className={`font-mono text-[10px] ${
                                        isActive ? 'text-white font-bold' : 'text-neutral-400'
                                    }`}
                                >
                                    {fmt === 'BluRay' ? 'Blu-ray' : fmt}
                                </Text>
                            </Pressable>
                        );
                    })}

                    {/* Quick Select All Filtered button */}
                    {filteredItems.length > 0 && activeFilterCount > 0 && (
                        <Pressable
                            onPress={() => {
                                playSound('click');
                                setSelectedOrder((prev) => {
                                    const next = [...prev];
                                    for (const item of filteredItems) {
                                        if (!next.includes(item.id)) next.push(item.id);
                                    }
                                    return next;
                                });
                            }}
                            className="px-2.5 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 ml-2"
                        >
                            <Text className="text-emerald-400 font-mono text-[10px] font-bold">
                                + SELECT ALL {filteredItems.length} MATCHING
                            </Text>
                        </Pressable>
                    )}
                </ScrollView>

                {/* Collapsible Genre / Decade / Rating Quick-Filters */}
                {showAdvancedFilters && (
                    <View className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-2.5 mb-2 gap-2">
                        {/* Genre Row */}
                        {genres.length > 0 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 6, alignItems: 'center' }}
                            >
                                <Text className="text-neutral-500 font-mono text-[9px] uppercase mr-1">
                                    GENRE:
                                </Text>
                                <Pressable
                                    onPress={() => setGenreFilter(null)}
                                    className={`px-2.5 py-1 rounded border ${
                                        !genreFilter
                                            ? 'bg-amber-500/20 border-amber-500'
                                            : 'bg-neutral-900 border-neutral-800'
                                    }`}
                                >
                                    <Text
                                        className={`font-mono text-[9px] font-bold ${
                                            !genreFilter ? 'text-amber-400' : 'text-neutral-400'
                                        }`}
                                    >
                                        ALL
                                    </Text>
                                </Pressable>
                                {genres.map((g) => {
                                    const active = genreFilter === g;
                                    return (
                                        <Pressable
                                            key={g}
                                            onPress={() => setGenreFilter(active ? null : g)}
                                            className={`px-2.5 py-1 rounded border ${
                                                active
                                                    ? 'bg-amber-500/20 border-amber-500'
                                                    : 'bg-neutral-900 border-neutral-800'
                                            }`}
                                        >
                                            <Text
                                                className={`font-mono text-[9px] font-bold ${
                                                    active ? 'text-amber-400' : 'text-neutral-400'
                                                }`}
                                            >
                                                {g.toUpperCase()}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        )}

                        {/* Decade + Rating Row */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 6, alignItems: 'center' }}
                        >
                            <Text className="text-neutral-500 font-mono text-[9px] uppercase mr-1">
                                ERA:
                            </Text>
                            {DECADES.map((dec) => {
                                const active = decadeFilter === dec;
                                return (
                                    <Pressable
                                        key={dec}
                                        onPress={() => setDecadeFilter(dec)}
                                        className={`px-2 py-1 rounded border ${
                                            active
                                                ? 'bg-amber-500/20 border-amber-500'
                                                : 'bg-neutral-900 border-neutral-800'
                                        }`}
                                    >
                                        <Text
                                            className={`font-mono text-[9px] font-bold ${
                                                active ? 'text-amber-400' : 'text-neutral-400'
                                            }`}
                                        >
                                            {dec}
                                        </Text>
                                    </Pressable>
                                );
                            })}

                            <View className="w-px h-4 bg-neutral-800 mx-1" />

                            <Text className="text-neutral-500 font-mono text-[9px] uppercase mr-1">
                                RATING:
                            </Text>
                            {[
                                { label: 'ALL', val: null },
                                { label: '4★+', val: 4 },
                                { label: '5★', val: 5 },
                            ].map((r) => {
                                const active = minRatingFilter === r.val;
                                return (
                                    <Pressable
                                        key={r.label}
                                        onPress={() => setMinRatingFilter(r.val)}
                                        className={`px-2 py-1 rounded border ${
                                            active
                                                ? 'bg-amber-500/20 border-amber-500'
                                                : 'bg-neutral-900 border-neutral-800'
                                        }`}
                                    >
                                        <Text
                                            className={`font-mono text-[9px] font-bold ${
                                                active ? 'text-amber-400' : 'text-neutral-400'
                                            }`}
                                        >
                                            {r.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* Hint when Ranked is enabled + Poster Size Slider */}
                <View className="flex-row items-center justify-between gap-3 pb-1">
                    {isRanked ? (
                        <Text className="text-amber-400/90 font-mono text-[10px]">
                            🏆 Tap titles in the order you want them ranked (#1, #2, #3...)
                        </Text>
                    ) : (
                        <Text className="text-neutral-500 font-mono text-[10px]">
                            Showing {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                        </Text>
                    )}
                    <View className="flex-row items-center gap-2" style={{ width: 140 }}>
                        <FontAwesome name="th" size={11} color="#525252" />
                        <Slider
                            style={{ flex: 1, height: 24 }}
                            minimumValue={2}
                            maximumValue={isDesktop ? 10 : 7}
                            step={1}
                            value={numColumns}
                            onValueChange={(val) => setNumColumns(val)}
                            minimumTrackTintColor="#f59e0b"
                            maximumTrackTintColor="#262626"
                            thumbTintColor="#f59e0b"
                        />
                        <FontAwesome name="th-large" size={11} color="#525252" />
                    </View>
                </View>
            </View>

            {/* Poster Grid */}
            <FlatList
                data={filteredItems}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                numColumns={numColumns}
                key={numColumns}
                contentContainerStyle={{
                    paddingHorizontal: 12,
                    paddingTop: 8,
                    paddingBottom: 120,
                    maxWidth: 1200,
                    alignSelf: 'center',
                    width: '100%',
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}
