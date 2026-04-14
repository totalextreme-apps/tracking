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
import { ShareableCard } from '@/components/ShareableCard';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { useAddToCollection, useCollection, useDeleteCollectionItem, useUpdateCollectionItem } from '@/hooks/useCollection';
import { useCreatePost } from '@/hooks/useSocial';
import { ReviewSection } from '@/components/ReviewSection';
import { CommentSection } from '@/components/CommentSection';
import { deleteFromCloudinary, uploadToCloudinary } from '@/lib/cloudinary';
import { getCustomLists } from '@/lib/collection-utils';

import { getBackdropUrl, getPosterUrl } from '@/lib/dummy-data';
import { getMovieById } from '@/lib/tmdb';
import type { MovieFormat } from '@/types/database';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';

const FORMATS: MovieFormat[] = ['VHS', 'DVD', 'BluRay', '4K', 'Digital'];

const FORMAT_COLORS: Record<string, string> = {
    '4K': 'bg-yellow-500',
    BluRay: 'bg-blue-500',
    DVD: 'bg-purple-500',
    VHS: 'bg-red-500',
    Digital: 'bg-green-500',
};

export default function MovieDetailScreen() {
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
    const [persistedMovie, setPersistedMovie] = useState<any>(null);
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
            collection_item_id: movieItems[0]?.id,
            movie_id: movieId,
            rating: movieItems[0]?.rating || null,
        }, {
            onSuccess: () => {
                setShowPostModal(false);
                setPostContent('');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        });
    };

    // We use the main collection query and filter. 
    // In a generic app we might want a specific query for just this movie, 
    // but since we load the whole collection on home, this is cached and fast.
    const targetUserId = ownerId && typeof ownerId === 'string' ? ownerId : userId;
    const isReadOnly = !!ownerId && ownerId !== userId;
    
    const { data: collection, refetch } = useCollection(targetUserId);
    const updateMutation = useUpdateCollectionItem(userId);
    const deleteMutation = useDeleteCollectionItem(userId);
    const addMutation = useAddToCollection(userId);

    const movieId = typeof id === 'string' ? parseInt(id, 10) : undefined;

    const movieItems = collection?.filter((item: any) => item.movie_id === movieId) ?? [];
    const movie = movieItems[0]?.movies;

    // Comments State
    const commentActiveItem = movieItems[0];
    
    console.log('Movie items count:', movieItems.length, 'Formats:', movieItems.map((i: any) => i.format));

    console.log('Movie items count:', movieItems.length, 'Formats:', movieItems.map((i: any) => i.format));

    const activeMovie = movie || persistedMovie;

    useEffect(() => {
        if (movie && !persistedMovie) {
            setPersistedMovie(movie);
        }
    }, [movie, persistedMovie]);

    const { data: tmdbMovie } = useQuery({
        queryKey: ['tmdb', activeMovie?.tmdb_id],
        queryFn: async () => {
            if (!activeMovie?.tmdb_id) return null;
            return getMovieById(activeMovie.tmdb_id);
        },
        enabled: !!activeMovie?.tmdb_id,
    });

    // Load custom art from ANY collection item for this movie
    const customArtUrl = movieItems.find((i: any) => i.custom_poster_url)?.custom_poster_url;
    const customBackdropUrl = movieItems.find((i: any) => i.custom_backdrop_url)?.custom_backdrop_url;

    const handleUploadCustomArt = async (type: 'poster' | 'backdrop' = 'poster') => {
        console.log(`Upload custom ${type} clicked`, Platform.OS);
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
        if (!movieItems[0]?.id) {
            Alert.alert('Error', `No collection item found to attach this ${customArtType} to.`);
            return;
        }
        console.log(`Starting custom ${customArtType} save process...`);

        try {
            // Find existing art to delete later
            const oldUrl = customArtType === 'poster' ? customArtUrl : customBackdropUrl;

            let finalImageToUpload: any;

            if (Platform.OS === 'web') {
                // croppedDataUrl from cropToRatio is already resized and compressed to JPEG
                finalImageToUpload = croppedDataUrl;
            } else {
                console.log('Using native image file uri...');
                finalImageToUpload = croppedDataUrl;
            }

            // Upload to Cloudinary
            console.log('Uploading to Cloudinary...');
            const { url: uploadUrl } = await uploadToCloudinary(finalImageToUpload);
            console.log('Cloudinary upload success:', uploadUrl);

            // Save to Supabase
            console.log('Saving URL to Supabase...');
            const updates: any = {};
            if (customArtType === 'poster') updates.custom_poster_url = uploadUrl;
            else updates.custom_backdrop_url = uploadUrl;

            await updateMutation.mutateAsync({
                itemId: movieItems[0].id,
                updates
            });

            // Cleanup: Delete old art from Cloudinary if it existed
            if (oldUrl) {
                console.log('Cleaning up old image from Cloudinary:', oldUrl);
                deleteFromCloudinary(oldUrl); // Run in background
            }

            // Update UI
            setCropModalVisible(false);
            if (pendingImageUri && pendingImageUri.startsWith('blob:')) {
                URL.revokeObjectURL(pendingImageUri);
            }
            setPendingImageUri(null);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            console.log(`Custom ${customArtType} save complete!`);
        } catch (e: any) {
            console.error(`Failed to save custom ${customArtType}:`, e);
            setCropModalVisible(false);
            const errorMsg = e.message || JSON.stringify(e);
            Alert.alert('Upload Error', `Failed to save custom ${customArtType}. Error: ${errorMsg}`);
        }
    };

    const handleRemoveCustomArt = async (type: 'poster' | 'backdrop' = 'poster') => {
        if (!movieItems[0]?.id) return;

        const confirmRemove = async () => {
            const oldUrl = type === 'poster' ? customArtUrl : customBackdropUrl;

            const updates: any = {};
            if (type === 'poster') updates.custom_poster_url = null;
            else updates.custom_backdrop_url = null;

            await updateMutation.mutateAsync({
                itemId: movieItems[0].id,
                updates
            });

            if (oldUrl) {
                console.log(`Deleting custom ${type} from Cloudinary:`, oldUrl);
                deleteFromCloudinary(oldUrl);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        };


        if (Platform.OS === 'web') {
            if (window.confirm(`Remove custom ${type === 'poster' ? 'cover' : 'background'}? This will restore the default.`)) {
                confirmRemove();
            }
        } else {
            Alert.alert(
                `Remove Custom ${type === 'poster' ? 'Cover' : 'Background'}`,
                'This will restore the default.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: confirmRemove },
                ]
            );
        }
    };

    const handleToggleStack = async (listName: string) => {
        playSound('click');
        const isInStack = movieItems.some((i: any) => i.custom_lists?.includes(listName));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await Promise.all(movieItems.map((item: any) => {
                const currentLists = item.custom_lists || [];
                const updatedLists = isInStack
                    ? currentLists.filter((l: string) => l !== listName)
                    : [...currentLists, listName];

                return updateMutation.mutateAsync({
                    itemId: item.id,
                    updates: { custom_lists: updatedLists }
                });
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    if (!activeMovie || !movieId) {
        return (
            <View className="flex-1 bg-neutral-950 items-center justify-center">
                <ActivityIndicator color="#f59e0b" />
            </View>
        );
    }

    const displayMovie = { ...activeMovie, ...tmdbMovie }; // Merge DB and TMDB data

    // Use displayMovie for standard fields
    const backdropUrl = getBackdropUrl(displayMovie.backdrop_path);
    const posterUrl = getPosterUrl(displayMovie.poster_path);

    const ownedFormats: string[] = movieItems.map((i: any) => i.format);
    const isGrail = movieItems.some((i: any) => i.is_grail);
    const isWishlist = movieItems.every((i: any) => i.status === 'wishlist');

    // Derive active format — plain const (no hook) so it's safe after the early return above.
    // selectedFormat wins if it's still in the owned list; otherwise fall back to highest-priority owned format.
    const FORMAT_PRIORITY = ['4K', 'BluRay', 'DVD', 'VHS', 'Digital'];
    const activeFormat: string | null = (selectedFormat && ownedFormats.includes(selectedFormat))
        ? selectedFormat
        : (ownedFormats.length > 0
            ? [...ownedFormats].sort((a, b) => FORMAT_PRIORITY.indexOf(a) - FORMAT_PRIORITY.indexOf(b))[0]
            : null);

    const activeItem = movieItems.find((i: any) => i.format === activeFormat);
    const isBootleg = (activeItem && localBootlegs[activeItem.id] !== undefined)
        ? localBootlegs[activeItem.id]
        : (activeItem?.is_bootleg || false);

    // Logic to toggle format
    const toggleFormat = async (format: MovieFormat) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const existingItems = movieItems.filter((i: any) => i.format === format);

        try {
            if (existingItems.length > 0) {
                // Remove format (handle duplicates)
                await Promise.all(existingItems.map((i: any) => deleteMutation.mutateAsync(i.id)));
            } else {
                // Add format
                await addMutation.mutateAsync({
                    tmdbItem: {
                        id: activeMovie.tmdb_id,
                        title: activeMovie.title,
                        release_date: activeMovie.release_date ?? '',
                        poster_path: activeMovie.poster_path,
                        backdrop_path: activeMovie.backdrop_path,
                        overview: (activeMovie as any).overview ?? '',
                    } as any,
                    formats: [format],
                    status: 'owned',
                });
            }
        } catch (e) {
            Alert.alert('Error', 'Could not update format');
        }
    };

    // Play sound when toggling format
    const handleFormatPress = async (fmt: MovieFormat) => {
        // Show edition modal for adding format
        setPendingFormat(fmt);
        setEditionInput('');
        setShowEditionModal(true);
        playSound('click');
    };

    const handleConfirmAddFormat = async () => {
        if (!pendingFormat || !activeMovie) return;

        const isDuplicate = movieItems.some((item: any) => item.format === pendingFormat);

        // Validate: Edition required if duplicate
        if (isDuplicate && !editionInput.trim()) {
            Alert.alert('Edition Required', 'Please enter an edition name for this duplicate format.');
            return;
        }

        try {
            // Add the format with edition
            await addMutation.mutateAsync({
                tmdbItem: {
                    id: activeMovie.tmdb_id,
                    title: activeMovie.title,
                    release_date: activeMovie.release_date ?? '',
                    poster_path: activeMovie.poster_path,
                    backdrop_path: activeMovie.backdrop_path,
                    overview: (activeMovie as any).overview ?? '',
                    media_type: 'movie',
                } as any,
                formats: [pendingFormat as MovieFormat],
                status: thriftMode ? 'wishlist' : 'owned',
                edition: editionInput.trim() || null
            });

            // Play sound
            if (pendingFormat === 'VHS') {
                playSound('insert');
            } else {
                playSound('click');
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Switch active format to the one just added
            setSelectedFormat(pendingFormat);

            // Close modal and reset
            setShowEditionModal(false);
            setPendingFormat(null);
            setEditionInput('');
        } catch (e: any) {
            const msg = e?.message || String(e);
            if (msg.startsWith('WISHLIST_CONFLICT:::')) {
                const [, conflictId, formatName] = msg.split(':::');
                const title = activeMovie.title;
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

    // Alias for compatibility with JSX
    const handleFormatToggle = handleFormatPress;

    const handleFormatLongPress = async (fmt: MovieFormat) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedFormat(fmt);
    };

    const existingFormatItem = movieItems.find((i: any) => i.format === selectedFormat);

    const toggleGrail = async () => {
        // Toggle grail for ALL items of this movie? Or just the "top" one?
        // Usually grail applies to the physical copy. Let's toggle for all for now or the first one.
        // A better model might be `is_grail` on the Movie? No, `collection_items`.
        // Let's set it on all items for this movie.
        try {
            const newGrail = !isGrail;
            await Promise.all(movieItems.map((item: any) =>
                updateMutation.mutateAsync({ itemId: item.id, updates: { is_grail: newGrail } })
            ));
        } catch (e) {
            Alert.alert('Error', 'Could not update Grail status');
        }
    };
    
    const handleConfirmDelete = async () => {
        try {
            setShowDeleteModal(false);
            setEjecting(true);
            playSound('eject');
            await new Promise(resolve => setTimeout(resolve, 2000));

            await Promise.all(movieItems.map((item: any) => deleteMutation.mutateAsync(item.id)));
            if (refetch) refetch();

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
            console.error('Error deleting movie:', e);
            Alert.alert('Error', 'Could not delete movie');
        }
    };

    const deleteMovie = () => {
        setShowDeleteModal(true);
    };

    return (
        <View className="flex-1 bg-neutral-950">
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Hidden file input replaced by ImagePicker for better mobile compatibility */}

            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    paddingBottom: insets.bottom + 120,
                    paddingHorizontal: 0,
                    width: '100%'
                }}
            >
                {/* Backdrop */}
                <View className="relative h-72 w-full">
                    {customBackdropUrl || backdropUrl ? (
                        <Image source={{ uri: customBackdropUrl || backdropUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                        <NoPosterPlaceholder width="100%" height="100%" />
                    )}
                    <LinearGradient
                        colors={['transparent', '#0a0a0a']}
                        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 }}
                    />

                    {/* Close Button */}
                    <Pressable
                        onPress={() => {
                            if (fromStack) {
                                router.replace(`/stack/${fromStack}` as any);
                            } else {
                                router.back();
                            }
                        }}
                        className="absolute top-12 right-4 bg-black/50 p-2 rounded-full"
                    >
                        <Ionicons name="close" size={24} color="white" />
                    </Pressable>

                    {/* Share Button */}
                    <Pressable
                        onPress={() => setShowShareModal(true)}
                        className="absolute top-12 right-16 bg-black/50 p-2 rounded-full"
                    >
                        <Ionicons name="share-outline" size={24} color="white" />
                    </Pressable>
                </View>

                <View className="max-w-7xl mx-auto w-full px-4 md:px-8 -mt-20">
                    <View className="flex-row items-start">
                        {/* Poster */}
                        <View className="w-24 rounded-lg shadow-xl relative" style={{ elevation: 12, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 12 }}>
                            {(() => {
                                const finalPosterUrl = customArtUrl || posterUrl;
                                const isCustom = !!customArtUrl;

                                if (activeFormat === 'VHS') return <VHSCard posterUrl={finalPosterUrl} isCustom={isCustom} style={{ width: '100%' }} />;
                                if (activeFormat && ['DVD', 'BluRay', '4K'].includes(activeFormat)) return <GlossyCard posterUrl={finalPosterUrl} format={activeFormat as MovieFormat} isCustom={isCustom} style={{ width: '100%' }} />;

                                const ratio = isCustom
                                    ? (activeFormat === 'VHS' ? 2 / 3.5 : (activeFormat === 'BluRay' || activeFormat === '4K') ? 0.78 : 0.71)
                                    : 2 / 3;

                                if (!finalPosterUrl) {
                                    return <NoPosterPlaceholder width="100%" height="100%" style={{ aspectRatio: ratio, borderRadius: 8 }} />;
                                }

                                return <Image source={{ uri: finalPosterUrl }} style={{ width: '100%', aspectRatio: ratio, borderRadius: 8 }} contentFit="cover" />;
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

                        {/* Controls + Title Info */}
                        <View className="flex-1 ml-4 pt-1">
                            {/* Art Controls (Matching Attachment 2) */}
                            {movieItems.length > 0 && !isReadOnly && (
                                <View className="flex-row items-center gap-2 mb-3 flex-wrap">
                                    <View className="flex-row items-center">
                                        <Pressable
                                            onPress={() => handleUploadCustomArt('poster')}
                                            className="bg-amber-600/10 border border-amber-600/30 px-3 py-2 rounded flex-row items-center"
                                        >
                                            <Ionicons name="image-outline" size={12} color="#f59e0b" />
                                            <Text className="ml-1.5 font-mono text-[10px] font-bold text-amber-500">
                                                {customArtUrl ? 'CHANGE COVER' : 'UPLOAD COVER'}
                                            </Text>
                                        </Pressable>
                                        {customArtUrl && (
                                            <Pressable
                                                onPress={() => handleRemoveCustomArt('poster')}
                                                className="ml-1.5 bg-red-900/20 px-2 py-2 rounded border border-red-900/40 items-center justify-center"
                                            >
                                                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                            </Pressable>
                                        )}
                                    </View>

                                    <View className="flex-row items-center">
                                        <Pressable
                                            onPress={() => handleUploadCustomArt('backdrop')}
                                            className="bg-blue-600/10 border border-blue-600/30 px-3 py-2 rounded flex-row items-center"
                                        >
                                            <Ionicons name="images-outline" size={12} color="#60a5fa" />
                                            <Text className="ml-1.5 font-mono text-[10px] font-bold text-blue-400">
                                                {customBackdropUrl ? 'CHANGE BACKDROP' : 'UPLOAD BACKDROP'}
                                            </Text>
                                        </Pressable>
                                        {customBackdropUrl && (
                                            <Pressable
                                                onPress={() => handleRemoveCustomArt('backdrop')}
                                                className="ml-1.5 bg-red-900/20 px-2 py-2 rounded border border-red-900/40 items-center justify-center"
                                            >
                                                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                            </Pressable>
                                        )}
                                    </View>
                                </View>
                            )}

                            <Text className="text-white font-bold text-xl leading-6 mb-0.5">{displayMovie.title}</Text>
                            <Text className="text-neutral-500 font-mono text-xs">
                                {displayMovie.release_date?.slice(0, 4) || '????'}
                            </Text>
                        </View>
                    </View>
                    {/* Actions Bar (Full width style from attachment 2) */}
                    <View className="max-w-7xl mx-auto w-full px-4 md:px-8 flex-row mt-4 gap-2">
                        {!isReadOnly && (
                            <>
                                {thriftMode ? (
                                    <Pressable
                                        onPress={toggleGrail}
                                        className={`flex-1 flex-row items-center justify-center p-3 rounded-lg border ${isGrail ? 'bg-amber-500/10 border-amber-500' : 'bg-neutral-900 border-neutral-800'}`}
                                    >
                                        <Ionicons name={isGrail ? "trophy" : "trophy-outline"} size={16} color={isGrail ? "#f59e0b" : "#404040"} />
                                        <Text className={`ml-2 font-mono text-xs font-bold tracking-widest ${isGrail ? 'text-amber-500' : 'text-neutral-600'}`}>
                                            {isGrail ? 'GRAIL' : 'MAKE GRAIL'}
                                        </Text>
                                    </Pressable>
                                ) : (
                                    <Pressable
                                        onPress={async () => {
                                            const isOnDisplay = movieItems.some((i: any) => i.is_on_display);
                                            await Promise.all(movieItems.map((item: any) =>
                                                updateMutation.mutateAsync({ itemId: item.id, updates: { is_on_display: !isOnDisplay } })
                                            ));
                                            playSound('click');
                                        }}
                                        className={`flex-1 flex-row items-center justify-center p-3 rounded-lg border ${movieItems.some((i: any) => i.is_on_display) ? 'bg-indigo-500/10 border-indigo-500' : 'bg-neutral-900 border-neutral-800'}`}
                                    >
                                        <Ionicons name={movieItems.some((i: any) => i.is_on_display) ? "star" : "star-outline"} size={16} color={movieItems.some((i: any) => i.is_on_display) ? "#6366f1" : "#404040"} />
                                        <Text className={`ml-2 font-mono text-xs font-bold tracking-widest ${movieItems.some((i: any) => i.is_on_display) ? 'text-indigo-500' : 'text-neutral-600'}`}>
                                            {movieItems.some((i: any) => i.is_on_display) ? 'STAFF PICK' : 'MAKE STAFF PICK'}
                                        </Text>
                                    </Pressable>
                                )}

                                <Pressable
                                    onPress={deleteMovie}
                                    className="bg-red-900/10 px-4 rounded-lg border border-red-900/40 items-center justify-center"
                                >
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

                    {/* Rating and Review Section (Bulletin Board Sync) */}
                    {activeItem && (
                        <ReviewSection 
                            movieId={activeMovie.id}
                            collectionItemId={activeItem.id}
                            initialRating={activeItem.rating}
                            initialReview={activeItem.review}
                        />
                    )}

                    {/* Cast Section */}
                    {activeMovie.movie_cast && activeMovie.movie_cast.length > 0 && (
                        <View className="mt-4 mb-2 px-4 md:px-8">
                            <Text className="text-amber-500 font-bold text-xl mb-3 font-mono uppercase tracking-widest" style={{ fontFamily: 'VCR_OSD_MONO' }}>STARRING</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {activeMovie.movie_cast.map((member: any) => (
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

                    {/* Overview */}
                    <View className="mt-6">
                        <Text className="text-amber-500 font-bold text-xl mb-2 font-mono uppercase tracking-widest" style={{ fontFamily: 'VCR_OSD_MONO' }}>Overview</Text>
                        <Text className="text-neutral-400 leading-6">
                            {tmdbMovie?.overview || (displayMovie as any)?.overview || "No overview available."}
                        </Text>
                    </View>

                    {/* Rating Section */}
                    <View className="mt-6">
                        <Text className="text-white font-bold mb-2">Rating</Text>
                        <View className="flex-row gap-2">
                            {[1, 2, 3, 4, 5].map((star) => {
                                const currentRating = movieItems[0]?.rating || 0;
                                return (
                                    <Pressable
                                        key={star}
                                        disabled={isReadOnly}
                                        onPress={async () => {
                                            if (isReadOnly) return;
                                            playSound('click');
                                            // Update all formats? Or just the first one?
                                            // Ideally rating is per movie in this app model
                                            await Promise.all(movieItems.map((item: any) =>
                                                updateMutation.mutateAsync({ itemId: item.id, updates: { rating: star } })
                                            ));
                                        }}
                                    >
                                        <Ionicons
                                            name={star <= currentRating ? "star" : "star-outline"}
                                            size={28}
                                            color={star <= currentRating ? "#f59e0b" : "#525252"}
                                        />
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    {/* Format Notes Section */}
                    {
                        ownedFormats.length > 0 && (
                            <View className="mt-6">
                                <Text className="text-white font-bold mb-2">Format Notes</Text>
                                {movieItems.map((item: any) => (
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
                                            nativeID={`edition-input-${item.id}`}
                                            {...({ name: `edition-${item.id}` } as any)}
                                            className="bg-neutral-900 text-white p-3 rounded-lg border border-neutral-800 font-mono text-sm mb-2"
                                            placeholder="Edition (Theatrical, Unrated, Director's Cut, etc.)"
                                            placeholderTextColor="#525252"
                                            value={localEditions[item.id] !== undefined ? localEditions[item.id] : (item.edition || '')}
                                            onChangeText={(text) => setLocalEditions(prev => ({ ...prev, [item.id]: text }))}
                                            autoCapitalize="words"
                                            autoCorrect={false}
                                        />
                                        <TextInput
                                            nativeID={`notes-input-${item.id}`}
                                            {...({ name: `notes-${item.id}` } as any)}
                                            className="bg-neutral-900 text-white p-3 rounded-lg border border-neutral-800 font-mono text-sm min-h-[80px]"
                                            placeholder={`Add notes for your ${item.format} copy...`}
                                            placeholderTextColor="#525252"
                                            multiline
                                            value={localNotes[item.id] !== undefined ? localNotes[item.id] : (item.notes || '')}
                                            onChangeText={(text) => setLocalNotes(prev => ({ ...prev, [item.id]: text }))}
                                        />
                                        <Pressable
                                            disabled={updateMutation.isPending}
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
                                                playSound('click');
                                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                            }}
                                            className={`mt-2 self-end px-4 py-2 rounded-lg border flex-row items-center ${updateMutation.isPending ? 'bg-neutral-800 border-neutral-700' : 'bg-amber-600/10 border-amber-600/50'}`}
                                        >
                                            {updateMutation.isPending ? (
                                                <ActivityIndicator size="small" color="#f59e0b" style={{ marginRight: 8, transform: [{ scale: 0.8 }] }} />
                                            ) : null}
                                            <Text className="text-amber-500 font-mono text-xs font-bold">
                                                {updateMutation.isPending ? 'SAVING...' : `SAVE ${item.format === 'BluRay' ? 'Blu-ray' : item.format}`}
                                            </Text>
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        )
                    }

                    {/* Curated Stacks Section */}
                    {
                        ownedFormats.length > 0 && !isReadOnly && (
                            <View className="mt-8">
                                <Text className="text-white font-bold mb-3">Curated Stacks</Text>
                                <View className="flex-row flex-wrap gap-2 mb-2">
                                    {getCustomLists(collection).map(listName => {
                                        const isInStack = movieItems.some((i: any) => i.custom_lists?.includes(listName));
                                        return (
                                            <Pressable
                                                key={listName}
                                                onPress={() => handleToggleStack(listName)}
                                                className={`px-3 py-1.5 border rounded-full flex-row items-center gap-1 ${isInStack ? 'bg-amber-600/20 border-amber-500' : 'bg-neutral-900 border-neutral-700'}`}
                                            >
                                                <Ionicons name={isInStack ? 'checkmark' : 'add'} size={14} color={isInStack ? '#f59e0b' : '#a3a3a3'} />
                                                <Text className={`font-mono text-xs ${isInStack ? 'text-amber-500 font-bold' : 'text-neutral-400'}`}>
                                                    {listName}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}

                                    <Pressable
                                        onPress={() => {
                                            playSound('click');
                                            setShowNewStackInput(!showNewStackInput);
                                        }}
                                        className={`px-3 py-1.5 border rounded-full flex-row items-center gap-1 ${showNewStackInput ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-900 border-neutral-700 border-dashed'}`}
                                    >
                                        <Ionicons name={showNewStackInput ? 'close' : 'add'} size={14} color={showNewStackInput ? '#fff' : '#a3a3a3'} />
                                        <Text className={`font-mono text-xs ${showNewStackInput ? 'text-white' : 'text-neutral-500'}`}>
                                            {showNewStackInput ? 'CANCEL' : 'NEW STACK'}
                                        </Text>
                                    </Pressable>
                                </View>

                                {showNewStackInput && (
                                    <View className="flex-row items-center gap-2 mt-2">
                                        <TextInput
                                            className="flex-1 bg-neutral-900 text-white px-3 py-2 rounded-lg border border-neutral-800 font-mono text-sm"
                                            placeholder="Stack Name..."
                                            placeholderTextColor="#525252"
                                            value={newStackName}
                                            onChangeText={setNewStackName}
                                            autoFocus
                                            onSubmitEditing={handleCreateStack}
                                            returnKeyType="done"
                                        />
                                        <Pressable
                                            onPress={handleCreateStack}
                                            disabled={!newStackName.trim() || updateMutation.isPending}
                                            className={`px-4 py-2 rounded-lg border ${newStackName.trim() ? 'bg-amber-600/10 border-amber-600/50' : 'bg-neutral-900 border-neutral-800'}`}
                                        >
                                            <Text className={`font-mono text-xs font-bold ${newStackName.trim() ? 'text-amber-500' : 'text-neutral-600'}`}>
                                                SAVE
                                            </Text>
                                        </Pressable>
                                    </View>
                                )}
                            </View>
                        )
                    }

                    {/* Owned Formats Section */}
                    {
                        movieItems.length > 0 && (
                            <View className="mt-8">
                                <Text className="text-white font-bold mb-3">Owned Formats</Text>
                                <View className="gap-2">
                                    {movieItems.map((item: any) => (
                                        <View key={item.id} className="flex-row items-center justify-between bg-neutral-900 p-3 rounded-lg border border-neutral-800">
                                            <View className="flex-1 flex-row items-center flex-wrap gap-2 mr-2">
                                                <Pressable
                                                    className="flex-row items-center gap-2 active:opacity-70"
                                                    onPress={() => {
                                                        setSelectedFormat(item.format);
                                                        playSound('click');
                                                    }}
                                                >
                                                    <View style={{
                                                        borderWidth: activeFormat === item.format ? 2 : 0,
                                                        borderColor: '#fff',
                                                        borderRadius: 6,
                                                        padding: activeFormat === item.format ? 1 : 0,
                                                    }}>
                                                        <View className={`px-2 py-1 rounded shrink-0 ${FORMAT_COLORS[item.format] || 'bg-neutral-800'}`}>
                                                            <Text className="text-white font-mono text-xs font-bold">{item.format === 'BluRay' ? 'Blu-ray' : item.format}</Text>
                                                        </View>
                                                    </View>
                                                </Pressable>
                                                {item.edition && (
                                                    <Text className="text-neutral-400 font-mono text-sm flex-1" numberOfLines={2}>({item.edition})</Text>
                                                )}
                                            </View>
                                            {!isReadOnly && (
                                                <Pressable
                                                    onPress={async () => {
                                                        await deleteMutation.mutateAsync(item.id);
                                                        playSound('click');
                                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                                        
                                                        // Auto-pop if that was the last format we owned!
                                                        if (movieItems.length <= 1) {
                                                            if (fromStack) {
                                                                router.replace(`/stack/${fromStack}` as any);
                                                            } else if (router.canGoBack()) {
                                                                router.back();
                                                            } else {
                                                                router.replace('/(tabs)/home' as any);
                                                            }
                                                        }
                                                    }}
                                                    className="bg-red-900/20 px-3 py-1 rounded border border-red-900/50"
                                                >
                                                    <Text className="text-red-400 font-mono text-xs">Remove</Text>
                                                </Pressable>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )
                    }


                    {/* Add Format Section */}
                    {!isReadOnly && (
                        <View className="mt-8">
                            <Text className="text-white font-bold mb-3">Add Format</Text>
                        <View className="flex-row flex-wrap gap-2">
                            {FORMATS.map(fmt => {
                                const isOwned = ownedFormats.includes(fmt);
                                const baseColor = FORMAT_COLORS[fmt] || 'bg-neutral-800';

                                return (
                                    <Pressable
                                        key={fmt}
                                        onPress={() => handleFormatPress(fmt)}
                                        className={`px-4 py-2 border rounded-full ${baseColor} border-neutral-700`}
                                    >
                                        <Text className="text-white font-mono font-bold">
                                            {fmt === 'BluRay' ? 'Blu-ray' : fmt}
                                        </Text>
                                </Pressable>
                                );
                            })}
                        </View>
                    </View>
                )}

                {commentActiveItem?.id && (
                    <View className="px-4 md:px-8 mb-12">
                        <CommentSection collectionItemId={commentActiveItem.id} />
                    </View>
                )}
                </View>
            </ScrollView >

            <Modal
                visible={showShareModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowShareModal(false)}
            >
                <View className="flex-1 bg-black/90 items-center justify-center p-4">
                    <Text className="text-white font-mono text-lg mb-8">SHARE YOUR STACK</Text>

                    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
                        <ShareableCard media={displayMovie} items={movieItems} />
                    </ViewShot>

                    <View className="flex-row gap-4 mt-8">
                        <Pressable
                            onPress={() => setShowShareModal(false)}
                            className="bg-neutral-800 px-6 py-3 rounded-full border border-neutral-700"
                        >
                            <Text className="text-white font-mono">Close</Text>
                        </Pressable>
                        <Pressable
                            onPress={async () => {
                                if (viewShotRef.current?.capture) {
                                    try {
                                        const uri = await viewShotRef.current.capture();
                                        await Sharing.shareAsync(uri);
                                    } catch (e) {
                                        Alert.alert('Error', 'Could not share image');
                                    }
                                }
                            }}
                            className="bg-amber-600 px-6 py-3 rounded-full"
                        >
                            <Text className="text-white font-mono font-bold">Share Image</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* EJECTING OVERLAY */}
            {
                ejecting && (
                    <View className="absolute inset-0 z-[100] bg-[#0000AA] items-center justify-center">
                        {/* Scanlines Effect */}
                        <View className="absolute inset-0 opacity-10">
                            {Array.from({ length: 100 }).map((_: any, i: number) => (
                                <View key={i} className="h-[2px] w-full bg-black mb-[2px]" />
                            ))}
                        </View>

                        {/* Text */}
                        <Text className="text-white font-mono text-4xl font-bold tracking-[8px] italic">
                            {'EJECTING >>'}
                        </Text>
                        <Text className="text-white font-mono text-xl mt-4 opacity-80 tracking-[10px]">
                            PLEASE WAIT...
                        </Text>
                    </View>
                )
            }

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
                        <Text className="text-white font-bold text-center text-xl mb-2">Delete Movie</Text>
                        <Text className="text-neutral-400 font-mono text-center text-sm mb-6">
                            Are you sure you want to remove this movie and all formats from your collection?
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

            {/* Edition Input Modal */}
            <Modal
                visible={showEditionModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowEditionModal(false)}
            >
                <View className="flex-1 bg-black/80 items-center justify-center p-4">
                    <View className="bg-neutral-900 rounded-lg p-6 w-full max-w-md border border-neutral-800">
                        <Text className="text-white font-bold text-lg mb-2">
                            Add {pendingFormat}
                        </Text>
                        <Text className="text-neutral-400 font-mono text-xs mb-4">
                            {movieItems.some((i: any) => i.format === pendingFormat)
                                ? '⚠️ Edition required (duplicate format)'
                                : 'Edition optional (e.g., Theatrical, Unrated, Box Set)'}
                        </Text>

                        <TextInput
                            nativeID="modal-edition-input"
                            {...({ name: 'modal-edition' } as any)}
                            className="bg-neutral-800 text-white p-3 rounded-lg border border-neutral-700 font-mono text-sm mb-4"
                            placeholder="Edition (e.g., Theatrical, Unrated)"
                            placeholderTextColor="#525252"
                            value={editionInput}
                            onChangeText={setEditionInput}
                            autoCapitalize="words"
                            autoCorrect={false}
                            autoFocus
                        />

                        <View className="flex-row gap-2">
                            <Pressable
                                onPress={() => {
                                    setShowEditionModal(false);
                                    setPendingFormat(null);
                                    setEditionInput('');
                                }}
                                className="flex-1 bg-neutral-800 py-3 rounded-lg items-center"
                            >
                                <Text className="text-neutral-400 font-mono text-sm font-bold">CANCEL</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleConfirmAddFormat}
                                className="flex-1 bg-amber-600 py-3 rounded-lg items-center"
                            >
                                <Text className="text-white font-mono text-sm font-bold">ADD</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Image Crop Modal */}
            {
                pendingImageUri && (
                    <ImageCropModal
                        visible={cropModalVisible}
                        imageUri={pendingImageUri}
                        onClose={() => {
                            setCropModalVisible(false);
                            if (pendingImageUri && pendingImageUri.startsWith('blob:')) {
                                URL.revokeObjectURL(pendingImageUri);
                            }
                            setPendingImageUri(null);
                        }}
                        onSave={handleSaveCustomArt}
                        targetRatio={(() => {
                            if (customArtType === 'backdrop') return 16 / 9;
                            const ratio = activeFormat === 'VHS' ? 2 / 3.5 : (activeFormat === 'BluRay' || activeFormat === '4K') ? 0.78 : 0.71;
                            return ratio;
                        })()}
                    />
                )
            }
        </View >
    );
}
