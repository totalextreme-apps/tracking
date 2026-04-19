import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function DebugScreen() {
  const { userId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRaw() {
      if (!userId) return;
      try {
        const { data, error: err } = await supabase
          .from('collection_items')
          .select('*')
          .eq('user_id', userId);
        
        if (err) throw err;
        setItems(data || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRaw();
  }, [userId]);

  if (loading) return <View className="flex-1 bg-black items-center justify-center"><ActivityIndicator color="#f59e0b" /></View>;

  return (
    <ScrollView className="flex-1 bg-black p-4">
      <Text className="text-amber-500 font-mono text-xl mb-4">RAW DB DEBUG</Text>
      <Text className="text-neutral-500 font-mono text-xs mb-8">User ID: {userId}</Text>

      {items.length === 0 ? (
        <Text className="text-neutral-600 font-mono">No items found in DB for this user.</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} className="mb-4 p-4 bg-neutral-900 rounded border border-neutral-800">
            <Text className="text-white font-mono text-xs font-bold">ID: {item.id}</Text>
            <Text className="text-neutral-400 font-mono text-[10px]">Type: {item.media_type}</Text>
            <Text className="text-neutral-400 font-mono text-[10px]">Movie ID: {item.movie_id}</Text>
            <Text className="text-neutral-400 font-mono text-[10px]">Title Filter: {item.notes}</Text>
            <Text className="text-neutral-400 font-mono text-[10px]">Status: {item.status}</Text>
            <Text className="text-neutral-400 font-mono text-[10px]">Format: {item.format}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
