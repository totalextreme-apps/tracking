import { GlossyCard } from '@/components/GlossyCard';
import { VHSCard } from '@/components/VHSCard';
import { useSound } from '@/context/SoundContext';
import { useUpdateCollectionItem } from '@/hooks/useCollection';
import { getItemDisplayTitle, getItemMultipack, isSpecialSeason, withItemMetadata } from '@/lib/collection-utils';
import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMedia } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

type MultipackModalProps = {
  visible: boolean;
  packName: string | null;
  items: CollectionItemWithMedia[];
  userId?: string;
  isReadOnly?: boolean;
  onClose: () => void;
  onSelectItem: (item: CollectionItemWithMedia) => void;
};

const FORMAT_COLORS: Record<string, string> = {
  '4K': 'bg-yellow-500',
  BluRay: 'bg-blue-500',
  DVD: 'bg-purple-500',
  VHS: 'bg-red-500',
  Digital: 'bg-green-500',
};

export function MultipackModal({
  visible,
  packName,
  items,
  userId,
  isReadOnly = false,
  onClose,
  onSelectItem,
}: MultipackModalProps) {
  const { playSound } = useSound();
  const updateMutation = useUpdateCollectionItem(userId);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(packName || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNewName(packName || '');
    setIsRenaming(false);
  }, [packName, visible]);

  if (!packName) return null;

  const packItems = items.filter(
    (i) => getItemMultipack(i)?.toLowerCase() === packName.toLowerCase()
  );

  const handleRenamePack = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === packName || isSaving) {
      setIsRenaming(false);
      return;
    }
    setIsSaving(true);
    try {
      await Promise.all(
        packItems.map((item) =>
          updateMutation.mutateAsync({
            itemId: item.id,
            updates: {
              custom_lists: withItemMetadata(item.custom_lists, { multipack: trimmed }),
            },
          })
        )
      );
      playSound('click');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsRenaming(false);
      onClose();
    } catch (e) {
      console.error('Failed to rename multi-pack:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFromPack = async (item: CollectionItemWithMedia) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        itemId: item.id,
        updates: {
          custom_lists: withItemMetadata(item.custom_lists, { multipack: null }),
        },
      });
      playSound('click');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (packItems.length <= 1) {
        onClose();
      }
    } catch (e) {
      console.error('Failed to remove item from multi-pack:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/85 justify-center items-center p-4"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-neutral-900 border border-amber-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <View className="p-4 bg-neutral-950 border-b border-neutral-800">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded">
                <FontAwesome name="archive" size={10} color="#f59e0b" />
                <Text className="text-amber-500 font-mono text-[9px] font-bold uppercase tracking-widest">
                  COMPILATION / MULTI-PACK • {packItems.length} {packItems.length === 1 ? 'TITLE' : 'TITLES'}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="p-1.5 bg-neutral-900 rounded-full border border-neutral-800"
              >
                <Ionicons name="close" size={18} color="#a3a3a3" />
              </Pressable>
            </View>

            {isRenaming && !isReadOnly ? (
              <View className="flex-row items-center gap-2 mt-2">
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Multi-pack title..."
                  placeholderTextColor="#525252"
                  className="flex-1 bg-neutral-900 border border-amber-500/50 text-white font-mono text-xs px-3 py-2 rounded-lg"
                  autoFocus
                />
                <Pressable
                  onPress={handleRenamePack}
                  disabled={isSaving}
                  className="bg-amber-500 px-3 py-2 rounded-lg"
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text className="text-black font-mono text-xs font-bold">SAVE</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setIsRenaming(false);
                    setNewName(packName);
                  }}
                  className="bg-neutral-800 px-2.5 py-2 rounded-lg"
                >
                  <Text className="text-neutral-400 font-mono text-xs">CANCEL</Text>
                </Pressable>
              </View>
            ) : (
              <View className="flex-row items-center justify-between mt-1.5">
                <Text
                  className="text-white font-bold text-lg flex-1 pr-2 uppercase"
                  style={{ fontFamily: 'VCR_OSD_MONO' }}
                >
                  {packName}
                </Text>
                {!isReadOnly && (
                  <Pressable
                    onPress={() => setIsRenaming(true)}
                    className="flex-row items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800"
                  >
                    <Ionicons name="pencil" size={11} color="#f59e0b" />
                    <Text className="text-amber-500 font-mono text-[9px] font-bold">RENAME</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Included Movies / Shows List */}
          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ padding: 14 }}>
            <Text className="text-neutral-500 font-mono text-[10px] uppercase tracking-widest mb-3">
              INCLUDED TITLES (TAP TO OPEN)
            </Text>
            {packItems.map((item, idx) => {
              const media = item.movies || item.shows;
              const title = getItemDisplayTitle(item);
              const origTitle = (media as any)?.title || (media as any)?.name || '';
              const year = (item.movies?.release_date || item.shows?.first_air_date || '').slice(0, 4);
              const posterUrl = item.custom_poster_url || (media ? getPosterUrl(media.poster_path) : null);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    playSound('click');
                    onClose();
                    onSelectItem(item);
                  }}
                  className="flex-row items-center bg-neutral-950/90 border border-neutral-800 rounded-xl p-2.5 mb-2.5 active:border-amber-500/50"
                >
                  <View className="w-12 h-16 rounded overflow-hidden bg-neutral-900 mr-3 items-center justify-center">
                    {item.format === 'VHS' ? (
                      <VHSCard
                        posterUrl={posterUrl}
                        isCustom={!!item.custom_poster_url}
                        isBootleg={item.is_bootleg}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : ['DVD', 'BluRay', '4K'].includes(item.format) ? (
                      <GlossyCard
                        posterUrl={posterUrl}
                        format={item.format as any}
                        isCustom={!!item.custom_poster_url}
                        isBootleg={item.is_bootleg}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : posterUrl ? (
                      <Image source={{ uri: posterUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <FontAwesome name="film" size={16} color="#404040" />
                    )}
                  </View>

                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-amber-500 font-mono text-[10px] font-bold">#{idx + 1}</Text>
                      <Text className="text-white font-bold text-sm flex-1" numberOfLines={1}>
                        {title}
                      </Text>
                    </View>
                    {origTitle && origTitle.toLowerCase() !== title.toLowerCase() && (
                      <Text className="text-neutral-500 font-mono text-[9px]" numberOfLines={1}>
                        TMDB: {origTitle}
                      </Text>
                    )}
                    <View className="flex-row items-center gap-2 mt-1 flex-wrap">
                      {year ? (
                        <Text className="text-neutral-400 font-mono text-[10px]">{year}</Text>
                      ) : null}
                      {item.media_type === 'tv' && item.season_number !== null && item.season_number !== undefined && (
                        <Text className="text-blue-400 font-mono text-[10px] font-bold">
                          {isSpecialSeason(item.season_number) ? 'Special / Volume' : `Season ${item.season_number}`}
                        </Text>
                      )}
                      <View className={`px-1.5 py-0.5 rounded ${FORMAT_COLORS[item.format] || 'bg-neutral-700'}`}>
                        <Text className="text-white font-mono text-[8px] font-bold">
                          {item.format === 'BluRay' ? 'Blu-ray' : item.format}
                        </Text>
                      </View>
                      {item.edition ? (
                        <Text className="text-neutral-500 font-mono text-[9px]" numberOfLines={1}>
                          ({item.edition})
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {!isReadOnly && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleRemoveFromPack(item);
                      }}
                      className="p-2 bg-red-950/40 border border-red-900/40 rounded-lg mr-1"
                    >
                      <Ionicons name="unlink-outline" size={14} color="#f87171" />
                    </Pressable>
                  )}
                  <Ionicons name="chevron-forward" size={16} color="#525252" />
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
