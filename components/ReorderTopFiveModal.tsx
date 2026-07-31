import React, { useState } from 'react';
import { View, Text, Pressable, Modal, Image, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReorderTopFive } from '@/hooks/useSocial';

interface ReorderTopFiveModalProps {
  visible: boolean;
  onClose: () => void;
  items: any[];
  userId: string;
}

export function ReorderTopFiveModal({ visible, onClose, items, userId }: ReorderTopFiveModalProps) {
  const [data, setData] = useState(items || []);
  const reorderMutation = useReorderTopFive(userId);

  // Sync data when items prop changes or modal becomes visible
  React.useEffect(() => {
    if (visible && items) {
      setData(items);
    }
  }, [visible, items]);

  const handleSave = async () => {
    try {
      const followingIds = data.map(i => i.following_id);
      await reorderMutation.mutateAsync(followingIds);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to save order.');
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
    const profile = item.profiles;
    const username = profile?.username ? `@${profile.username}` : 'Anonymous Member';
    
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

        <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#222', marginRight: 12, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' }}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Ionicons name="person" size={18} color="#737373" />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'SpaceMono', fontSize: 12, color: 'white', fontWeight: 'bold' }} numberOfLines={1}>
            {username.toUpperCase()}
          </Text>
        </View>
        
        <View style={{ width: 30, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, color: '#f59e0b', fontWeight: 'bold' }}>★ #{index + 1}</Text>
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
            REORDER TOP 5 MEMBERS
          </Text>
          <Pressable onPress={handleSave} disabled={reorderMutation.isPending} style={{ padding: 4 }}>
            {reorderMutation.isPending ? <ActivityIndicator size="small" color="#f59e0b" /> : <Text style={{ fontFamily: 'SpaceMono', color: '#f59e0b', fontSize: 12, fontWeight: 'bold' }}>SAVE</Text>}
          </Pressable>
        </View>

        <View style={{ padding: 16, backgroundColor: '#111' }}>
          <Text style={{ fontFamily: 'SpaceMono', color: '#888', fontSize: 10, textAlign: 'center' }}>
            Use the arrows to rearrange the order of your Top 5 pinned members on your community page.
          </Text>
        </View>

        <FlatList
          data={data}
          keyExtractor={(item) => item.following_id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    </Modal>
  );
}
