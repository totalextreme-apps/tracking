import { exportAllArt, getAllArtMetadata, importArt } from '@/lib/custom-art-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';

export function CustomCoversSection() {
    const [customArtCount, setCustomArtCount] = useState(0);
    const [customArtSize, setCustomArtSize] = useState(0);
    const [isExportingArt, setIsExportingArt] = useState(false);
    const [isImportingArt, setIsImportingArt] = useState(false);

    // Load custom art stats (web only)
    const loadCustomArtStats = async () => {
        if (Platform.OS !== 'web') return;

        try {
            const metadata = await getAllArtMetadata();
            setCustomArtCount(metadata.length);
            const totalSize = metadata.reduce((sum, m) => sum + m.size, 0);
            setCustomArtSize(totalSize);
        } catch (e) {
            console.error('Failed to load custom art stats:', e);
        }
    };

    const handleExportCustomArt = async () => {
        if (Platform.OS !== 'web') return;

        setIsExportingArt(true);
        try {
            const zipBlob = await exportAllArt();
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tracking-custom-covers-${new Date().toISOString().split('T')[0]}.zip`;
            a.click();
            URL.revokeObjectURL(url);

            Alert.alert('Success', `Exported ${customArtCount} custom covers to ZIP file.`);
        } catch (e) {
            Alert.alert('Export Failed', (e as Error).message);
        } finally {
            setIsExportingArt(false);
        }
    };

    const handleImportCustomArt = async () => {
        if (Platform.OS !== 'web') return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        input.onchange = async (e: any) => {
            const file = e.target?.files?.[0];
            if (!file) return;

            setIsImportingArt(true);
            try {
                const count = await importArt(file);
                Alert.alert('Success', `Imported ${count} custom covers from backup.`);
                await loadCustomArtStats();
            } catch (e) {
                Alert.alert('Import Failed', (e as Error).message);
            } finally {
                setIsImportingArt(false);
            }
        };
        input.click();
    };

    // Load stats when mounted
    useState(() => {
        if (Platform.OS === 'web') {
            loadCustomArtStats();
        }
    });

    if (Platform.OS !== 'web') {
        return null; // Only available on web
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <View className="bg-neutral-900 rounded-lg overflow-hidden mt-6">
            <View className="bg-neutral-800 p-3 border-b border-neutral-700">
                <Text className="text-amber-500 font-mono text-xs font-bold tracking-widest">
                    CUSTOM COVERS (WEB ONLY)
                </Text>
            </View>

            <View className="p-4 border-b border-neutral-800">
                <Text className="text-neutral-400 font-mono text-xs leading-5 mb-2">
                    Upload custom box art stored locally in your browser. Export backups to prevent data loss if you clear browser cache.
                </Text>
                <View className="flex-row items-center gap-4 mt-2">
                    <Text className="text-neutral-500 font-mono text-xs">
                        {customArtCount} covers • {formatBytes(customArtSize)}
                    </Text>
                    <Pressable onPress={loadCustomArtStats}>
                        <FontAwesome name="refresh" size={12} color="#737373" />
                    </Pressable>
                </View>
            </View>

            <Pressable
                onPress={handleExportCustomArt}
                disabled={isExportingArt || customArtCount === 0}
                className={`p-4 flex-row items-center justify-between border-b border-neutral-800 ${customArtCount === 0 ? 'opacity-50' : 'active:bg-neutral-800'
                    }`}
            >
                <View className="flex-row items-center">
                    <View className="w-8 items-center"><FontAwesome name="download" size={14} color="#d1d5db" /></View>
                    <Text className="text-neutral-200 font-mono text-sm">Export Backup (ZIP)</Text>
                </View>
                {isExportingArt ? <ActivityIndicator size="small" color="#f59e0b" /> : <FontAwesome name="chevron-right" size={10} color="#525252" />}
            </Pressable>

            <Pressable
                onPress={handleImportCustomArt}
                disabled={isImportingArt}
                className="p-4 flex-row items-center justify-between active:bg-neutral-800"
            >
                <View className="flex-row items-center">
                    <View className="w-8 items-center"><FontAwesome name="upload" size={14} color="#d1d5db" /></View>
                    <Text className="text-neutral-200 font-mono text-sm">Restore from Backup</Text>
                </View>
                {isImportingArt ? <ActivityIndicator size="small" color="#f59e0b" /> : <FontAwesome name="chevron-right" size={10} color="#525252" />}
            </Pressable>
        </View>
    );
}
