import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { GlossyCard } from '@/components/GlossyCard';
import { VHSCard } from '@/components/VHSCard';

import { ShareableCard } from '@/components/ShareableCard';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { useAddToCollection, useCollection, useDeleteCollectionItem, useUpdateCollectionItem } from '@/hooks/useCollection';
import { getBackdropUrl, getPosterUrl } from '@/lib/dummy-data';
import { getMovieById } from '@/lib/tmdb';
import type { MovieFormat } from '@/types/database';
import { useQuery } from '@tanstack/react-query';
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
    const { id } = useLocalSearchParams(); // This is the movie_id (internal DB id)
    const router = useRouter();
    const { userId } = useAuth();
    const { thriftMode } = useThriftMode();
    const { playSound } = useSound();
    const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
    const [ejecting, setEjecting] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
    const [localEditions, setLocalEditions] = useState<Record<string, string>>({});
    const viewShotRef = useRef<ViewShot>(null);

    // Custom art state
    const [customArtUri, setCustomArtUri] = useState<string | null>(null);
    const [cropModalVisible, setCropModalVisible] = useState(false);
    const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
    const [showEditionModal, setShowEditionModal] = useState(false);
    const [pendingFormat, setPendingFormat] = useState<string | null>(null);
    const [editionInput, setEditionInput] = useState('');

    // We use the main collection query and filter. 
    // In a generic app we might want a specific query for just this movie, 
    // but since we load the whole collection on home, this is cached and fast.
    const { data: collection, refetch } = useCollection(userId);
    const updateMutation = useUpdateCollectionItem(userId);
    const deleteMutation = useDeleteCollectionItem(userId);
    const addMutation = useAddToCollection(userId);

    const movieId = typeof id === 'string' ? parseInt(id, 10) : undefined;

    const movieItems = collection?.filter(item => item.movie_id === movieId) ?? [];
    const movie = movieItems[0]?.movies;

    console.log('Movie items count:', movieItems.length, 'Formats:', movieItems.map(i => i.format));

    const [persistedMovie, setPersistedMovie] = useState<any>(null);

    if (movie && !persistedMovie) {
        setPersistedMovie(movie);
    }

    const activeMovie = movie || persistedMovie;

    const { data: tmdbMovie } = useQuery({
        queryKey: ['tmdb', activeMovie?.tmdb_id],
        queryFn: async () => {
            if (!activeMovie?.tmdb_id) return null;
            return getMovieById(activeMovie.tmdb_id);
        },
        enabled: !!activeMovie?.tmdb_id,
    });

    // Load custom art from IndexedDB
    useQuery({
        queryKey: ['custom-art', movieItems[0]?.id],
        queryFn: async () => {
            if (!movieItems[0]?.id) return null;
            const artUri = await getCustomArt(movieItems[0].id);
            setCustomArtUri(artUri);
            return artUri;
        },
        enabled: !!movieItems[0]?.id && Platform.OS === 'web',
    });

    const handleUploadCustomArt = async () => {
        if (Platform.OS !== 'web') {
            // For native: use expo-image-picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [2, 3],
                quality: 0.9,
            });

            if (!result.canceled && result.assets[0]) {
                setPendingImageUri(result.assets[0].uri);
                setCropModalVisible(true);
            }
        } else {
            // For web: use input file
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e: any) => {
                const file = e.target?.files?.[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const dataUrl = event.target?.result as string;
                        setPendingImageUri(dataUrl);
                        setCropModalVisible(true);
                    };
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        }
    };

    const handleSaveCustomArt = async (croppedDataUrl: string) => {
        if (!movieItems[0]?.id) return;

        try {
            // Convert data URL to Blob
            const response = await fetch(croppedDataUrl);
            const blob = await response.blob();

            // Compress
            const compressedBlob = await compressImage(blob, 400, 0.85);

            // Save to IndexedDB
            await saveCustomArt(movieItems[0].id, compressedBlob);

            // Update UI
            setCustomArtUri(croppedDataUrl);
            setCropModalVisible(false);
            setPendingImageUri(null);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            console.error('Failed to save custom art:', e);
            Alert.alert('Error', 'Failed to save custom cover art');
        }
    };

    const handleRemoveCustomArt = async () => {
        if (!movieItems[0]?.id) return;

        const confirmRemove = () => {
            deleteCustomArt(movieItems[0].id);
            setCustomArtUri(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Remove custom cover art? This will restore the default TMDB poster.')) {
                confirmRemove();
            }
        } else {
            Alert.alert(
                'Remove Custom Art',
                'This will restore the default TMDB poster.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: confirmRemove },
                ]
            );
        }
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

    const ownedFormats = movieItems.map(i => i.format);
    const isGrail = movieItems.some(i => i.is_grail);
    const isWishlist = movieItems.every(i => i.status === 'wishlist');

    // Logic to toggle format
    const toggleFormat = async (format: MovieFormat) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const existingItems = movieItems.filter(i => i.format === format);

        try {
            if (existingItems.length > 0) {
                // Remove format (handle duplicates)
                await Promise.all(existingItems.map(i => deleteMutation.mutateAsync(i.id)));
            } else {
                // Add format
                await addMutation.mutateAsync({
                    tmdbMovie: {
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

        const isDuplicate = movieItems.some(item => item.format === pendingFormat);

        // Validate: Edition required if duplicate
        if (isDuplicate && !editionInput.trim()) {
            Alert.alert('Edition Required', 'Please enter an edition name for this duplicate format.');
            return;
        }

        try {
            // Add the format with edition
            await addMutation.mutateAsync({
                tmdbMovie: {
                    id: activeMovie.tmdb_id,
                    title: activeMovie.title,
                    release_date: activeMovie.release_date ?? '',
                    poster_path: activeMovie.poster_path,
                    backdrop_path: activeMovie.backdrop_path,
                    overview: (activeMovie as any).overview ?? '',
                } as any,
                formats: [pendingFormat as MovieFormat],
                status: 'owned',
                edition: editionInput.trim() || null
            });

            // Play sound
            if (pendingFormat === 'VHS') {
                playSound('insert');
            } else {
                playSound('click');
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Close modal and reset
            setShowEditionModal(false);
            setPendingFormat(null);
            setEditionInput('');
        } catch (e) {
            Alert.alert('Error', 'Failed to add format');
        }
    };

    // Alias for compatibility with JSX
    const handleFormatToggle = handleFormatPress;

    const handleFormatLongPress = async (fmt: MovieFormat) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedFormat(fmt);
    };

    const existingFormatItem = movieItems.find(i => i.format === selectedFormat);

    const toggleGrail = async () => {
        // Toggle grail for ALL items of this movie? Or just the "top" one?
        // Usually grail applies to the physical copy. Let's toggle for all for now or the first one.
        // A better model might be `is_grail` on the Movie? No, `collection_items`.
        // Let's set it on all items for this movie.
        try {
            const newGrail = !isGrail;
            await Promise.all(movieItems.map(item =>
                updateMutation.mutateAsync({ itemId: item.id, updates: { is_grail: newGrail } })
            ));
        } catch (e) {
            Alert.alert('Error', 'Could not update Grail status');
        }
    };

    const deleteMovie = async () => {
        const performDelete = async () => {
            try {
                // EJECT SEQUENCE
                setEjecting(true);

                // Use global sound manager (web safe)
                playSound('eject');

                // Visual delay for sound/animation
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2s eject time

                await Promise.all(movieItems.map(item => deleteMutation.mutateAsync(item.id)));
                if (refetch) refetch();

                // Navigate back after eject
                router.back();
            } catch (e) {
                setEjecting(false);
                console.error('Error deleting movie:', e);
                if (Platform.OS === 'web') {
                    window.alert('Could not delete movie');
                } else {
                    Alert.alert('Error', 'Could not delete movie');
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Are you sure you want to remove this movie and all formats from your collection?')) {
                performDelete();
            }
        } else {
            Alert.alert('Delete Movie', 'Are you sure you want to remove this movie and all formats from your collection?', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: performDelete,
                },
            ]);
        }
    };

    return (
        <View className="flex-1 bg-neutral-950">
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Backdrop */}
                <View className="relative h-72 w-full">
                    <Image source={{ uri: backdropUrl ?? undefined }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    <LinearGradient
                        colors={['transparent', '#0a0a0a']}
                        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 }}
                    />

                    {/* Close Button */}
                    <Pressable
                        onPress={() => router.back()}
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

                <View className="px-5 -mt-24">
                    <View className="flex-row items-end">
                        {/* Poster */}
                        <View className="w-32 h-48 rounded-lg shadow-xl relative" style={{ elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10 }}>
                            {(() => {
                                // Use custom art if available, otherwise show format-specific preview
                                if (customArtUri && Platform.OS === 'web') {
                                    return <Image source={{ uri: customArtUri }} style={{ width: '100%', height: '100%', borderRadius: 8 }} contentFit="cover" />;
                                }

                                // Determine active format for preview
                                // Prefer manually selected preview, otherwise fallback to highest quality owned, otherwise none (default image)
                                const availableFormats = ownedFormats.length > 0 ? ownedFormats : null;
                                let activeFormat = selectedFormat;

                                if (!activeFormat && availableFormats) {
                                    // Sort by basic priority for default View
                                    // This is a rough sort.
                                    const priority = ['4K', 'BluRay', 'DVD', 'VHS', 'Digital'];
                                    activeFormat = availableFormats.sort((a, b) => priority.indexOf(a) - priority.indexOf(b))[0];
                                }

                                if (activeFormat === 'VHS') return <VHSCard posterUrl={posterUrl} style={{ width: '100%', height: '100%' }} />;
                                if (activeFormat && ['DVD', 'BluRay', '4K'].includes(activeFormat)) return <GlossyCard posterUrl={posterUrl} format={activeFormat as MovieFormat} style={{ width: '100%', height: '100%' }} />;

                                return <Image source={{ uri: posterUrl ?? undefined }} style={{ width: '100%', height: '100%', borderRadius: 8 }} contentFit="cover" />;
                            })()}
                        </View>

                        {/* Title Info */}
                        <View className="flex-1 ml-4 mb-2">
                            <Text className="text-white font-bold text-2xl leading-7 mb-1">{displayMovie.title}</Text>
                            <Text className="text-neutral-400 font-mono text-sm">
                                {displayMovie.release_date?.slice(0, 4) || '????'}
                            </Text>
                        </View>
                    </View>

                    {/* Actions Bar */}
                    <View className="flex-row mt-6 gap-3">
                        {thriftMode ? (
                            <Pressable
                                onPress={toggleGrail}
                                className={`flex-1 flex-row items-center justify-center p-3 rounded-lg border ${isGrail ? 'bg-amber-500/10 border-amber-500' : 'bg-neutral-900 border-neutral-800'}`}
                            >
                                <Ionicons name={isGrail ? "trophy" : "trophy-outline"} size={20} color={isGrail ? "#f59e0b" : "#737373"} />
                                <Text className={`ml-2 font-mono font-bold ${isGrail ? 'text-amber-500' : 'text-neutral-500'}`}>
                                    {isGrail ? 'GRAIL' : 'MAKE GRAIL'}
                                </Text>
                            </Pressable>
                        ) : (
                            <Pressable
                                onPress={async () => {
                                    const isOnDisplay = movieItems.some(i => i.is_on_display);
                                    await Promise.all(movieItems.map(item =>
                                        updateMutation.mutateAsync({ itemId: item.id, updates: { is_on_display: !isOnDisplay } })
                                    ));
                                    playSound('click');
                                }}
                                className={`flex-1 flex-row items-center justify-center p-3 rounded-lg border ${movieItems.some(i => i.is_on_display) ? 'bg-indigo-500/10 border-indigo-500' : 'bg-neutral-900 border-neutral-800'}`}
                            >
                                <Ionicons name={movieItems.some(i => i.is_on_display) ? "star" : "star-outline"} size={20} color={movieItems.some(i => i.is_on_display) ? "#6366f1" : "#737373"} />
                                <Text className={`ml-2 font-mono font-bold ${movieItems.some(i => i.is_on_display) ? 'text-indigo-500' : 'text-neutral-500'}`}>
                                    {movieItems.some(i => i.is_on_display) ? 'STAFF PICK' : 'MAKE STAFF PICK'}
                                </Text>
                            </Pressable>
                        )}

                        <Pressable
                            onPress={deleteMovie}
                            className="flex-row items-center justify-center p-3 rounded-lg bg-red-900/20 border border-red-900/50"
                        >
                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </Pressable>
                    </View>

                    {/* Custom Cover Art Section (Web Only) */}
                    {Platform.OS === 'web' && movieItems.length > 0 && (
                        <View className="mt-4 flex-row gap-2">
                            <Pressable
                                onPress={handleUploadCustomArt}
                                className="flex-1 flex-row items-center justify-center p-3 rounded-lg bg-amber-600/10 border border-amber-600/50"
                            >
                                <Ionicons name="image-outline" size={18} color="#f59e0b" />
                                <Text className="ml-2 font-mono text-xs font-bold text-amber-500">
                                    {customArtUri ? 'CHANGE COVER' : 'UPLOAD COVER'}
                                </Text>
                            </Pressable>
                            {customArtUri && (
                                <Pressable
                                    onPress={handleRemoveCustomArt}
                                    className="flex-row items-center justify-center p-3 rounded-lg bg-neutral-900 border border-neutral-800"
                                >
                                    <Ionicons name="close-outline" size={18} color="#737373" />
                                </Pressable>
                            )}
                        </View>
                    )}

                    {/* Overview */}
                    <View className="mt-6">
                        <Text className="text-white font-bold mb-2">Overview</Text>
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
                                        onPress={async () => {
                                            playSound('click');
                                            // Update all formats? Or just the first one?
                                            // Ideally rating is per movie in this app model
                                            await Promise.all(movieItems.map(item =>
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

                    {/* Format Preview / Form */}
                    {selectedFormat && (
                        <View className="mt-6 bg-neutral-900/50 p-4 rounded-lg border border-neutral-800">
                            <Text className="text-amber-500 font-mono font-bold mb-4 flex-row items-center">
                                {existingFormatItem ? 'EDIT' : 'ADD'} {selectedFormat}
                            </Text>
                        </View>
                    )}

                    {/* Format Notes Section */}
                    {ownedFormats.length > 0 && (
                        <View className="mt-6">
                            <Text className="text-white font-bold mb-2">Format Notes</Text>
                            {movieItems.map(item => (
                                <View key={item.id} className="mb-4">
                                    <View className="flex-row items-center mb-2">
                                        <View className={`px-2 py-1 rounded ${FORMAT_COLORS[item.format] || 'bg-neutral-800'}`}>
                                            <Text className="text-white font-mono text-xs font-bold">{item.format}</Text>
                                        </View>
                                        {item.edition && (
                                            <Text className="text-neutral-500 font-mono text-xs ml-2">({item.edition})</Text>
                                        )}
                                    </View>
                                    <TextInput
                                        className="bg-neutral-900 text-white p-3 rounded-lg border border-neutral-800 font-mono text-sm mb-2"
                                        placeholder="Edition (Theatrical, Unrated, Director's Cut, etc.)"
                                        placeholderTextColor="#525252"
                                        value={localEditions[item.id] !== undefined ? localEditions[item.id] : (item.edition || '')}
                                        onChangeText={(text) => setLocalEditions(prev => ({ ...prev, [item.id]: text }))}
                                        autoCapitalize="words"
                                        autoCorrect={false}
                                    />
                                    <TextInput
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
                                            await updateMutation.mutateAsync({
                                                itemId: item.id,
                                                updates: {
                                                    notes: noteToSave,
                                                    edition: editionToSave || null
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
                                            {updateMutation.isPending ? 'SAVING...' : `SAVE ${item.format}`}
                                        </Text>
                                    </Pressable>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Owned Formats Section */}
                    {movieItems.length > 0 && (
                        <View className="mt-8">
                            <Text className="text-white font-bold mb-3">Owned Formats</Text>
                            <View className="gap-2">
                                {movieItems.map(item => (
                                    <View key={item.id} className="flex-row items-center justify-between bg-neutral-900 p-3 rounded-lg border border-neutral-800">
                                        <Pressable
                                            className="flex-row items-center gap-2"
                                            onPress={() => {
                                                setSelectedFormat(item.format);
                                                playSound('click');
                                            }}
                                        >
                                            <View className={`px-2 py-1 rounded ${FORMAT_COLORS[item.format] || 'bg-neutral-800'}`}>
                                                <Text className="text-white font-mono text-xs font-bold">{item.format}</Text>
                                            </View>
                                            {item.edition && (
                                                <Text className="text-neutral-400 font-mono text-sm">({item.edition})</Text>
                                            )}
                                        </Pressable>
                                        <Pressable
                                            onPress={async () => {
                                                await deleteMutation.mutateAsync(item.id);
                                                playSound('click');
                                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                            }}
                                            className="bg-red-900/20 px-3 py-1 rounded border border-red-900/50"
                                        >
                                            <Text className="text-red-400 font-mono text-xs">Remove</Text>
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Add Format Section */}
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
                                            {fmt}
                                        </Text>
                                    </Pressable>
                                )
                            })}
                        </View>
                    </View>
                </View>
            </ScrollView>

            <Modal
                visible={showShareModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowShareModal(false)}
            >
                <View className="flex-1 bg-black/90 items-center justify-center p-4">
                    <Text className="text-white font-mono text-lg mb-8">SHARE YOUR STACK</Text>

                    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
                        <ShareableCard movie={displayMovie} items={movieItems} />
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
            {ejecting && (
                <View className="absolute inset-0 z-[100] bg-[#0000AA] items-center justify-center">
                    {/* Scanlines Effect */}
                    <View className="absolute inset-0 opacity-10">
                        {Array.from({ length: 100 }).map((_, i) => (
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
            )}

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
                            {movieItems.some(i => i.format === pendingFormat)
                                ? '⚠️ Edition required (duplicate format)'
                                : 'Edition optional (e.g., Theatrical, Unrated, Box Set)'}
                        </Text>

                        <TextInput
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
            {pendingImageUri && (
                <ImageCropModal
                    visible={cropModalVisible}
                    imageUri={pendingImageUri}
                    onClose={() => {
                        setCropModalVisible(false);
                        setPendingImageUri(null);
                    }}
                    onSave={handleSaveCustomArt}
                />
            )}
        </View >
    );
}
