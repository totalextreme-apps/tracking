import React, { useState } from 'react';
import { View, Text, Pressable, Modal, Image, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { getPosterUrl } from '@/lib/dummy-data';

interface ReorderShelfModalProps {
  visible: boolean;
  onClose: () => void;
  items: any[];
  userId: string;
  type: 'display' | 'grail';
}

export function ReorderShelfModal({ visible, onClose, items, userId, type }: ReorderShelfModalProps) {
  const [data, setData] = useState(items || []);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  // Sync data when items prop changes or modal becomes visible
  React.useEffect(() => {
    if (visible && items) {
      setData(items);
    }
  }, [visible, items]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const itemIds = data.map(i => i.id);
      const { error } = await supabase.rpc('update_collection_order', {
        item_ids: itemIds,
        order_type: type
      });
      if (error) throw error;
      
      // Invalidate queries so the profile refetches
      queryClient.invalidateQueries({ queryKey: ['collection', userId] });
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to save order.');
    } finally {
      setIsSaving(false);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newData = [...data];
    const item = newData.splice(index, 1)[0];
    newData.splice(index - 1, 0, item);
    setData(newData);
  };

  const moveDown = (index: number) => {
    if (index === data.length - 1) return;
    const newData = [...data];
    const item = newData.splice(index, 1)[0];
    newData.splice(index + 1, 0, item);
    setData(newData);
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const title = item.movies?.title || item.shows?.name;
    const poster = getPosterUrl(item.movies?.poster_path || item.shows?.poster_path);
    
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#0a0a0a',
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#1a1a1a',
        }}
      >
        <View style={{ flexDirection: 'column', marginRight: 16 }}>
          <Pressable 
            onPress={() => moveUp(index)} 
            disabled={index === 0}
            style={{ opacity: index === 0 ? 0.2 : 1, padding: 4 }}
          >
            <Ionicons name="chevron-up" size={24} color="#f59e0b" />
          </Pressable>
          <Pressable 
            onPress={() => moveDown(index)} 
            disabled={index === data.length - 1}
            style={{ opacity: index === data.length - 1 ? 0.2 : 1, padding: 4 }}
          >
            <Ionicons name="chevron-down" size={24} color="#f59e0b" />
          </Pressable>
        </View>

        <Image source={{ uri: poster }} style={{ width: 40, height: 60, borderRadius: 4, marginRight: 12, backgroundColor: '#222' }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'SpaceMono', fontSize: 12, color: 'white', fontWeight: 'bold' }} numberOfLines={1}>{title}</Text>
          <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, color: '#f59e0b' }}>{item.format}</Text>
        </View>
        <View style={{ width: 30, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, color: '#525252' }}>#{index + 1}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', backgroundColor: '#0a0a0a' }}>
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <Text style={{ fontFamily: 'SpaceMono', color: '#525252', fontSize: 12 }}>CANCEL</Text>
          </Pressable>
          <Text style={{ fontFamily: 'SpaceMono', color: 'white', fontWeight: 'bold', fontSize: 14 }}>
            REORDER {type === 'display' ? 'ON DISPLAY' : 'GRAILS'}
          </Text>
          <Pressable onPress={handleSave} disabled={isSaving} style={{ padding: 4 }}>
            {isSaving ? <ActivityIndicator size="small" color="#f59e0b" /> : <Text style={{ fontFamily: 'SpaceMono', color: '#f59e0b', fontSize: 12, fontWeight: 'bold' }}>SAVE</Text>}
          </Pressable>
        </View>

        <View style={{ padding: 16, backgroundColor: '#111' }}>
          <Text style={{ fontFamily: 'SpaceMono', color: '#888', fontSize: 10, textAlign: 'center' }}>
            Use the arrows to move items up or down.
          </Text>
        </View>

        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    </Modal>
  );
}
