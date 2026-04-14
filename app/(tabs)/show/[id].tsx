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

import { ImageCropModal } from '@/components/ImageCropModal';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { useAddToCollection, useCollection, useDeleteCollectionItem, useUpdateCollectionItem } from '@/hooks/useCollection';
import { useCreatePost } from '@/hooks/useSocial';
import { CommentSection } from '@/components/CommentSection';
import { deleteFromCloudinary, uploadToCloudinary } from '@/lib/cloudinary';
import { getCustomLists } from '@/lib/collection-utils';

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
    const { id, fromStack, ownerId } = useLocalSearchParams<{ id: string; fromStack?: string; ownerId?: string }>();
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
    const [localBootlegs, setLocalBootlegs] = useState<Record<string, boolean>>({});
    const [persistedShow, setPersistedShow] = useState<any>(null);
    const viewShotRef = useRef<ViewShot>(null);

    // Custom art state
    const [customArtUri, setCustomArtUri] = useState<string | null>(null);
    const [customArtType, setCustomArtType] = useState<'poster' | 'backdrop'>('poster');
    const [cropModalVisible, setCropModalVisible] = useState(false);
    const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
    const [showEditionModal, setShowEditionModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [pendingFormat, setPendingFormat] = useState<string | null>(null);
    const [editionInput, setEditionInput] = useState('');

    // Curated Stacks State
    const [showNewStackInput, setShowNewStackInput] = useState(false);
    const [newStackName, setNewStackName] = useState('');

    // Bulletin Board State
    const [showPostModal, setShowPostModal] = useState(false);
    const [postContent, setPostContent] = useState('');
    const createPostMutation = useCreatePost(userId);

    const handleCreatePost = () => {
        if (!postContent.trim()) return;
        createPostMutation.mutate({
            content: postContent,
            collection_item_id: showItems[0]?.id,
            show_id: showIdNum,
            rating: showItems[0]?.rating || null,
        }, {
            onSuccess: () => {
                setShowPostModal(false);
                setPostContent('');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        });
    };

    const targetUserId = ownerId && typeof ownerId === 'string' ? ownerId : userId;
    const isReadOnly = !!ownerId && ownerId !== userId;
    
    const { data: collection, refetch } = useCollection(targetUserId);
    const updateMutation = useUpdateCollectionItem(userId);
    const deleteMutation = useDeleteCollectionItem(userId);
    const addMutation = useAddToCollection(userId);

    // For TV shows, we group by show_id and season_number.
    const showIdNum = typeof id === 'string' ? parseInt(id, 10) : undefined;
    const { season: seasonQuery } = useLocalSearchParams<{ season?: string }>();
    const seasonNumber = seasonQuery && seasonQuery !== 'undefined' && seasonQuery !== 'null' ? parseInt(seasonQuery, 10) : 1;

    // Find items matching this show and season locally first
    const showItems = collection?.filter((item: any) => {
        const itemShowId = item.show_id;
        return (itemShowId === showIdNum || (item.shows?.id === showIdNum));
    }).filter((item: any) => seasonNumber === undefined || item.season_number === seasonNumber) ?? [];

    const commentActiveItem = showItems[0];

    const showFromDb = showItems[0]?.shows;

    const { data: tmdbShow, isLoading: tmdbLoading } = useQuery({
        queryKey: ['tmdb-show', showFromDb?.tmdb_id || showIdNum],
        queryFn: async () => {
            const tmdbId = showFromDb?.tmdb_id || showIdNum;
            if (!tmdbId) return null;
            return getTvShowById(tmdbId);
        },
        enabled: !!collection,
    });


    const show = showItems[0]?.shows;
    const activeShow = show || persistedShow || tmdbShow;

    const [isNotFound, setIsNotFound] = useState(false);

    useEffect(() => {
        if (show && !persistedShow) {
            setPersistedShow(show);
        }
        // If collection is loaded and we still have no show, it's not found
        if (collection && showItems.length === 0 && !persistedShow && !activeShow) {
            const timer = setTimeout(() => setIsNotFound(true), 3000);
            return () => clearTimeout(timer);
        } else {
            setIsNotFound(false);
        }
    }, [show, persistedShow, collection, showItems.length]);


    const customArtUrl = showItems.find((i: any) => i.custom_poster_url)?.custom_poster_url;
    const customBackdropUrl = showItems.find((i: any) => i.custom_backdrop_url)?.custom_backdrop_url;

    const handleUploadCustomArt = async (type: 'poster' | 'backdrop' = 'poster') => {
        setCustomArtType(type);
        try {
            // Request permissions first
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'We need permission to access your photos to upload custom art.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: type === 'poster' ? [2, 3] : [16, 9],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setPendingImageUri(result.assets[0].uri);
                setCropModalVisible(true);
            }
        } catch (error) {
            console.error('Upload initiation error:', error);
            Alert.alert('Error', 'Could not open image library');
        }
    };

    // Removed handleWebFileChange as we now use ImagePicker for web too

    const handleSaveCustomArt = async (croppedDataUrl: string) => {
        if (!showItems[0]?.id) {
            Alert.alert('Error', 'Could not find collection item for upload');
            return;
        }
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
            console.error('Cloudinary upload failure:', e);
            Alert.alert('Upload Error', e.message || 'Failed to save custom art');
        }
    };

    const handleRemoveCustomArt = async (type: 'poster' | 'backdrop' = 'poster') => {
        if (!showItems[0]?.id) return;
        const confirmRemove = async () => {
            const oldUrl = type === 'poster' ? customArtUrl : customBackdropUrl;
            const updates: any = {};
            if (type === 'poster') updates.custom_poster_url = null;
            else updates.custom_backdrop_url = null;
            await updateMutation.mutateAsync({ itemId: showItems[0].id, updates });
            if (oldUrl) deleteFromCloudinary(oldUrl);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        };
        if (Platform.OS === 'web') {
            if (window.confirm('Remove custom art?')) confirmRemove();
        } else {
            Alert.alert('Remove Custom Art', 'Restore default art?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: confirmRemove },
            ]);
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

    const handleCreateStack = async () => {
        if (!newStackName.trim()) return;
        await handleToggleStack(newStackName.trim());
        setNewStackName('');
        setShowNewStackInput(false);
    };

    const handleConfirmDelete = async () => {
        try {
            setShowDeleteModal(false);
            setEjecting(true);
            playSound('eject');
            await new Promise(resolve => setTimeout(resolve, 2000));
            await Promise.all(showItems.map((item: any) => deleteMutation.mutateAsync(item.id)));
            if (refetch) await refetch();

            setEjecting(false);

            if (fromStack) {
                router.replace(`/stack/${fromStack}` as any);
            } else if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/(tabs)/home' as any);
            }
        } catch (e) {
            setEjecting(false);
            Alert.alert('Error', 'Could not delete show');
        }
    };

    const deleteShow = () => {
        setShowDeleteModal(true);
    };

    if (isNotFound) {
        return (
            <View className="flex-1 bg-neutral-950 items-center justify-center p-8">
                <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
                <Text className="text-white font-bold text-lg mt-4 text-center">Show Not Found</Text>
                <Text className="text-neutral-500 text-center mt-2">Could not find this show in your collection.</Text>
                <Pressable onPress={() => router.back()} className="mt-8 bg-neutral-800 px-6 py-3 rounded-lg">
                    <Text className="text-white font-bold">GO BACK</Text>
                </Pressable>
            </View>
        );
    }

    if ((!activeShow && tmdbLoading) || !showIdNum) {
        return (
            <View className="flex-1 bg-neutral-950 items-center justify-center">
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text className="text-amber-500 font-mono text-xs mt-4 uppercase tracking-widest">Fetching Signal...</Text>
            </View>
        );
    }

    if (!activeShow) {
        return (
            <View className="flex-1 bg-neutral-950 items-center justify-center p-8">
                <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
                <Text className="text-white font-bold text-lg mt-4 text-center">Metadata Lost</Text>
                <Text className="text-neutral-500 text-center mt-2">Could not synchronize metadata for this frequency.</Text>
                <Pressable onPress={() => router.back()} className="mt-8 bg-neutral-800 px-6 py-3 rounded-lg">
                    <Text className="text-white font-bold">RE-TUNE</Text>
                </Pressable>
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

    const activeItem = showItems.find((i: any) => i.format === activeFormat);
    const isBootleg = (activeItem && localBootlegs[activeItem.id] !== undefined)
        ? localBootlegs[activeItem.id]
        : (activeItem?.is_bootleg || false);

    const handleConfirmAddFormat = async () => {
        if (!pendingFormat || !activeShow) return;
        try {
            await addMutation.mutateAsync({
                tmdbItem: activeShow,
                formats: [pendingFormat as MovieFormat],
                status: thriftMode ? 'wishlist' : 'owned',
                edition: editionInput.trim() || null,
                seasonNumber: seasonNumber
            });
            playSound(pendingFormat === 'VHS' ? 'insert' : 'click');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSelectedFormat(pendingFormat);
            setShowEditionModal(false);
            setPendingFormat(null);
            setEditionInput('');
        } catch (e: any) {
            const msg = e?.message || String(e);
            if (msg.startsWith('WISHLIST_CONFLICT:::')) {
                const [, conflictId, formatName] = msg.split(':::');
                const title = activeShow.name;
                if (Platform.OS === 'web') {
                  if (window.confirm(`${title} (${formatName}) is on your wishlist. Do you want to mark it as acquired?`)) {
                    updateMutation.mutate({ itemId: conflictId, updates: { status: 'owned' } });
                    setShowEditionModal(false);
                    setPendingFormat(null);
                  }
                } else {
                  Alert.alert('On Wishlist', `${title} (${formatName}) is on your wishlist. Do you want to mark it as acquired?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Mark as Acquired', onPress: () => {
                        updateMutation.mutate({ itemId: conflictId, updates: { status: 'owned' } });
                        setShowEditionModal(false);
                        setPendingFormat(null);
                    }}
                  ]);
                }
                return;
            }
            Alert.alert('Error', 'Failed to add format');
        }
    };

    return (
        <View className="flex-1 bg-neutral-950">
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* ImagePicker is now used for both web and native for better mobile browser compatibility */}

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 120, width: '100%' }}>
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
                    <Pressable onPress={() => setShowShareModal(true)} className="absolute top-12 right-16 bg-black/50 p-2 rounded-full">
                        <Ionicons name="share-outline" size={24} color="white" />
                    </Pressable>
                </View>

                <View className="max-w-7xl mx-auto w-full px-4 md:px-8 -mt-20">
                    <View className="flex-row items-start">
                        <View className="w-24 rounded-lg shadow-xl relative">
                            {(() => {
                                const finalPosterUrl = customArtUrl || posterUrl;
                                if (activeFormat === 'VHS') return <VHSCard posterUrl={finalPosterUrl} isCustom={!!customArtUrl} style={{ width: '100%' }} />;
                                if (activeFormat && ['DVD', 'BluRay', '4K'].includes(activeFormat)) return <GlossyCard posterUrl={finalPosterUrl} format={activeFormat as MovieFormat} isCustom={!!customArtUrl} style={{ width: '100%' }} />;
                                return <Image source={{ uri: finalPosterUrl }} style={{ width: '100%', aspectRatio: 2 / 3, borderRadius: 8 }} contentFit="cover" />;
                            })()}

                            {/* Bootleg Sticker - TOP LEVEL */}
                            {isBootleg && (
                                <View style={{ position: 'absolute', bottom: 4, left: 4, zIndex: 9999 }}>
                                    <Image
                                        source={require('@/assets/images/overlays/boot_sticker.png')}
                                        style={{ width: 38, height: 38 }}
                                        contentFit="contain"
                                    />
                                </View>
                            )}
                        </View>
                        <View className="flex-1 ml-4 pt-1">
                            {showItems.length > 0 && (
                                <View className="flex-row items-center gap-2 mb-3 flex-wrap">
                                    <View className="flex-row items-center">
                                        <Pressable onPress={() => handleUploadCustomArt('poster')} className="bg-amber-600/10 border border-amber-600/30 px-3 py-2 rounded flex-row items-center">
                                            <Ionicons name="image-outline" size={12} color="#f59e0b" />
                                            <Text className="ml-1.5 font-mono text-[10px] font-bold text-amber-500">{customArtUrl ? 'CHANGE COVER' : 'UPLOAD COVER'}</Text>
                                        </Pressable>
                                        {customArtUrl && (
                                            <Pressable onPress={() => handleRemoveCustomArt('poster')} className="ml-1.5 bg-red-900/20 px-2 py-2 rounded border border-red-900/40 items-center justify-center">
                                                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                            </Pressable>
                                        )}
                                    </View>
                                    <View className="flex-row items-center">
                                        <Pressable onPress={() => handleUploadCustomArt('backdrop')} className="bg-blue-600/10 border border-blue-600/30 px-3 py-2 rounded flex-row items-center">
                                            <Ionicons name="images-outline" size={12} color="#60a5fa" />
                                            <Text className="ml-1.5 font-mono text-[10px] font-bold text-blue-400">{customBackdropUrl ? 'CHANGE BACKDROP' : 'UPLOAD BACKDROP'}</Text>
                                        </Pressable>
                                        {customBackdropUrl && (
                                            <Pressable onPress={() => handleRemoveCustomArt('backdrop')} className="ml-1.5 bg-red-900/20 px-2 py-2 rounded border border-red-900/40 items-center justify-center">
                                                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                            </Pressable>
                                        )}
                                    </View>
                                </View>
                            )}
                            <Text className="text-white font-bold text-xl leading-6 mb-0.5">{displayShow.name}</Text>
                            <Text className="text-neutral-500 font-mono text-xs">
                                Season {seasonNumber} • {displayShow.first_air_date?.slice(0, 4) || '????'}
                            </Text>
                        </View>
                    </View>
                    <View className="flex-row mt-6 gap-2">
                        {thriftMode ? (
                            <Pressable
                                onPress={async () => {
                                    const isGrail = showItems.some((i: any) => i.is_grail);
                                    await Promise.all(showItems.map((item: any) =>
                                        updateMutation.mutateAsync({ itemId: item.id, updates: { is_grail: !isGrail } })
                                    ));
                                    playSound('peel');
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                }}
                                className={`flex-1 flex-row items-center justify-center p-3 rounded-lg border ${showItems.some((i: any) => i.is_grail) ? 'bg-amber-500/10 border-amber-500' : 'bg-neutral-900 border-neutral-800'}`}
                            >
                                <Ionicons name={showItems.some((i: any) => i.is_grail) ? "trophy" : "trophy-outline"} size={16} color={showItems.some((i: any) => i.is_grail) ? "#f59e0b" : "#404040"} />
                                <Text className={`ml-2 font-mono text-xs font-bold tracking-widest ${showItems.some((i: any) => i.is_grail) ? 'text-amber-500' : 'text-neutral-600'}`}>
                                    {showItems.some((i: any) => i.is_grail) ? 'GRAIL' : 'MAKE GRAIL'}
                                </Text>
                            </Pressable>
                        ) : (
                            <Pressable
                                onPress={async () => {
                                    const isOnDisplay = showItems.some((i: any) => i.is_on_display);
                                    await Promise.all(showItems.map((item: any) =>
                                        updateMutation.mutateAsync({ itemId: item.id, updates: { is_on_display: !isOnDisplay } })
                                    ));
                                    playSound('click');
                                }}
                                className={`flex-1 flex-row items-center justify-center p-3 rounded-lg border ${showItems.some((i: any) => i.is_on_display) ? 'bg-indigo-500/10 border-indigo-500' : 'bg-neutral-900 border-neutral-800'}`}
                            >
                                <Ionicons name={showItems.some((i: any) => i.is_on_display) ? "star" : "star-outline"} size={16} color={showItems.some((i: any) => i.is_on_display) ? "#6366f1" : "#404040"} />
                                <Text className={`ml-2 font-mono text-xs font-bold tracking-widest ${showItems.some((i: any) => i.is_on_display) ? 'text-indigo-500' : 'text-neutral-600'}`}>
                                    {showItems.some((i: any) => i.is_on_display) ? 'STAFF PICK' : 'MAKE STAFF PICK'}
                                </Text>
                            </Pressable>
                        )}
                        {showItems.length > 0 && !isReadOnly && (
                            <>
                                <Pressable onPress={deleteShow} className="bg-red-900/10 px-4 rounded-lg border border-red-900/40 items-center justify-center">
                                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                </Pressable>
                                {/* PIN TO BULLETIN BOARD */}
                                {!thriftMode && (
                                    <Pressable 
                                        onPress={() => setShowPostModal(true)}
                                        className="bg-amber-600/10 px-4 rounded-lg border border-amber-600/40 items-center justify-center"
                                    >
                                        <Ionicons name="pin" size={20} color="#f59e0b" />
                                    </Pressable>
                                )}
                            </>
                        )}
                    </View>

                    {activeShow.show_cast && activeShow.show_cast.length > 0 && (
                        <View className="mt-8 mb-2">
                            <Text className="text-white font-bold text-lg mb-3 font-mono">STARRING</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {activeShow.show_cast.map((member: any) => (
                                    <View key={member.id} className="mr-4 items-center w-20">
                                        <View className="w-16 h-16 rounded-full overflow-hidden bg-neutral-800 mb-2 border border-neutral-700">
                                            {member.profile_path ? (
                                                <Image source={{ uri: `https://image.tmdb.org/t/p/w185${member.profile_path}` }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                            ) : (
                                                <View className="flex-1 items-center justify-center"><Ionicons name="person" size={24} color="#525252" /></View>
                                            )}
                                        </View>
                                        <Text className="text-white text-[10px] text-center font-bold leading-3 mb-0.5" numberOfLines={2}>{member.name}</Text>
                                        <Text className="text-neutral-500 text-[9px] text-center leading-3" numberOfLines={2}>{member.character}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    <View className="mt-6">
                        <Text className="text-amber-500 font-bold text-xl mb-4 font-mono uppercase tracking-widest" style={{ fontFamily: 'VCR_OSD_MONO' }}>Overview</Text>
                        <Text className="text-neutral-400 leading-6">{displayShow.overview || "No overview available."}</Text>
                    </View>

                    {ownedFormats.length > 0 && !isReadOnly && (
                        <View className="mt-8">
                            <Text className="text-white font-bold mb-3">Format Notes</Text>
                            {showItems.map((item: any) => (
                                <View key={item.id} className="mb-4">
                                    <View className="flex-row items-center flex-wrap mb-2">
                                        <View className={`px-2 py-1 rounded shrink-0 ${FORMAT_COLORS[item.format] || 'bg-neutral-800'}`}>
                                            <Text className="text-white font-mono text-xs font-bold">{item.format === 'BluRay' ? 'Blu-ray' : item.format}</Text>
                                        </View>
                                        <Pressable
                                            onPress={async () => {
                                                const isBoot = localBootlegs[item.id] !== undefined ? localBootlegs[item.id] : (item.is_bootleg || false);
                                                const newVal = !isBoot;
                                                setLocalBootlegs(prev => ({ ...prev, [item.id]: newVal }));
                                                playSound('click');
                                                await updateMutation.mutateAsync({
                                                    itemId: item.id,
                                                    updates: { is_bootleg: newVal }
                                                });
                                            }}
                                            className={`ml-2 px-2 py-1 rounded border ${(localBootlegs[item.id] !== undefined ? localBootlegs[item.id] : (item.is_bootleg || false)) ? 'bg-red-500 border-red-400' : 'bg-neutral-800 border-neutral-700'}`}
                                        >
                                            <Text className="text-white font-mono text-[10px] font-bold">BOOT</Text>
                                        </Pressable>
                                        {item.edition && (
                                            <Text className="text-neutral-500 font-mono text-xs ml-2 flex-1" style={{ minWidth: 100 }}>({item.edition})</Text>
                                        )}
                                    </View>
                                    <TextInput
                                        className="bg-neutral-900 text-white p-3 rounded-lg border border-neutral-800 font-mono text-sm mb-2"
                                        placeholder="Edition (e.g. Special Edition)"
                                        placeholderTextColor="#525252"
                                        value={localEditions[item.id] !== undefined ? localEditions[item.id] : (item.edition || '')}
                                        onChangeText={(text) => setLocalEditions(prev => ({ ...prev, [item.id]: text }))}
                                    />
                                    <TextInput
                                        className="bg-neutral-900 text-white p-3 rounded-lg border border-neutral-800 font-mono text-sm min-h-[80px]"
                                        placeholder="Add notes..."
                                        placeholderTextColor="#525252"
                                        multiline
                                        value={localNotes[item.id] !== undefined ? localNotes[item.id] : (item.notes || '')}
                                        onChangeText={(text) => setLocalNotes(prev => ({ ...prev, [item.id]: text }))}
                                    />
                                    <Pressable
                                        onPress={async () => {
                                            const noteToSave = localNotes[item.id] !== undefined ? localNotes[item.id] : (item.notes || '');
                                            const editionToSave = localEditions[item.id] !== undefined ? localEditions[item.id] : (item.edition || '');
                                            const bootToSave = localBootlegs[item.id] !== undefined ? localBootlegs[item.id] : (item.is_bootleg || false);
                                            await updateMutation.mutateAsync({
                                                itemId: item.id,
                                                updates: {
                                                    notes: noteToSave,
                                                    edition: editionToSave || null,
                                                    is_bootleg: bootToSave
                                                }
                                            });
                                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                        }}
                                        className="mt-2 self-end px-4 py-2 bg-amber-600/10 border border-amber-600/50 rounded-lg"
                                    >
                                        <Text className="text-amber-500 font-mono text-xs font-bold">SAVE {item.format === 'BluRay' ? 'Blu-ray' : item.format}</Text>
                                    </Pressable>
                                </View>
                            ))}
                        </View>
                    )}

                    {!isReadOnly && (
                        <View className="mt-8">
                            <Text className="text-white font-bold mb-3">Curated Stacks</Text>
                        <View className="flex-row flex-wrap gap-2 mb-2">
                            {getCustomLists(collection).map(listName => {
                                const isInStack = showItems.some((i: any) => i.custom_lists?.includes(listName));
                                return (
                                    <Pressable key={listName} onPress={() => handleToggleStack(listName)} className={`px-3 py-1.5 border rounded-full flex-row items-center gap-1 ${isInStack ? 'bg-amber-600/20 border-amber-500' : 'bg-neutral-900 border-neutral-700'}`}>
                                        <Ionicons name={isInStack ? 'checkmark' : 'add'} size={14} color={isInStack ? '#f59e0b' : '#a3a3a3'} />
                                        <Text className={`font-mono text-xs ${isInStack ? 'text-amber-500 font-bold' : 'text-neutral-400'}`}>{listName}</Text>
                                    </Pressable>
                                );
                            })}
                            <Pressable onPress={() => setShowNewStackInput(!showNewStackInput)} className="px-3 py-1.5 border border-dashed border-neutral-700 rounded-full flex-row items-center gap-1">
                                <Ionicons name="add" size={14} color="#a3a3a3" />
                                <Text className="font-mono text-xs text-neutral-400">NEW STACK</Text>
                            </Pressable>
                        </View>
                        {showNewStackInput && (
                            <View className="flex-row gap-2 mt-2">
                                <TextInput
                                    className="flex-1 bg-neutral-900 text-white p-3 rounded-lg border border-neutral-800 font-mono text-sm"
                                    placeholder="STACK NAME..."
                                    placeholderTextColor="#525252"
                                    value={newStackName}
                                    onChangeText={setNewStackName}
                                    autoFocus
                                />
                                <Pressable onPress={handleCreateStack} className="bg-amber-600 px-6 rounded-lg items-center justify-center">
                                    <Text className="text-white font-bold font-mono text-sm">ADD</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>
                    )}

                    {!isReadOnly && (
                        <View className="mt-8">
                            <Text className="text-white font-bold mb-3">Add Format</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {FORMATS.map(fmt => (
                                    <Pressable key={fmt} onPress={() => { setPendingFormat(fmt); setEditionInput(''); setShowEditionModal(true); }} className={`px-4 py-2 border rounded-full ${FORMAT_COLORS[fmt] || 'bg-neutral-800'} border-neutral-700`}>
                                        <Text className="text-white font-mono font-bold">{fmt === 'BluRay' ? 'Blu-ray' : fmt}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    )}
                    
                    {commentActiveItem?.id && (
                        <View className="px-4 md:px-8 mb-12">
                            <CommentSection collectionItemId={commentActiveItem.id} />
                        </View>
                    )}
                </View>
            </ScrollView>

            <ImageCropModal
                visible={cropModalVisible}
                imageUri={pendingImageUri || ''}
                targetRatio={customArtType === 'poster' ? 2 / 3 : 16 / 9}
                onClose={() => { setCropModalVisible(false); setPendingImageUri(null); }}
                onSave={handleSaveCustomArt}
            />

            {/* Delete Confirmation Modal */}
            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <View className="flex-1 bg-black/80 items-center justify-center p-4">
                    <View className="bg-neutral-900 rounded-lg p-6 w-full max-w-sm border border-neutral-800 shadow-xl">
                        <Ionicons name="trash-outline" size={32} color="#ef4444" style={{ alignSelf: 'center', marginBottom: 16 }} />
                        <Text className="text-white font-bold text-center text-xl mb-2">Delete Show</Text>
                        <Text className="text-neutral-400 font-mono text-center text-sm mb-6">
                            Are you sure you want to remove this show and all formats from your collection?
                        </Text>
                        <View className="flex-row gap-3">
                            <Pressable 
                                onPress={() => setShowDeleteModal(false)}
                                className="flex-1 bg-neutral-800 py-3 rounded-lg items-center border border-neutral-700"
                            >
                                <Text className="text-white font-mono font-bold">CANCEL</Text>
                            </Pressable>
                            <Pressable 
                                onPress={handleConfirmDelete}
                                className="flex-1 bg-red-600 border border-red-500 py-3 rounded-lg items-center shadow shadow-red-900/50"
                            >
                                <Text className="text-white font-mono font-bold">DELETE</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Post to Bulletin Board Modal */}
            <Modal
                visible={showPostModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPostModal(false)}
            >
                <View className="flex-1 bg-black/80 items-center justify-center p-4">
                    <View className="bg-yellow-100/90 rounded p-4 w-full max-w-sm shadow-xl" style={{ transform: [{ rotate: '-1deg' }] }}>
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="bg-red-500 w-3 h-3 rounded-full" />
                            <Text className="font-mono text-sm font-bold text-neutral-800">RECOMMEND TITLE</Text>
                        </View>
                        <TextInput
                            className="font-mono text-sm text-neutral-900 min-h-[80px]"
                            placeholder="Write a recommendation or review..."
                            placeholderTextColor="#78716c"
                            multiline
                            value={postContent}
                            onChangeText={setPostContent}
                            autoFocus
                        />
                        <View className="flex-row justify-end mt-4 gap-2">
                            <Pressable 
                                onPress={() => setShowPostModal(false)}
                                className="px-4 py-2 border border-neutral-400 rounded"
                            >
                                <Text className="font-mono font-bold text-xs text-neutral-700">CANCEL</Text>
                            </Pressable>
                            <Pressable 
                                onPress={handleCreatePost}
                                disabled={createPostMutation.isPending || !postContent.trim()}
                                className={`px-4 py-2 bg-neutral-900 rounded ${!postContent.trim() ? 'opacity-50' : ''}`}
                            >
                                <Text className="text-white font-mono font-bold text-xs">
                                    {createPostMutation.isPending ? 'PINNING...' : 'PIN TO BOARD'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showEditionModal} transparent animationType="fade">
                <View className="flex-1 bg-black/80 items-center justify-center p-4">
                    <View className="bg-neutral-900 rounded-lg p-6 w-full max-w-md border border-neutral-800">
                        <Text className="text-white font-bold text-lg mb-4">Add {pendingFormat}</Text>
                        <TextInput
                            className="bg-neutral-800 text-white p-3 rounded-lg border border-neutral-700 font-mono text-sm mb-4"
                            placeholder="Edition (e.g., Box Set)"
                            placeholderTextColor="#525252"
                            value={editionInput}
                            onChangeText={setEditionInput}
                            autoFocus
                        />
                        <View className="flex-row gap-2">
                            <Pressable onPress={() => setShowEditionModal(false)} className="flex-1 bg-neutral-800 py-3 rounded-lg items-center text-neutral-400 font-mono text-sm font-bold"><Text className="text-neutral-400">CANCEL</Text></Pressable>
                            <Pressable onPress={handleConfirmAddFormat} className="flex-1 bg-amber-600 py-3 rounded-lg items-center text-white font-mono text-sm font-bold"><Text className="text-white">ADD</Text></Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
