import React, { useState, useMemo } from 'react';
import { Modal, View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

type TagManagerModalProps = {
  visible: boolean;
  onClose: () => void;
  collection: any[] | undefined;
  userId: string | undefined | null;
};

interface MatchedTitle {
  id: string;
  title: string;
  format: string;
  mediaId: number;
  type: 'movie' | 'tv';
  currentTags: string;
}

export function TagManagerModal({ visible, onClose, collection, userId }: TagManagerModalProps) {
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    collection?.forEach((item: any) => {
      const media = item.movies || item.shows;
      if (media?.sorting_tags) {
        media.sorting_tags.split(',').forEach((t: string) => {
          const cleanTag = t.trim();
          if (cleanTag) tagsSet.add(cleanTag);
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [collection]);

  // Find all collection items that have this tag
  const getTitlesForTag = (tag: string): MatchedTitle[] => {
    const matched: MatchedTitle[] = [];
    collection?.forEach((item: any) => {
      const media = item.movies || item.shows;
      if (media?.sorting_tags) {
        const tagsList = media.sorting_tags.split(',').map((t: string) => t.trim().toLowerCase());
        if (tagsList.includes(tag.toLowerCase())) {
          matched.push({
            id: item.id,
            title: media.title || media.name || 'Unknown Title',
            format: item.format,
            mediaId: media.id,
            type: item.movies ? 'movie' : 'tv',
            currentTags: media.sorting_tags
          });
        }
      }
    });
    return matched;
  };

  const toggleExpand = (tag: string) => {
    setExpandedTags(prev => ({ ...prev, [tag]: !prev[tag] }));
  };

  const handleRemoveTagFromTitle = async (titleItem: MatchedTitle, tagToRemove: string) => {
    try {
      setIsUpdating(true);
      const cleanTags = titleItem.currentTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.toLowerCase() !== tagToRemove.toLowerCase())
        .join(', ');

      const table = titleItem.type === 'movie' ? 'movies' : 'shows';
      const { error } = await supabase
        .from(table)
        .update({ sorting_tags: cleanTags || null })
        .eq('id', titleItem.mediaId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['collection', userId] });
      await queryClient.invalidateQueries({ queryKey: ['collection'] });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to remove tag');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteTag = async (tag: string) => {
    const matchedTitles = getTitlesForTag(tag);
    Alert.alert(
      'Delete Tag',
      `Are you sure you want to delete the tag "${tag}" from all ${matchedTitles.length} titles?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUpdating(true);
              
              const updatePromises = matchedTitles.map(t => {
                const cleanTags = t.currentTags
                  .split(',')
                  .map(x => x.trim())
                  .filter(x => x.toLowerCase() !== tag.toLowerCase())
                  .join(', ');
                
                const table = t.type === 'movie' ? 'movies' : 'shows';
                return supabase
                  .from(table)
                  .update({ sorting_tags: cleanTags || null })
                  .eq('id', t.mediaId);
              });
              
              const results = await Promise.all(updatePromises);
              const errorResult = results.find(r => r.error);
              if (errorResult) throw errorResult.error;

              await queryClient.invalidateQueries({ queryKey: ['collection', userId] });
              await queryClient.invalidateQueries({ queryKey: ['collection'] });
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete tag');
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View className="flex-1 bg-neutral-950 pt-16 px-6">
        
        {/* Header */}
        <View className="flex-row items-center justify-between pb-4 border-b border-neutral-800">
          <View className="flex-row items-center gap-2">
            <Ionicons name="pricetags-outline" size={20} color="#f59e0b" />
            <Text className="text-white font-mono text-lg font-bold uppercase tracking-wider">TAG MANAGER</Text>
          </View>
          <Pressable onPress={onClose} className="bg-neutral-900 p-2 rounded-full border border-neutral-800">
            <Ionicons name="close" size={20} color="white" />
          </Pressable>
        </View>

        {isUpdating && (
          <View className="absolute inset-0 bg-black/60 items-center justify-center z-50">
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text className="text-neutral-400 font-mono text-xs mt-3 uppercase tracking-widest">Updating tags...</Text>
          </View>
        )}

        <ScrollView className="flex-1 mt-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          {allTags.length === 0 ? (
            <View className="py-12 items-center">
              <Ionicons name="pricetags-outline" size={48} color="#404040" />
              <Text className="text-neutral-500 font-mono text-center text-sm mt-4 leading-5">
                No sorting tags found in your collection.{'\n\n'}You can add them to any title via its detail page Franchise settings.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {allTags.map(tag => {
                const titles = getTitlesForTag(tag);
                const isExpanded = !!expandedTags[tag];

                return (
                  <View key={tag} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                    
                    {/* Tag Summary Row */}
                    <Pressable 
                      onPress={() => toggleExpand(tag)}
                      className="p-4 flex-row items-center justify-between active:bg-neutral-800/50"
                    >
                      <View className="flex-1 mr-4">
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="pricetag" size={12} color="#f59e0b" />
                          <Text className="text-white font-bold font-mono text-sm">{tag}</Text>
                        </View>
                        <Text className="text-neutral-500 font-mono text-[10px] mt-1 uppercase font-semibold">
                          {titles.length} {titles.length === 1 ? 'title' : 'titles'} connected
                        </Text>
                      </View>
                      
                      <View className="flex-row items-center gap-3">
                        <Pressable 
                          onPress={() => handleDeleteTag(tag)}
                          className="bg-red-950/40 border border-red-900/50 p-2 rounded-lg"
                        >
                          <Ionicons name="trash-outline" size={14} color="#f87171" />
                        </Pressable>
                        <Ionicons 
                          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                          size={16} 
                          color="#737373" 
                        />
                      </View>
                    </Pressable>

                    {/* Connected Titles Sub-List */}
                    {isExpanded && (
                      <View className="bg-black/40 border-t border-neutral-800/80 px-4 py-3 gap-2">
                        <Text className="text-neutral-500 font-mono text-[9px] font-bold uppercase tracking-wider mb-1">Connected Titles</Text>
                        {titles.map(titleItem => (
                          <View key={titleItem.id} className="flex-row items-center justify-between py-2 border-b border-neutral-900/60 last:border-b-0">
                            <View className="flex-1 mr-3">
                              <Text className="text-neutral-300 font-mono text-xs font-semibold">{titleItem.title}</Text>
                              <Text className="text-neutral-600 font-mono text-[9px] uppercase font-bold mt-0.5">{titleItem.format} COPY</Text>
                            </View>
                            <Pressable 
                              onPress={() => handleRemoveTagFromTitle(titleItem, tag)}
                              className="bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 rounded-lg active:bg-neutral-800"
                            >
                              <Text className="text-neutral-400 font-mono text-[9px] font-bold uppercase">REMOVE</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}

                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

      </View>
    </Modal>
  );
}
