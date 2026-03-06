import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlossyCard } from '@/components/GlossyCard';
import { NoPosterPlaceholder } from '@/components/NoPosterPlaceholder';
import { VHSCard } from '@/components/VHSCard';

import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { useAddToCollection, useCollection, useDeleteCollectionItem, useUpdateCollectionItem } from '@/hooks/useCollection';
import { deleteFromCloudinary, uploadToCloudinary } from '@/lib/cloudinary';

import { getBackdropUrl, getPosterUrl } from '@/lib/dummy-data';
import { getTvShowById } from '@/lib/tmdb';
import type { MovieFormat } from '@/types/database';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import ViewShot from 'react-native-view-shot';

const FORMATS: MovieFormat[] = ['VHS', 'DVD', 'BluRay', '4K', 'Digital'];

const FORMAT_COLORS: Record<string, string> = {
    '4K': 'bg-yellow-500',
    BluRay: 'bg-blue-500',
    DVD: 'bg-purple-500',
    VHS: 'bg-red-500',
    Digital: 'bg-green-500',
};

export default function ShowDetailScreen() {
    const { id, fromStack } = useLocalSearchParams<{ id: string; fromStack?: string }>();
    const router = useRouter();
    const { userId } = useAuth();
    const { thriftMode } = useThriftMode();
    const { playSound } = useSound();
    const insets = useSafeAreaInsets();
    const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
    const [ejecting, setEjecting] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
    const [localEditions, setLocalEditions] = useState<Record<string, string>>({});
    const [persistedShow, setPersistedShow] = useState<any>(null);
    const viewShotRef = useRef<ViewShot>(null);

    // Custom art state
    const [customArtUri, setCustomArtUri] = useState<string | null>(null);
    const [customArtType, setCustomArtType] = useState<'poster' | 'backdrop'>('poster');
    const [cropModalVisible, setCropModalVisible] = useState(false);
    const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
    const [showEditionModal, setShowEditionModal] = useState(false);
    const [pendingFormat, setPendingFormat] = useState<string | null>(null);
    const [editionInput, setEditionInput] = useState('');

    // Curated Stacks State
    const [showNewStackInput, setShowNewStackInput] = useState(false);
    const [newStackName, setNewStackName] = useState('');

    const { data: collection, refetch } = useCollection(userId);
    const updateMutation = useUpdateCollectionItem(userId);
    const deleteMutation = useDeleteCollectionItem(userId);
    const addMutation = useAddToCollection(userId);

    const showId = typeof id === 'string' ? id : undefined;

    // For TV shows, we group by show_id and season_number.
    // But this detail view is for a specific STACK (usually one season).
    // Wait, if they click a show from the home screen, it's a specific season stack.
    // So 'id' here is actually show_id-seasonNumber? No, the home screen routes to item.movie_id.
    // I need to update index.tsx to route to /show/${item.show_id}?season=${item.season_number}

    const { season: seasonQuery } = useLocalSearchParams<{ season?: string }>();
    const seasonNumber = seasonQuery && seasonQuery !== 'undefined' && seasonQuery !== 'null' ? parseInt(seasonQuery, 10) : 1;

    const showItems = collection?.filter((item: any) =>
        item.show_id === showId && (seasonNumber === undefined || item.season_number === seasonNumber)
    ) ?? [];

    const show = showItems[0]?.shows;
    const activeShow = show || persistedShow;

    useEffect(() => {
        if (show && !persistedShow) {
            setPersistedShow(show);
        }
    }, [show, persistedShow]);

    const { data: tmdbShow } = useQuery({
        queryKey: ['tmdb-show', activeShow?.tmdb_id],
        queryFn: async () => {
            if (!activeShow?.tmdb_id) return null;
            return getTvShowById(activeShow.tmdb_id);
        },
        enabled: !!activeShow?.tmdb_id,
    });

    const customArtUrl = showItems.find((i: any) => i.custom_poster_url)?.custom_poster_url;
    const customBackdropUrl = showItems.find((i: any) => i.custom_backdrop_url)?.custom_backdrop_url;

    const handleUploadCustomArt = async (type: 'poster' | 'backdrop' = 'poster') => {
        setCustomArtType(type);
        if (Platform.OS !== 'web') {
            try {
                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: type === 'poster' ? [2, 3] : [16, 9],
                    quality: 0.8,
                });
                if (!result.canceled && result.assets[0]) {
                    setPendingImageUri(result.assets[0].uri);
                    setCropModalVisible(true);
                }
            } catch (error) {
                Alert.alert('Error', 'Failed to open image library');
            }
        } else {
            const input = document.getElementById('custom-art-input') as HTMLInputElement;
            if (input) input.click();
        }
    };

    const handleSaveCustomArt = async (croppedDataUrl: string) => {
        if (!showItems[0]?.id) return;
        try {
            const oldUrl = customArtType === 'poster' ? customArtUrl : customBackdropUrl;
            const { url: uploadUrl } = await uploadToCloudinary(croppedDataUrl);
            const updates: any = {};
            if (customArtType === 'poster') updates.custom_poster_url = uploadUrl;
            else updates.custom_backdrop_url = uploadUrl;

            await updateMutation.mutateAsync({ itemId: showItems[0].id, updates });
            if (oldUrl) deleteFromCloudinary(oldUrl);

            setCropModalVisible(false);
            setPendingImageUri(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e: any) {
            Alert.alert('Upload Error', 'Failed to save custom art');
        }
    };

    const handleToggleStack = async (listName: string) => {
        playSound('click');
        const isInStack = showItems.some((i: any) => i.custom_lists?.includes(listName));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await Promise.all(showItems.map((item: any) => {
                const currentLists = item.custom_lists || [];
                const updatedLists = isInStack ? currentLists.filter((l: string) => l !== listName) : [...currentLists, listName];
                return updateMutation.mutateAsync({ itemId: item.id, updates: { custom_lists: updatedLists } });
            }));
        } catch (e) {
            Alert.alert('Error', 'Failed to update curated stack.');
        }
    };

    const deleteShow = async () => {
        const performDelete = async () => {
            try {
                setEjecting(true);
                playSound('eject');
                await new Promise(resolve => setTimeout(resolve, 2000));
                await Promise.all(showItems.map((item: any) => deleteMutation.mutateAsync(item.id)));
                if (refetch) refetch();
                router.back();
            } catch (e) {
                setEjecting(false);
                Alert.alert('Error', 'Could not delete show');
            }
        };
        if (Platform.OS === 'web') {
            if (window.confirm('Remove this show from your collection?')) performDelete();
        } else {
            Alert.alert('Delete Show', 'Remove this show from your collection?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: performDelete },
            ]);
        }
    };

    if (!activeShow || !showId) {
        return (
            <View className="flex-1 bg-neutral-950 items-center justify-center">
                <ActivityIndicator color="#f59e0b" />
            </View>
        );
    }

    const displayShow = { ...activeShow, ...tmdbShow };
    const backdropUrl = getBackdropUrl(displayShow.backdrop_path);
    const posterUrl = getPosterUrl(displayShow.poster_path);

    const ownedFormats = showItems.map((i: any) => i.format);
    const isGrail = showItems.some((i: any) => i.is_grail);

    const FORMAT_PRIORITY = ['4K', 'BluRay', 'DVD', 'VHS', 'Digital'];
    const activeFormat = (selectedFormat && ownedFormats.includes(selectedFormat))
        ? selectedFormat
        : (ownedFormats.length > 0
            ? [...ownedFormats].sort((a, b) => FORMAT_PRIORITY.indexOf(a) - FORMAT_PRIORITY.indexOf(b))[0]
            : null);

    const handleConfirmAddFormat = async () => {
        if (!pendingFormat || !activeShow) return;
        try {
            await addMutation.mutateAsync({
                tmdbItem: activeShow, // useAddToCollection handles TmdbMediaResult
                formats: [pendingFormat as MovieFormat],
                status: 'owned',
                edition: editionInput.trim() || null,
                seasonNumber: seasonNumber
            });
            playSound(pendingFormat === 'VHS' ? 'insert' : 'click');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSelectedFormat(pendingFormat);
            setShowEditionModal(false);
            setPendingFormat(null);
            setEditionInput('');
        } catch (e) {
            Alert.alert('Error', 'Failed to add format');
        }
    };

    return (
        <View className="flex-1 bg-neutral-950">
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 120, maxWidth: 1200, alignSelf: 'center', width: '100%' }}>
                <View className="relative h-72 w-full">
                    {(customBackdropUrl || backdropUrl) ? (
                        <Image source={{ uri: customBackdropUrl || backdropUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                        <NoPosterPlaceholder width="100%" height="100%" />
                    )}
                    <LinearGradient colors={['transparent', '#0a0a0a']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 }} />
                    <Pressable onPress={() => router.back()} className="absolute top-12 right-4 bg-black/50 p-2 rounded-full">
                        <Ionicons name="close" size={24} color="white" />
                    </Pressable>
                </View>

                <View className="px-8 -mt-20">
                    <View className="flex-row items-start">
                        <View className="w-24 rounded-lg shadow-xl relative">
                            {(() => {
                                const finalPosterUrl = customArtUrl || posterUrl;
                                if (activeFormat === 'VHS') return <VHSCard posterUrl={finalPosterUrl} isCustom={!!customArtUrl} style={{ width: '100%' }} />;
                                if (activeFormat && ['DVD', 'BluRay', '4K'].includes(activeFormat)) return <GlossyCard posterUrl={finalPosterUrl} format={activeFormat as MovieFormat} isCustom={!!customArtUrl} style={{ width: '100%' }} />;
                                return <Image source={{ uri: finalPosterUrl }} style={{ width: '100%', aspectRatio: 2 / 3, borderRadius: 8 }} contentFit="cover" />;
                            })()}
                        </View>
                        <View className="flex-1 ml-4 pt-1">
                            <Text className="text-white font-bold text-xl leading-6 mb-0.5">{displayShow.name}</Text>
                            <Text className="text-neutral-500 font-mono text-xs">
                                Season {seasonNumber} • {displayShow.first_air_date?.slice(0, 4) || '????'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View className="px-8 flex-row mt-6 gap-2">
                    <Pressable
                        onPress={async () => {
                            const isOnDisplay = showItems.some((i: any) => i.is_on_display);
                            await Promise.all(showItems.map((item: any) => updateMutation.mutateAsync({ itemId: item.id, updates: { is_on_display: !isOnDisplay } })));
                            playSound('click');
                        }}
                        className={`flex-1 flex-row items-center justify-center p-3 rounded-lg border ${showItems.some((i: any) => i.is_on_display) ? 'bg-indigo-500/10 border-indigo-500' : 'bg-neutral-900 border-neutral-800'}`}
                    >
                        <Ionicons name={showItems.some((i: any) => i.is_on_display) ? "star" : "star-outline"} size={16} color={showItems.some((i: any) => i.is_on_display) ? "#6366f1" : "#404040"} />
                        <Text className={`ml-2 font-mono text-xs font-bold tracking-widest ${showItems.some((i: any) => i.is_on_display) ? 'text-indigo-500' : 'text-neutral-600'}`}>STAFF PICK</Text>
                    </Pressable>
                    <Pressable onPress={deleteShow} className="bg-red-900/10 px-4 rounded-lg border border-red-900/40 items-center justify-center">
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </Pressable>
                </View>

                {/* Starring Section */}
                {activeShow.show_cast && activeShow.show_cast.length > 0 && (
                    <View className="mt-8 mb-2 px-8">
                        <Text className="text-white font-bold text-lg mb-3 font-mono">STARRING</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {activeShow.show_cast.map((member: any) => (
                                <View key={member.id} className="mr-4 items-center w-20">
                                    <View className="w-16 h-16 rounded-full overflow-hidden bg-neutral-800 mb-2 border border-neutral-700">
                                        {member.profile_path ? (
                                            <Image
                                                source={{ uri: `https://image.tmdb.org/t/p/w185${member.profile_path}` }}
                                                style={{ width: '100%', height: '100%' }}
                                                contentFit="cover"
                                            />
                                        ) : (
                                            <View className="flex-1 items-center justify-center">
                                                <Ionicons name="person" size={24} color="#525252" />
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-white text-[10px] text-center font-bold leading-3 mb-0.5" numberOfLines={2}>
                                        {member.name}
                                    </Text>
                                    <Text className="text-neutral-500 text-[9px] text-center leading-3" numberOfLines={2}>
                                        {member.character}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <View className="px-8 mt-6">
                    <Text className="text-white font-bold mb-2">Overview</Text>
                    <Text className="text-neutral-400 leading-6">{displayShow.overview || "No overview available."}</Text>
                </View>

                <View className="px-8 mt-8">
                    <Text className="text-white font-bold mb-3">Owned Formats</Text>
                    <View className="gap-2">
                        {showItems.map((item: any) => (
                            <View key={item.id} className="flex-row items-center justify-between bg-neutral-900 p-3 rounded-lg border border-neutral-800">
                                <View className="flex-1 flex-row items-center gap-2">
                                    <View className={`px-2 py-1 rounded ${FORMAT_COLORS[item.format] || 'bg-neutral-800'}`}>
                                        <Text className="text-white font-mono text-xs font-bold">{item.format}</Text>
                                    </View>
                                    {item.edition && <Text className="text-neutral-400 font-mono text-sm">({item.edition})</Text>}
                                </View>
                                <Pressable onPress={() => deleteMutation.mutateAsync(item.id)} className="bg-red-900/20 px-3 py-1 rounded border border-red-900/50">
                                    <Text className="text-red-400 font-mono text-xs">Remove</Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>
                </View>

                <View className="px-8 mt-8">
                    <Text className="text-white font-bold mb-3">Add Format</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {FORMATS.map(fmt => (
                            <Pressable
                                key={fmt}
                                onPress={() => {
                                    setPendingFormat(fmt);
                                    setEditionInput('');
                                    setShowEditionModal(true);
                                    playSound('click');
                                }}
                                className={`px-4 py-2 border rounded-full ${FORMAT_COLORS[fmt] || 'bg-neutral-800'} border-neutral-700`}
                            >
                                <Text className="text-white font-mono font-bold">{fmt}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Edition Modal */}
            <Modal visible={showEditionModal} transparent animationType="fade">
                <View className="flex-1 bg-black/80 items-center justify-center p-4">
                    <View className="bg-neutral-900 rounded-lg p-6 w-full max-w-md border border-neutral-800">
                        <Text className="text-white font-bold text-lg mb-4">Add {pendingFormat}</Text>
                        <TextInput
                            className="bg-neutral-800 text-white p-3 rounded-lg border border-neutral-700 font-mono text-sm mb-4"
                            placeholder="Edition (e.g., Box Set, Full Season)"
                            placeholderTextColor="#525252"
                            value={editionInput}
                            onChangeText={setEditionInput}
                            autoFocus
                        />
                        <View className="flex-row gap-2">
                            <Pressable onPress={() => setShowEditionModal(false)} className="flex-1 bg-neutral-800 py-3 rounded-lg items-center">
                                <Text className="text-neutral-400 font-mono text-sm font-bold">CANCEL</Text>
                            </Pressable>
                            <Pressable onPress={handleConfirmAddFormat} className="flex-1 bg-amber-600 py-3 rounded-lg items-center">
                                <Text className="text-white font-mono text-sm font-bold">ADD</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
