import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

import { useSound } from '@/context/SoundContext';
import { useAddToCollection, useDeleteCollectionItem, useUpdateCollectionItem } from '@/hooks/useCollection';
import type { CollectionItemWithMedia, MovieFormat } from '@/types/database';

const FORMATS: MovieFormat[] = ['VHS', 'DVD', 'BluRay', '4K', 'Digital'];

type QuickActionModalProps = {
  visible: boolean;
  item: CollectionItemWithMedia | null;
  collection: CollectionItemWithMedia[];
  userId: string;
  onClose: () => void;
};

export function QuickActionModal({
  visible,
  item,
  collection,
  userId,
  onClose,
}: QuickActionModalProps) {
  const router = useRouter();
  const { playSound } = useSound();
  const confettiRef = useRef<ConfettiCannon>(null);

  const [viewState, setViewState] = useState<'main' | 'add-format' | 'remove-format'>('main');
  const [selectedFormat, setSelectedFormat] = useState<MovieFormat | null>(null);
  const [edition, setEdition] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const updateMutation = useUpdateCollectionItem(userId);
  const addMutation = useAddToCollection(userId);
  const deleteMutation = useDeleteCollectionItem(userId);

  if (!item) return null;

  const media = item.movies || item.shows;
  const isWishlist = item.status === 'wishlist';

  // For TV Shows vs Movies
  const isMovie = item.media_type === 'movie';
  const tmdbId = media?.tmdb_id;

  // Find all owned formats for this specific movie/show
  const relatedItems = collection.filter(i => {
    if (isMovie) return i.movie_id === item.movie_id;
    return i.show_id === item.show_id && i.season_number === item.season_number;
  });
  const ownedFormats = relatedItems.map(i => i.format);

  const handleClose = () => {
    setViewState('main');
    setSelectedFormat(null);
    setEdition('');
    onClose();
  };

  const handleAcquire = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      confettiRef.current?.start();
      await updateMutation.mutateAsync({
        itemId: item.id,
        updates: { status: 'owned' }
      });
      setTimeout(() => {
        setIsProcessing(false);
        handleClose();
      }, 1500); // give time for confetti
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      Alert.alert('Error', 'Failed to acquire item');
    }
  };

  const navigateToDetail = () => {
    handleClose();
    if (isMovie) {
      router.push({ pathname: "/movie/[id]", params: { id: item.movie_id || item.movies?.id } } as any);
    } else {
      router.push({ pathname: "/show/[id]", params: { id: item.show_id || item.shows?.id, season: item.season_number || 1 } } as any);
    }
  };

  const handleRate = async (star: number) => {
    playSound('click');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Promise.all(relatedItems.map(i => 
        updateMutation.mutateAsync({ itemId: i.id, updates: { rating: star } })
      ));
    } catch (e) {
      Alert.alert('Error', 'Failed to save rating');
    }
  };

  const handleConfirmAddFormat = async () => {
    if (!selectedFormat) return;
    setIsProcessing(true);
    try {
      await addMutation.mutateAsync({
        tmdbItem: media as any, // Will need enough metadata
        formats: [selectedFormat],
        status: 'owned',
        edition: edition.trim() || null,
        seasonNumber: item.season_number
      });
      playSound(selectedFormat === 'VHS' ? 'insert' : 'click');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsProcessing(false);
      handleClose();
    } catch (e) {
      setIsProcessing(false);
      Alert.alert('Error', 'Failed to add format');
    }
  };

  const handleConfirmRemoveFormat = async (itemIdToRemove: string) => {
    setIsProcessing(true);
    try {
      playSound('eject');
      await deleteMutation.mutateAsync(itemIdToRemove);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsProcessing(false);
      if (relatedItems.length <= 1) {
        // We deleted the last one, close menu
        handleClose();
      }
    } catch (e) {
      setIsProcessing(false);
      Alert.alert('Error', 'Failed to remove format');
    }
  };

  const renderMainActions = () => (
    <>
      {isWishlist && (
        <Pressable
          onPress={handleAcquire}
          className="bg-amber-500 py-3 rounded-xl items-center mb-3 flex-row justify-center"
        >
          <Ionicons name="checkmark-circle" size={20} color="black" />
          <Text className="text-black font-mono font-bold text-lg ml-2">ACQUIRED</Text>
        </Pressable>
      )}

      {!isWishlist && (
        <View className="bg-neutral-800 rounded-xl p-4 mb-3 items-center">
          <Text className="text-neutral-400 font-mono text-xs mb-2">QUICK RATING</Text>
          <View className="flex-row gap-2">
            {[1, 2, 3, 4, 5].map((star) => {
              const currentRating = item.rating || 0;
              return (
                <Pressable key={star} onPress={() => handleRate(star)} className="p-1">
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
      )}

      <Pressable
        onPress={navigateToDetail}
        className="bg-neutral-800 py-3 px-4 rounded-xl mb-3 flex-row items-center"
      >
        <Ionicons name="information-circle-outline" size={20} color="#a3a3a3" />
        <Text className="text-white font-mono font-bold ml-3 flex-1">VIEW INFO</Text>
        <Ionicons name="chevron-forward" size={16} color="#525252" />
      </Pressable>

      <Pressable
        onPress={() => setViewState('add-format')}
        className="bg-neutral-800 py-3 px-4 rounded-xl mb-3 flex-row items-center"
      >
        <Ionicons name="add-circle-outline" size={20} color="#a3a3a3" />
        <Text className="text-white font-mono font-bold ml-3 flex-1">ADD FORMAT</Text>
        <Ionicons name="chevron-forward" size={16} color="#525252" />
      </Pressable>

      <Pressable
        onPress={() => setViewState('remove-format')}
        className="bg-neutral-800 py-3 px-4 rounded-xl flex-row items-center"
      >
        <Ionicons name="remove-circle-outline" size={20} color="#ef4444" />
        <Text className="text-red-400 font-mono font-bold ml-3 flex-1">REMOVE FORMAT</Text>
        <Ionicons name="chevron-forward" size={16} color="#525252" />
      </Pressable>
    </>
  );

  const renderAddFormat = () => (
    <View>
      <View className="flex-row items-center mb-4">
        <Pressable onPress={() => { setViewState('main'); setSelectedFormat(null); setEdition(''); }} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#a3a3a3" />
        </Pressable>
        <Text className="text-white font-bold text-lg">Add Format</Text>
      </View>
      
      {!selectedFormat ? (
        <View className="flex-row flex-wrap gap-2">
          {FORMATS.map(fmt => (
            <Pressable
              key={fmt}
              onPress={() => setSelectedFormat(fmt)}
              className="bg-neutral-800 border border-neutral-700 w-[48%] py-3 rounded-lg items-center"
            >
              <Text className="text-white font-mono font-bold">{fmt}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View>
          <Text className="text-neutral-400 font-mono text-xs mb-2">FORMAT</Text>
          <View className="bg-neutral-800 py-3 px-4 rounded-lg mb-4 flex-row justify-between items-center">
            <Text className="text-white font-mono font-bold">{selectedFormat}</Text>
            <Pressable onPress={() => setSelectedFormat(null)}>
              <Text className="text-amber-500 font-mono text-xs">CHANGE</Text>
            </Pressable>
          </View>

          <Text className="text-neutral-400 font-mono text-xs mb-2">EDITION (OPTIONAL)</Text>
          <TextInput
            className="bg-neutral-900 border border-neutral-700 text-white p-3 rounded-lg font-mono text-sm mb-6"
            placeholder="e.g. Director's Cut"
            placeholderTextColor="#525252"
            value={edition}
            onChangeText={setEdition}
            autoCapitalize="words"
          />

          <Pressable
            onPress={handleConfirmAddFormat}
            disabled={isProcessing}
            className={`py-3 rounded-xl items-center flex-row justify-center ${isProcessing ? 'bg-neutral-800' : 'bg-amber-500'}`}
          >
            {isProcessing ? <ActivityIndicator color="#f59e0b" /> : (
              <Text className="text-black font-mono font-bold text-lg">CONFIRM ADD</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );

  const renderRemoveFormat = () => (
    <View>
      <View className="flex-row items-center mb-4">
        <Pressable onPress={() => setViewState('main')} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#a3a3a3" />
        </Pressable>
        <Text className="text-white font-bold text-lg">Remove Format</Text>
      </View>
      
      {relatedItems.length === 0 ? (
        <Text className="text-neutral-500 font-mono text-center my-4">No formats owned.</Text>
      ) : (
        <ScrollView className="max-h-64">
          {relatedItems.map(i => (
            <View key={i.id} className="bg-neutral-800 border border-neutral-700 p-3 rounded-lg mb-2 flex-row justify-between items-center">
              <View>
                <Text className="text-white font-mono font-bold">{i.format}</Text>
                {i.edition && <Text className="text-neutral-500 font-mono text-xs mt-0.5">{i.edition}</Text>}
              </View>
              <Pressable
                onPress={() => handleConfirmRemoveFormat(i.id)}
                disabled={isProcessing}
                className="bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/40"
              >
                <Text className="text-red-400 font-mono text-xs font-bold">REMOVE</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        onPress={handleClose}
        className="flex-1 bg-black/80 justify-end"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-neutral-900 rounded-t-3xl p-6 w-full max-w-lg mx-auto border-t border-neutral-800"
        >
          <View className="w-12 h-1 bg-neutral-700 rounded-full mx-auto mb-6" />
          
          <ConfettiCannon
            ref={confettiRef}
            count={80}
            origin={{ x: -10, y: 0 }}
            fadeOut
            autoStart={false}
          />

          <Text className="text-white text-xl font-bold mb-1" numberOfLines={1}>
            {(media as any)?.title || (media as any)?.name}
          </Text>
          <Text className="text-neutral-500 font-mono text-xs mb-6">
            {isWishlist ? 'THRIFT MODE' : 'THE STACKS'}
          </Text>

          {viewState === 'main' && renderMainActions()}
          {viewState === 'add-format' && renderAddFormat()}
          {viewState === 'remove-format' && renderRemoveFormat()}

        </Pressable>
      </Pressable>
    </Modal>
  );
}
