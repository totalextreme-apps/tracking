import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useDeepRepair, usePurgeOrphans, useResetMetadata } from '@/hooks/useCollection';
import { useRouter } from 'expo-router';

import { TextInput } from 'react-native';

export default function DebugScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const repair = useDeepRepair(userId ?? undefined);
  const purge = usePurgeOrphans(userId ?? undefined);
  const reset = useResetMetadata(userId ?? undefined);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const buildTime = '2026-04-19 21:35';

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
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
  };

  const filteredItems = items.filter(item => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      item.id?.toLowerCase().includes(s) ||
      String(item.movie_id).includes(s) ||
      String(item.show_id).includes(s) ||
      item.notes?.toLowerCase().includes(s)
    );
  });

  useEffect(() => {
    fetchData();
  }, [userId]);

  if (loading) return <View className="flex-1 bg-black items-center justify-center"><ActivityIndicator color="#f59e0b" /></View>;

  return (
    <ScrollView className="flex-1 bg-black p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={20} color="#525252" />
        </Pressable>
        <Text className="text-amber-500 font-bold font-mono text-xl">RAW DB DEBUG</Text>
        <View className="w-8" />
      </View>

      <View className="mb-6">
        <TextInput
          placeholder="SEARCH RAW DATA (ID, TITLE, NOTES...)"
          placeholderTextColor="#444"
          value={search}
          onChangeText={setSearch}
          className="bg-neutral-900 border border-neutral-800 p-3 rounded-lg text-white font-mono text-xs"
        />
      </View>

      <View className="mb-8 gap-3">
        <Pressable 
          disabled={repair.isPending}
          onPress={() => repair.mutate(undefined, { onSuccess: fetchData })}
          className="bg-amber-500/10 border border-amber-500 p-4 rounded-xl flex-row items-center justify-between"
        >
          <View>
            <Text className="text-amber-500 font-bold font-mono uppercase text-sm">Deep Repair Collection</Text>
            <Text className="text-amber-500/50 font-mono text-[10px]">Force TMDB match for every orphaned record</Text>
          </View>
          {repair.isPending ? <ActivityIndicator size="small" color="#f59e0b" /> : <Ionicons name="flash-outline" size={20} color="#f59e0b" />}
        </Pressable>

        <Pressable 
          onPress={() => router.push('/import')}
          className="bg-emerald-500/10 border border-emerald-500 p-4 rounded-xl flex-row items-center justify-between"
        >
          <View>
            <Text className="text-emerald-500 font-bold font-mono uppercase text-sm">Spreadsheet Metadata Import</Text>
            <Text className="text-emerald-500/50 font-mono text-[10px]">Paste columns from your CSV/Spreadsheet</Text>
          </View>
          <Ionicons name="document-text-outline" size={20} color="#10b981" />
        </Pressable>

        <Pressable 
          disabled={reset.isPending}
          onPress={() => {
            if (confirm('This will disconnect ALL titles and reset them to ID: NULL (Orphans). Continue?')) {
              reset.mutate(undefined, { onSuccess: fetchData });
            }
          }}
          className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl flex-row items-center justify-between"
        >
          <View>
            <Text className="text-blue-500 font-bold font-mono uppercase text-sm">Force Reset Metadata</Text>
            <Text className="text-blue-500/50 font-mono text-[10px]">Rollback accidental TMDB mismatches</Text>
          </View>
          {reset.isPending ? <ActivityIndicator size="small" color="#3b82f6" /> : <Ionicons name="refresh-outline" size={20} color="#3b82f6" />}
        </Pressable>

        <Pressable 
          disabled={purge.isPending}
          onPress={() => purge.mutate(undefined, { onSuccess: fetchData })}
          className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex-row items-center justify-between"
        >
          <View>
            <Text className="text-red-500 font-bold font-mono uppercase text-sm">Purge ID-NULL Junk</Text>
            <Text className="text-red-500/50 font-mono text-[10px]">Delete records with zero ID data</Text>
          </View>
          {purge.isPending ? <ActivityIndicator size="small" color="#ef4444" /> : <Ionicons name="trash-outline" size={20} color="#ef4444" />}
        </Pressable>
      </View>

      <Text className="text-neutral-500 font-mono text-xs mb-1">User ID: {userId}</Text>
      <Text className="text-neutral-600 font-mono text-[10px] mb-8">Build: {buildTime}</Text>

      {filteredItems.length === 0 ? (
        <Text className="text-neutral-600 font-mono">No matching records found.</Text>
      ) : (
        filteredItems.map((item) => (
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
