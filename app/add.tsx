import * as Haptics from 'expo-haptics';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  Image as RNImage,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useAddToCollection } from '@/hooks/useCollection';
import { useTmdbSearch } from '@/hooks/useTmdbSearch';
import { getPosterUrl } from '@/lib/dummy-data';
import type { TmdbMovieResult } from '@/lib/tmdb';
import type { MovieFormat } from '@/types/database';

import { lookupUPC } from '@/lib/upc';
import { CameraView, useCameraPermissions } from 'expo-camera';

const FORMATS: MovieFormat[] = ['VHS', 'DVD', 'BluRay', '4K', 'Digital'];

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovieResult | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<MovieFormat[]>(['DVD']);
  const [status, setStatus] = useState<'owned' | 'wishlist'>('owned');

  const searchQuery = useTmdbSearch(debouncedQuery);
  const addMutation = useAddToCollection(userId);

  // Camera Logic
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Prevent rapid multiple scans using ref for immediate blocking
  const isProcessingScan = useRef(false);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (isProcessingScan.current) return;

    // Lock immediately
    isProcessingScan.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Close camera immediately to prevent user from keeping scanning
    setIsScanning(false);
    setIsLookingUp(true);

    try {
      const title = await lookupUPC(data);
      if (title) {
        setQuery(title);
      } else {
        Alert.alert(
          'Not Found',
          `Could not identify product for barcode: ${data}`,
          [{ text: "OK", onPress: () => isProcessingScan.current = false }]
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to lookup barcode');
    } finally {
      setIsLookingUp(false);
      // We don't unlock 'isProcessingScan' here if successful, 
      // because we don't want to scan again immediately.
      // We only unlock if failed (in Alert logic) or if user manually restarts.
    }
  };

  const startScanning = async () => {
    if (!permission) {
      await requestPermission();
    }
    if (!permission?.granted) {
      const { status } = await requestPermission();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to scan barcodes.');
        return;
      }
    }
    isProcessingScan.current = false;
    setIsScanning(true);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Magic Effect: Detect Manual Barcode Entry
  useEffect(() => {
    // If it looks like a UPC/EAN (12 or 13 digits)
    if (/^\d{12,13}$/.test(debouncedQuery)) {
      handleManualBarcode(debouncedQuery);
    }
  }, [debouncedQuery]);

  const handleManualBarcode = async (code: string) => {
    setIsLookingUp(true);
    try {
      const title = await lookupUPC(code);
      if (title) {
        setQuery(title);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      // failures silently fail, user can keep typing if it was just a year or something
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSelectMovie = (movie: TmdbMovieResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMovie(movie);
  };

  const handleAdd = async () => {
    if (!selectedMovie) return;
    if (!userId) {
      Alert.alert(
        'Not signed in',
        'Anonymous sign-in is required. Enable it in Supabase Dashboard → Auth → Providers.'
      );
      return;
    }
    if (selectedFormats.length === 0) {
      Alert.alert('No format selected', 'Please select at least one format (DVD, VHS, etc).');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await addMutation.mutateAsync({
        tmdbMovie: selectedMovie,
        formats: selectedFormats,
        status,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Check for uniqueness violation (Supabase error 23505)
      if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
        Alert.alert('Already in collection', `You might already have ${selectedMovie.title} on one of these formats.`);
      } else {
        Alert.alert('Could not add movie', msg);
      }
    }
  };

  const renderResult = ({ item }: { item: TmdbMovieResult }) => {
    const posterUrl = getPosterUrl(item.poster_path, 'w154');
    const year = item.release_date?.slice(0, 4) ?? '—';

    return (
      <Pressable
        onPress={() => handleSelectMovie(item)}
        className="flex-row items-center p-3 bg-neutral-900 rounded-lg mb-2 active:opacity-80"
      >
        <View className="rounded bg-neutral-800 overflow-hidden" style={{ width: 48, height: 72 }}>
          {posterUrl ? (
            <RNImage source={{ uri: posterUrl }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-neutral-600 text-xs">?</Text>
            </View>
          )}
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-white font-medium" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-neutral-500 text-sm mt-0.5">{year}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-neutral-950">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header with CRT Glow */}
      <View
        className="flex-row items-center justify-between px-4 pb-4 bg-[#0a0a0a] z-50 mb-2"
        style={{
          paddingTop: insets.top,
          shadowColor: '#00ff88', // CRT Phosphor Green Glow
          shadowOffset: { width: 0, height: 4 }, // Cast downwards
          shadowOpacity: 0.15,
          shadowRadius: 10,
          elevation: 5,
        }}
      >
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Text className="text-neutral-400 font-mono text-xs">CANCEL</Text>
        </Pressable>
        <RNImage
          source={require('@/assets/images/logo_tracking.png')}
          style={{ width: 140, height: 24, resizeMode: 'contain' }}
        />
        <View className="w-16" />
      </View>

      {!userId && (
        <View className="bg-red-900/20 mx-4 mt-4 p-3 rounded border border-red-900/50">
          <Text className="text-red-400 font-mono text-xs text-center">
            Not signed in. enable Anonymous Auth in Supabase or check connection.
          </Text>
        </View>
      )}

      <View className="p-4 flex-row">
        <TextInput
          placeholder="Search movies or enter UPC..."
          placeholderTextColor="#6b7280"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => Keyboard.dismiss()}
          className="bg-neutral-900 text-white px-4 py-3 rounded-lg font-mono flex-1 mr-2"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          onPress={startScanning}
          className="bg-neutral-900 w-12 items-center justify-center rounded-lg border border-neutral-800"
        >
          {isLookingUp ? (
            <ActivityIndicator size="small" color="#f59e0b" />
          ) : (
            <FontAwesome name="barcode" size={20} color="#f59e0b" />
          )}
        </Pressable>
      </View>

      {/* Camera Modal Overlay */}
      {isScanning && (
        <View className="absolute inset-0 z-50 bg-black">
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["upc_a", "upc_e", "ean13", "ean8", "qr", "code128", "code39"],
            }}
          >
            <View className="flex-1 bg-black/50 items-center justify-center">
              <Text className="text-white font-mono text-center mb-4 text-lg">Scan Barcode</Text>
              <Text className="text-neutral-400 font-mono text-center mb-10 text-xs px-10">
                Point at a UPC or EAN barcode. On web, detection may vary by browser.
              </Text>
              <View className="w-64 h-40 border-2 border-amber-500 rounded-lg bg-transparent" />
              <Pressable
                onPress={() => setIsScanning(false)}
                className="mt-20 bg-neutral-900 px-6 py-3 rounded-full border border-neutral-700"
              >
                <Text className="text-white font-mono">Cancel</Text>
              </Pressable>
            </View>
          </CameraView>
        </View>
      )}

      {selectedMovie ? (
        <View className="px-4 pb-4">
          <View className="bg-neutral-900 rounded-lg p-4 mb-4">
            <View className="flex-row items-center mb-4">
              <View className="w-20 h-28 rounded bg-neutral-800 overflow-hidden">
                {getPosterUrl(selectedMovie.poster_path) && (
                  <RNImage
                    source={{ uri: getPosterUrl(selectedMovie.poster_path)! }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                )}
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-white text-lg font-semibold">{selectedMovie.title}</Text>
                <Text className="text-neutral-500">
                  {selectedMovie.release_date?.slice(0, 4) ?? '—'}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2 mb-4">
              <Pressable
                onPress={() => setStatus('owned')}
                className={`flex-1 py-2 rounded ${status === 'owned' ? 'bg-amber-600' : 'bg-neutral-800'}`}
              >
                <Text
                  className={`font-mono text-sm text-center ${status === 'owned' ? 'text-white' : 'text-neutral-400'
                    }`}
                >
                  OWNED
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setStatus('wishlist')}
                className={`flex-1 py-2 rounded ${status === 'wishlist' ? 'bg-amber-600' : 'bg-neutral-800'}`}
              >
                <Text
                  className={`font-mono text-sm text-center ${status === 'wishlist' ? 'text-white' : 'text-neutral-400'
                    }`}
                >
                  WISHLIST
                </Text>
              </Pressable>
            </View>
            <Text className="text-amber-500/90 font-mono text-xs tracking-widest mb-2">
              FORMAT
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {FORMATS.map((f) => {
                const isSelected = selectedFormats.includes(f);
                return (
                  <Pressable
                    key={f}
                    onPress={() => {
                      setSelectedFormats((prev) => {
                        if (prev.includes(f)) {
                          return prev.filter(format => format !== f);
                        } else {
                          return [...prev, f];
                        }
                      });
                      Haptics.selectionAsync();
                    }}
                    className={`px-3 py-2 rounded ${isSelected ? 'bg-amber-600' : 'bg-neutral-800'
                      }`}
                  >
                    <Text
                      className={`font-mono text-sm ${isSelected ? 'text-white' : 'text-neutral-400'
                        }`}
                    >
                      {f}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={handleAdd}
              disabled={addMutation.isPending}
              className="bg-emerald-600 py-3 rounded-lg items-center active:opacity-90"
              style={{ minHeight: 48 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {addMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-mono font-semibold">ADD</Text>
              )}
            </Pressable>
          </View>
          <Pressable
            onPress={() => setSelectedMovie(null)}
            className="py-2"
          >
            <Text className="text-neutral-500 font-mono text-center">
              Choose different movie
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-1 px-4">
          {searchQuery.isFetching && debouncedQuery.length >= 2 ? (
            <View className="py-12 items-center">
              <ActivityIndicator color="#f59e0b" />
              <Text className="text-neutral-500 font-mono mt-2">Searching...</Text>
            </View>
          ) : searchQuery.data?.results && searchQuery.data.results.length > 0 ? (
            <FlatList
              data={searchQuery.data.results}
              renderItem={renderResult}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ListFooterComponent={<View className="h-8" />}
            />
          ) : debouncedQuery.length >= 2 && !searchQuery.isFetching ? (
            <View className="py-12 items-center">
              <Text className="text-neutral-500 font-mono">No results</Text>
            </View>
          ) : (
            <View className="py-12 items-center">
              <Text className="text-neutral-600 font-mono text-center">
                Type at least 2 characters to search
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
