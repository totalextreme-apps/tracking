import { GlossyCard } from '@/components/GlossyCard';
import { StickerOverlay } from '@/components/StickerOverlay';
import { TrackingLoader } from '@/components/TrackingLoader';
import { VHSCard } from '@/components/VHSCard';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useBulkUpdateCustomLists, useCollection } from '@/hooks/useCollection';
import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMovie } from '@/types/database';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    Keyboard,
    Platform,
    Pressable,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';

export default function CreateListScreen() {
    const { userId } = useAuth();
    const { playSound } = useSound();
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = Platform.OS === 'web' && windowWidth > 1024;

    const { data: collection, isLoading: collectionLoading } = useCollection(userId);
    const bulkUpdateMutation = useBulkUpdateCustomLists(userId);

    // If coming from an existing stack, lock the name and add to that list
    const { existingListName } = useLocalSearchParams<{ existingListName?: string }>();
    const isEditingExisting = !!existingListName;

    const [listName, setListName] = useState(existingListName ? decodeURIComponent(existingListName) : '');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [formatFilter, setFormatFilter] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'owned' | 'wishlist' | 'all'>('owned');
    const defaultCols = isDesktop ? 5 : 3;
    const [numColumns, setNumColumns] = useState(defaultCols);

    if (collectionLoading) {
        return (
            <View className="flex-1 bg-neutral-950 items-center justify-center">
                <TrackingLoader label="LOADING STACKS" />
            </View>
        );
    }

    const handleToggleSelect = (item: CollectionItemWithMovie) => {
        playSound('click');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(item.id)) {
                next.delete(item.id);
            } else {
                next.add(item.id);
            }
            return next;
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
        if (!listName.trim()) {
            showAlert('Name Required', 'Please enter a name for your stack before saving.');
            return;
        }
        if (selectedIds.size === 0) {
            showAlert('No Movies Selected', 'Please select at least one movie to add to this stack.');
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        try {
            await bulkUpdateMutation.mutateAsync({
                itemIds: Array.from(selectedIds),
                listName: listName.trim(),
                isAdding: true,
            });
            router.replace(isEditingExisting
                ? `/stack/${encodeURIComponent(listName.trim())}` as any
                : '/lists'
            );
        } catch (e: any) {
            showAlert('Save Failed', e.message);
        }
    };

    // Filter Collection
    let filteredItems = collection || [];
    // Status filter first
    if (statusFilter !== 'all') {
        filteredItems = filteredItems.filter((item: CollectionItemWithMovie) => item.status === statusFilter);
    }
    if (searchQuery || formatFilter) {
        filteredItems = filteredItems.filter((item: CollectionItemWithMovie) => {
            const movie = item.movies;
            if (!movie) return false;
            if (searchQuery) {
                const query = searchQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
                const matchesTitle = movie.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(query);
                const matchesCast = (movie as any).cast?.some((c: any) => c.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(query));
                if (!matchesTitle && !matchesCast) return false;
            }
            if (formatFilter && item.format !== formatFilter) return false;
            return true;
        });
    }

    const containerWidth = Math.min(windowWidth, 1200);
    const gap = 8;
    const totalPadding = 24 + gap * (numColumns - 1);
    const itemWidth = (containerWidth - totalPadding) / numColumns;

    const renderItem = ({ item }: { item: CollectionItemWithMovie }) => {
        const isSelected = selectedIds.has(item.id);
        const posterUrl = item.custom_poster_url || getPosterUrl(item.movies?.poster_path ?? null, 'w500');
        const isPhysical = item.format !== 'Digital';
        const showSticker = item.is_on_display && isPhysical && item.status === 'owned';

        return (
            <Pressable
                onPress={() => handleToggleSelect(item)}
                style={{ width: itemWidth, padding: gap / 2 }}
                className="active:opacity-80"
            >
                <View style={{ aspectRatio: 2 / 3, position: 'relative' }}>
                    {/* Format-specific card overlay — VHS gets VHSCard, discs get GlossyCard */}
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

                    {/* Staff Pick sticker — only on display items, matching StackCard logic */}
                    {showSticker && (
                        <StickerOverlay visible={true} size={Math.max(24, itemWidth * 0.28)} />
                    )}

                    {/* Selection highlight + checkmark */}
                    {isSelected && (
                        <View
                            className="absolute inset-0 bg-amber-500/30 items-center justify-center rounded"
                            style={{ borderWidth: 2, borderColor: '#f59e0b', borderRadius: 4 }}
                        >
                            <FontAwesome name="check-circle" size={Math.max(16, itemWidth * 0.32)} color="#f59e0b" />
                        </View>
                    )}
                </View>

                {numColumns <= 5 && (
                    <Text className="text-white/70 text-[10px] uppercase font-mono mt-1 text-center" numberOfLines={1}>
                        {item.movies?.title}
                    </Text>
                )}
            </Pressable>
        );
    };

    const canSave = !!listName.trim() && selectedIds.size > 0 && !bulkUpdateMutation.isPending;

    return (
        <View className="flex-1 bg-neutral-950">
            {/* ── Controls (no separate header — GlobalHeader handles the title) ── */}
            <View
                className="px-4 pt-3 pb-2 border-b border-neutral-900 bg-neutral-950"
                style={{ maxWidth: 1200, alignSelf: 'center', width: '100%' }}
            >
                {/* CANCEL pill + selection count + SAVE */}
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
                        <Text className="text-white text-[10px] font-bold uppercase tracking-widest" style={{ fontFamily: 'VCR_OSD_MONO' }}>BACK</Text>
                    </Pressable>

                    <View className="flex-row items-center gap-3">
                        {selectedIds.size > 0 && (
                            <Text className="text-neutral-500 font-mono text-[10px]">
                                {selectedIds.size} SELECTED
                            </Text>
                        )}
                        <Pressable
                            onPress={handleSave}
                            disabled={!canSave}
                            className={`px-4 py-1.5 rounded-full active:opacity-80 ${canSave ? 'bg-amber-600' : 'bg-neutral-800'}`}
                        >
                            <Text className={`text-[11px] font-bold tracking-widest font-mono ${canSave ? 'text-white' : 'text-neutral-600'}`}>
                                {bulkUpdateMutation.isPending ? 'SAVING...' : 'SAVE STACK'}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* Stack Name — read-only when adding to an existing list */}
                {isEditingExisting ? (
                    <View className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 mb-3">
                        <Text className="text-amber-500 font-mono text-sm uppercase tracking-widest">{listName}</Text>
                    </View>
                ) : (
                    <TextInput
                        nativeID="create-list-name-input"
                        placeholder="NAME THIS STACK (e.g. Action Flicks)..."
                        placeholderTextColor="#525252"
                        value={listName}
                        onChangeText={setListName}
                        className="bg-neutral-900 border border-neutral-800 text-white font-mono rounded-lg px-4 py-2.5 mb-3 text-sm"
                        onSubmitEditing={() => Keyboard.dismiss()}
                    />
                )}

                {/* Status Filter (Owned / Wishlist / All) */}
                <View className="flex-row gap-2 mb-3">
                    {(['owned', 'wishlist', 'all'] as const).map((s) => {
                        const isActive = statusFilter === s;
                        const label = s === 'owned' ? 'OWNED' : s === 'wishlist' ? 'WISHLIST' : 'ALL';
                        return (
                            <Pressable
                                key={s}
                                onPress={() => setStatusFilter(s)}
                                className={`px-3 py-1.5 rounded-full border ${isActive ? 'bg-amber-600 border-amber-500' : 'bg-neutral-900 border-neutral-800'
                                    }`}
                            >
                                <Text className={`font-mono text-[10px] font-bold ${isActive ? 'text-white' : 'text-neutral-400'
                                    }`}>{label}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Search + Format Filters */}
                <View className="flex-row items-center gap-2 mb-2">
                    <TextInput
                        nativeID="create-list-search-input"
                        placeholder="Search collection..."
                        placeholderTextColor="#525252"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        className="bg-neutral-900 border border-neutral-800 text-white font-mono rounded-md px-3 py-2 flex-1 text-xs"
                    />
                    {['ALL', 'VHS', 'DVD', 'BluRay', '4K', 'Digital'].map((fmt) => {
                        const isActive = formatFilter === fmt || (fmt === 'ALL' && !formatFilter);
                        return (
                            <Pressable
                                key={fmt}
                                onPress={() => setFormatFilter(fmt === 'ALL' ? null : fmt)}
                                className={`px-2.5 py-2 rounded border ${isActive ? 'bg-amber-600 border-amber-500' : 'bg-neutral-900 border-neutral-800'}`}
                            >
                                <Text className={`font-mono text-[10px] ${isActive ? 'text-white font-bold' : 'text-neutral-400'}`}>{fmt}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Poster Size Slider */}
                <View className="flex-row items-center gap-2 pb-1">
                    <FontAwesome name="th" size={12} color="#525252" />
                    <Slider
                        style={{ flex: 1, height: 28 }}
                        minimumValue={2}
                        maximumValue={isDesktop ? 10 : 7}
                        step={1}
                        value={numColumns}
                        onValueChange={(val) => setNumColumns(val)}
                        minimumTrackTintColor="#f59e0b"
                        maximumTrackTintColor="#262626"
                        thumbTintColor="#f59e0b"
                    />
                    <FontAwesome name="th-large" size={12} color="#525252" />
                </View>
            </View>

            {/* ── Poster Grid ── */}
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
