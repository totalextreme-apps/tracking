import { Ionicons } from '@expo/vector-icons';
import { useState, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useBatchImportMetadata } from '@/hooks/useCollection';
import { useRouter } from 'expo-router';

export default function ImportScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const importMutation = useBatchImportMetadata(userId ?? undefined);

  // Use standard HTML input for web (since user is on Chrome)
  const fileInputRef = useRef<any>(null);

  const handleFileChange = (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const text = e.target.result;
        processCsv(text);
      } catch (err) {
        Alert.alert('Error', 'Failed to read file.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const processCsv = (csvText: string) => {
    // Basic CSV Parser that handles quotes
    const parseCsvLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current);
      return result;
    };

    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      Alert.alert('Error', 'File is empty or invalid.');
      return;
    }

    // Identify columns by header name
    const headerRow = parseCsvLine(lines[0].toLowerCase());
    const colIdx = {
      tmdbId: headerRow.findIndex(h => h.includes('tmdb id') || h.includes('id')),
      title: headerRow.findIndex(h => h.includes('title')),
      mediaType: headerRow.findIndex(h => h.includes('media type') || h.includes('type')),
      format: headerRow.findIndex(h => h.includes('format')),
      status: headerRow.findIndex(h => h.includes('status')),
      notes: headerRow.findIndex(h => h.includes('notes') || h.includes('edition'))
    };

    // Skip header row
    const dataRows = lines.slice(1);
    const rows = dataRows.map(line => {
      const cols = parseCsvLine(line);
      const tmdbIdStr = colIdx.tmdbId !== -1 ? cols[colIdx.tmdbId] : '';
      const tmdbId = parseInt(tmdbIdStr);
      
      const mediaTypeRaw = colIdx.mediaType !== -1 ? (cols[colIdx.mediaType] || '').toLowerCase() : '';
      const mediaType = mediaTypeRaw === 'tv' ? 'tv' : 'movie';
      
      const format = colIdx.format !== -1 ? (cols[colIdx.format] || 'DVD') : 'DVD';
      const statusRaw = colIdx.status !== -1 ? (cols[colIdx.status] || '').toLowerCase() : '';
      const status = statusRaw.includes('wishlist') ? 'wishlist' : 'owned';
      
      const notes = colIdx.notes !== -1 ? (cols[colIdx.notes] || '') : '';
      const title = colIdx.title !== -1 ? (cols[colIdx.title] || '') : '';

      return {
        tmdb_id: tmdbId,
        media_type: mediaType,
        format: format,
        status: status,
        notes_match: notes || title
      };
    }).filter((r): r is { tmdb_id: number; media_type: string; format: string; status: string; notes_match: string } => !!r && !isNaN(r.tmdb_id));

    if (rows.length === 0) {
      Alert.alert('Error', 'No valid TMDB IDs found in the file.');
      return;
    }

    importMutation.mutate(rows, {
      onSuccess: () => {
        Alert.alert('Success', `Imported metadata for ${rows.length} items. Your collection should be restored!`);
        router.back();
      },
      onError: (err: any) => {
        Alert.alert('Import Failed', err.message);
      }
    });
  };

  return (
    <ScrollView className="flex-1 bg-black p-6">
      <View className="flex-row items-center justify-between mb-8">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#f59e0b" />
        </Pressable>
        <Text className="text-amber-500 font-bold font-mono text-xl">CSV IMPORT</Text>
        <View className="w-8" />
      </View>

      <View className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 mb-8 items-center">
        <View className="w-16 h-16 bg-neutral-800 rounded-full items-center justify-center mb-4">
          <Ionicons name="cloud-upload-outline" size={32} color="#f59e0b" />
        </View>
        <Text className="text-white font-mono font-bold text-lg mb-2">RESTORE FROM FILE</Text>
        <Text className="text-neutral-400 font-mono text-center text-xs mb-8 leading-5">
           Upload the exact CSV file you exported from your settings.
           We'll use it to re-link all your movie titles and posters.
        </Text>

        {Platform.OS === 'web' ? (
          <View className="w-full">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <Pressable 
              onPress={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending || loading}
              className={`w-full bg-amber-500 p-5 rounded-2xl flex-row items-center justify-center ${importMutation.isPending || loading ? 'opacity-50' : ''}`}
            >
              <Ionicons name="document-text-outline" size={20} color="black" className="mr-2" />
              <Text className="text-black font-bold font-mono uppercase">
                {fileName || 'SELECT CSV FILE'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Text className="text-red-500 font-mono text-xs text-center">
            File upload is currently supported on the web version.
          </Text>
        )}
      </View>

      {importMutation.isPending && (
        <View className="items-center">
          <ActivityIndicator color="#f59e0b" size="large" className="mb-4" />
          <Text className="text-amber-500 font-mono text-lg font-bold">RECOVERING COLLECTION...</Text>
          <Text className="text-neutral-500 font-mono text-xs mt-2">
            Linked {importMutation.progress.current} of {importMutation.progress.total} items
          </Text>
          <View className="w-full h-2 bg-neutral-900 rounded-full mt-6 overflow-hidden">
             <View 
               style={{ width: `${(importMutation.progress.current / importMutation.progress.total) * 100}%` }}
               className="h-full bg-amber-500" 
             />
          </View>
        </View>
      )}

      {!importMutation.isPending && !loading && (
        <View className="bg-neutral-950 p-4 rounded-xl border border-neutral-900">
           <Text className="text-neutral-600 font-mono text-[10px] uppercase mb-2">EXPECTED FORMAT:</Text>
           <Text className="text-neutral-700 font-mono text-[9px]">
             "TMDB ID","Title","Media Type","Season","Release Date","Format","Status"...
           </Text>
        </View>
      )}
    </ScrollView>
  );
}
