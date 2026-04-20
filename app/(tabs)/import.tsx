import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useBatchImportMetadata } from '@/hooks/useCollection';
import { useRouter } from 'expo-router';

export default function ImportScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const [csvData, setCsvData] = useState('');
  const importMutation = useBatchImportMetadata(userId ?? undefined);

  const handleImport = () => {
    if (!csvData.trim()) return;
    
    // Parse CSV: Expecting TMDB_ID, MEDIA_TYPE (movie/tv), optional TITLE_HINT
    const lines = csvData.split('\n').filter(l => l.trim());
    const rows = lines.map(line => {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length < 2) return null;
      const [id, type, hint] = parts;
      return {
        tmdb_id: parseInt(id),
        media_type: type?.toLowerCase() === 'tv' ? 'tv' : 'movie',
        notes_match: hint
      };
    }).filter((r): r is { tmdb_id: number; media_type: string; notes_match?: string } => !!r && !isNaN(r.tmdb_id));

    if (rows.length === 0) {
      Alert.alert('Error', 'No valid rows found. Format: TMDB_ID, TYPE (movie/tv), NAME');
      return;
    }

    importMutation.mutate(rows, {
      onSuccess: () => {
        Alert.alert('Success', `Imported metadata for ${rows.length} items.`);
        router.back();
      }
    });
  };

  return (
    <ScrollView className="flex-1 bg-black p-6">
      <View className="flex-row items-center justify-between mb-8">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#f59e0b" />
        </Pressable>
        <Text className="text-amber-500 font-bold font-mono text-xl">BATCH IMPORT</Text>
        <View className="w-8" />
      </View>

      <View className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 mb-6">
        <Text className="text-white font-mono font-bold mb-2">HOW TO RECOVERY:</Text>
        <Text className="text-neutral-400 font-mono text-xs mb-1">1. Open your spreadsheet.</Text>
        <Text className="text-neutral-400 font-mono text-xs mb-1">2. Copy your columns in this order: TMDB_ID, TYPE, NAME.</Text>
        <Text className="text-neutral-400 font-mono text-xs mb-4">3. Paste them below. One per line.</Text>
        
        <TextInput
          multiline
          placeholder={'425, movie, Ice Age\n123, movie, Dune...'}
          placeholderTextColor="#444"
          value={csvData}
          onChangeText={setCsvData}
          className="bg-black text-white p-4 rounded-lg font-mono text-xs min-h-[300px] border border-neutral-800"
          textAlignVertical="top"
        />
      </View>

      <Pressable 
        onPress={handleImport}
        disabled={importMutation.isPending}
        className={`bg-amber-500 p-4 rounded-xl flex-row items-center justify-center ${importMutation.isPending ? 'opacity-50' : ''}`}
      >
        <Text className="text-black font-bold font-mono uppercase mr-2">Start Recovery Import</Text>
        {importMutation.isPending && <ActivityIndicator color="black" size="small" />}
      </Pressable>

      {importMutation.isPending && (
        <View className="mt-4">
          <Text className="text-amber-500 font-mono text-center text-xs">
            Processing {importMutation.progress.current} of {importMutation.progress.total}...
          </Text>
          <View className="h-1 bg-neutral-900 rounded-full mt-2 overflow-hidden">
             <View 
               style={{ width: `${(importMutation.progress.current / importMutation.progress.total) * 100}%` }}
               className="h-full bg-amber-500" 
             />
          </View>
        </View>
      )}
    </ScrollView>
  );
}
