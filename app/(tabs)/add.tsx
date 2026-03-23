import * as Haptics from 'expo-haptics';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image as RNImage,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useAddToCollection } from '@/hooks/useCollection';
import { useTmdbSearch } from '@/hooks/useTmdbSearch';
import { getPosterUrl } from '@/lib/dummy-data';
import { getTvShowById, type TmdbMediaResult } from '@/lib/tmdb';
import type { MovieFormat } from '@/types/database';

import BarcodeScanner from '@/components/BarcodeScanner';
import { lookupUPC } from '@/lib/upc';
import { useCameraPermissions } from 'expo-camera';

const FORMATS: MovieFormat[] = ['VHS', 'DVD', 'BluRay', '4K', 'Digital'];

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<TmdbMediaResult | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<MovieFormat[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);
  const [status, setStatus] = useState<'owned' | 'wishlist'>('owned');
  const [edition, setEdition] = useState('');
  const [isBootleg, setIsBootleg] = useState(false);
  const [triedToSubmit, setTriedToSubmit] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const searchQuery = useTmdbSearch(debouncedQuery);
  const addMutation = useAddToCollection(userId);

  // Camera Logic
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Prevent rapid multiple scans using ref for immediate blocking
  const isProcessingScan = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset all search/form state every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setQuery('');
      setDebouncedQuery('');
      setSelectedItem(null);
      setSelectedFormats([]);
      setSelectedSeasons([]);
      setEdition('');
      setIsBootleg(false);
      setStatus('owned');
      setTriedToSubmit(false);
    }, [])
  );

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (isProcessingScan.current) return;

    isProcessingScan.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setIsScanning(false);
    setIsLookingUp(true);

    abortControllerRef.current = new AbortController();

    try {
      const title = await lookupUPC(data, abortControllerRef.current.signal);
      if (title) {
        setQuery(title);
      } else {
        Alert.alert(
          'Not Found',
          `Could not identify product for barcode: ${data}`,
          [{ text: 'OK', onPress: () => (isProcessingScan.current = false) }]
        );
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        Alert.alert('Error', 'Failed to lookup barcode');
      }
    } finally {
      setIsLookingUp(false);
      abortControllerRef.current = null;
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

  // Detect Manual Barcode Entry (12–13 digit UPC/EAN)
  useEffect(() => {
    if (/^\d{12,13}$/.test(debouncedQuery)) {
      handleManualBarcode(debouncedQuery);
    }
  }, [debouncedQuery]);

  const handleManualBarcode = async (code: string) => {
    setIsLookingUp(true);
    abortControllerRef.current = new AbortController();
    try {
      const title = await lookupUPC(code, abortControllerRef.current.signal);
      if (title) {
        setQuery(title);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      // Silently fail — user can keep typing
    } finally {
      setIsLookingUp(false);
      abortControllerRef.current = null;
    }
  };

  const cancelLookup = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLookingUp(false);
    isProcessingScan.current = false;
  };

  const handleSelectItem = async (item: TmdbMediaResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFormats([]);
    setSelectedSeasons([]);
    setSelectedItem(item);
    setQuery('');
    setDebouncedQuery('');
    setTriedToSubmit(false);
    Keyboard.dismiss();

    if (item.media_type === 'tv') {
      setIsLoadingDetails(true);
      try {
        const fullShow = await getTvShowById(item.id);
        setSelectedItem({ ...fullShow, media_type: 'tv' } as TmdbMediaResult);
      } catch (e) {
        console.error('Failed to fetch TV details', e);
      } finally {
        setIsLoadingDetails(false);
      }
    }
  };

  const handleAdd = async () => {
    if (!selectedItem) return;

    if (!userId) {
      if (Platform.OS === 'web') {
        window.alert('Not signed in. Anonymous sign-in is required.');
      } else {
        Alert.alert('Not signed in', 'Anonymous sign-in is required. Enable it in Supabase Dashboard → Auth → Providers.');
      }
      return;
    }

    if (selectedFormats.length === 0) {
      setTriedToSubmit(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (selectedItem.media_type === 'tv' && selectedSeasons.length === 0) {
      setTriedToSubmit(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (selectedItem.media_type === 'tv') {
        for (const season of selectedSeasons) {
          await addMutation.mutateAsync({
            tmdbItem: selectedItem,
            formats: selectedFormats,
            status,
            edition: edition.trim() || null,
            isBootleg,
            seasonNumber: season,
          });
        }
      } else {
        await addMutation.mutateAsync({
          tmdbItem: selectedItem,
          formats: selectedFormats,
          status,
          edition: edition.trim() || null,
          isBootleg,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      console.error('Add failed:', e);
      const msg = e?.message || String(e);
      const errorText = (msg.includes('duplicate key') || msg.includes('unique constraint') || msg.includes('23505'))
        ? `You might already have ${selectedItem.title ?? selectedItem.name} in this format. Use the Edition field to add another copy.`
        : `Could not add: ${msg}`;
      if (Platform.OS === 'web') {
        window.alert(errorText);
      } else {
        Alert.alert('Error', errorText);
      }
    }
  };

  const results = searchQuery.data?.results ?? [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Camera Modal Overlay */}
      {isScanning && (
        <View style={{ position: 'absolute', inset: 0, zIndex: 50, backgroundColor: '#000' }}>
          <BarcodeScanner
            onScanned={handleBarCodeScanned}
            onClose={() => setIsScanning(false)}
            barcodeTypes={['upc_a', 'upc_e', 'ean13', 'ean8', 'qr', 'code128', 'code39']}
          />
        </View>
      )}

      <ScrollView
        className="flex-1 bg-neutral-950"
        contentContainerStyle={{
          paddingHorizontal: 32,
          paddingBottom: insets.bottom + 100,
          maxWidth: 1200,
          alignSelf: 'center',
          width: '100%',
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Back Button */}
        <View className="px-4 pt-2">
          <Pressable
            onPress={() => router.back()}
            className="bg-[#0000FF] px-4 py-1.5 rounded-md self-start shadow-sm"
          >
            <Text
              className="text-white text-[10px] font-bold uppercase tracking-widest"
              style={{ fontFamily: 'VCR_OSD_MONO' }}
            >
              BACK
            </Text>
          </Pressable>
        </View>

        {!userId && (
          <View className="bg-red-900/20 mx-4 mt-4 p-3 rounded border border-red-900/50">
            <Text className="text-red-400 font-mono text-xs text-center">
              Not signed in. Enable Anonymous Auth in Supabase or check connection.
            </Text>
          </View>
        )}

        {/* Search Row */}
        <View className="p-4 flex-row">
          <TextInput
            nativeID="add-search-input"
            {...({ name: 'add-query' } as any)}
            placeholder="Search movies & shows or UPC..."
            placeholderTextColor="#6b7280"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => Keyboard.dismiss()}
            className="bg-neutral-900 text-white px-4 py-3 rounded-lg font-mono flex-1 mr-2"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {isLookingUp ? (
            <Pressable
              onPress={cancelLookup}
              className="bg-neutral-900 w-12 items-center justify-center rounded-lg border border-red-900/50"
            >
              <FontAwesome name="times" size={20} color="#ef4444" />
            </Pressable>
          ) : (
            <Pressable
              onPress={startScanning}
              className="bg-neutral-900 w-12 items-center justify-center rounded-lg border border-neutral-800"
            >
              <FontAwesome name="barcode" size={20} color="#f59e0b" />
            </Pressable>
          )}
        </View>

        {/* Item Selected: Show Add Form */}
        {selectedItem ? (
          <View className="px-4 pb-4">
            <View className="bg-neutral-900 rounded-lg p-4 mb-4">
              <View className="flex-row items-center mb-4">
                <View className="w-20 h-28 rounded bg-neutral-800 overflow-hidden">
                  {getPosterUrl(selectedItem.poster_path) && (
                    <RNImage
                      source={{ uri: getPosterUrl(selectedItem.poster_path)! }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  )}
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-white text-lg font-semibold">
                    {selectedItem.title ?? selectedItem.name}
                  </Text>
                  <Text className="text-neutral-500">
                    {(selectedItem.release_date ?? selectedItem.first_air_date)?.slice(0, 4) ?? '—'}
                    {selectedItem.media_type === 'tv' && ' • TV Series'}
                  </Text>
                </View>
              </View>

              {/* Owned / Wishlist */}
              <View className="flex-row gap-2 mb-4">
                <Pressable
                  onPress={() => setStatus('owned')}
                  className={`flex-1 py-2 rounded ${status === 'owned' ? 'bg-amber-600' : 'bg-neutral-800'}`}
                >
                  <Text className={`font-mono text-sm text-center ${status === 'owned' ? 'text-white' : 'text-neutral-400'}`}>
                    OWNED
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setStatus('wishlist')}
                  className={`flex-1 py-2 rounded ${status === 'wishlist' ? 'bg-amber-600' : 'bg-neutral-800'}`}
                >
                  <Text className={`font-mono text-sm text-center ${status === 'wishlist' ? 'text-white' : 'text-neutral-400'}`}>
                    WISHLIST
                  </Text>
                </Pressable>
              </View>

              {/* Format */}
              <View className="flex-row items-baseline mb-2 gap-2">
                <Text className="text-amber-500/90 font-mono text-xs tracking-widest">FORMAT</Text>
                {selectedFormats.length === 0 && triedToSubmit && (
                  <Text className="text-red-500 font-mono text-[10px] tracking-wider">
                    * Required
                  </Text>
                )}
              </View>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {FORMATS.map((f) => {
                  const isSelected = selectedFormats.includes(f);
                  return (
                    <Pressable
                      key={f}
                      onPress={() => {
                        setSelectedFormats((prev) =>
                          prev.includes(f) ? prev.filter((fmt) => fmt !== f) : [...prev, f]
                        );
                        Haptics.selectionAsync();
                      }}
                      className={`px-3 py-2 rounded ${isSelected ? 'bg-amber-600' : 'bg-neutral-800'}`}
                    >
                      <Text className={`font-mono text-sm ${isSelected ? 'text-white' : 'text-neutral-400'}`}>
                        {f === 'BluRay' ? 'Blu-ray' : f}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Seasons (TV Only) */}
              {selectedItem.media_type === 'tv' && (
                <View className="mb-4">
                  <View className="flex-row items-baseline mb-2 gap-2">
                    <Text className="text-amber-500/90 font-mono text-xs tracking-widest">SEASONS</Text>
                    {selectedSeasons.length === 0 && triedToSubmit && (
                      <Text className="text-red-500 font-mono text-[10px] tracking-wider">
                        * Select at least one
                      </Text>
                    )}
                  </View>

                  {isLoadingDetails ? (
                    <ActivityIndicator size="small" color="#f59e0b" className="mt-2" />
                  ) : (
                    <>
                      <View className="flex-row flex-wrap gap-2 mb-3">
                        {/* Include Season 0 if it exists */}
                        {selectedItem.seasons?.map((s) => {
                          const isSelected = selectedSeasons.includes(s.season_number);
                          return (
                            <Pressable
                              key={s.id}
                              onPress={() => {
                                setSelectedSeasons((prev) =>
                                  prev.includes(s.season_number)
                                    ? prev.filter((sn) => sn !== s.season_number)
                                    : [...prev, s.season_number]
                                );
                                Haptics.selectionAsync();
                              }}
                              className={`px-3 py-2 rounded ${isSelected ? 'bg-amber-600' : 'bg-neutral-800'}`}
                            >
                              <Text className={`font-mono text-xs ${isSelected ? 'text-white' : 'text-neutral-400'}`}>
                                {s.season_number === 0 ? 'Specials' : `S${s.season_number}`}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Box Set / Complete Series logic helper */}
                      {selectedItem.seasons && selectedItem.seasons.length > 2 && (
                        <Pressable
                          onPress={() => {
                            const all = selectedItem.seasons?.map(s => s.season_number) ?? [];
                            setSelectedSeasons(selectedSeasons.length === all.length ? [] : all);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }}
                          className="px-4 py-2 rounded bg-neutral-900 border border-neutral-800 mb-4 self-start"
                        >
                          <Text className="font-mono text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                            {selectedSeasons.length === (selectedItem.seasons?.length ?? 0)
                              ? 'DESELECT ALL'
                              : 'SELECT ALL SEASONS (BOX SET)'}
                          </Text>
                        </Pressable>
                      )}

                      {/* Manual Season Entry as fallback */}
                      <Text className="text-neutral-500 font-mono text-[10px] mb-2 uppercase tracking-tighter">
                        Or enter season manually:
                      </Text>
                      <TextInput
                        className="bg-neutral-800 text-white px-3 py-2 rounded font-mono text-sm mb-4"
                        placeholder="Season #"
                        placeholderTextColor="#444"
                        keyboardType="numeric"
                        onChangeText={(val) => {
                          const n = parseInt(val, 10);
                          if (!isNaN(n) && !selectedSeasons.includes(n)) {
                            setSelectedSeasons(prev => [...prev, n]);
                          }
                        }}
                      />
                    </>
                  )}
                </View>
              )}

              {/* Edition */}
              <Text className="text-amber-500/90 font-mono text-xs tracking-widest mb-2 mt-2">
                EDITION (OPTIONAL)
              </Text>
              <TextInput
                nativeID="edition-input"
                {...({ name: 'edition' } as any)}
                placeholder="Collector's Edition, Box Set, etc."
                placeholderTextColor="#6b7280"
                value={edition}
                onChangeText={setEdition}
                className="bg-neutral-800 text-white px-3 py-2 rounded font-mono text-sm mb-4"
                autoCapitalize="words"
                autoCorrect={false}
              />

              {/* Bootleg Toggle */}
              <View className="flex-row items-center justify-between bg-neutral-800 px-4 py-3 rounded-lg mb-6">
                <Text className="text-white font-mono text-sm">IS THIS A BOOTLEG?</Text>
                <Pressable
                  onPress={() => {
                    setIsBootleg(!isBootleg);
                    Haptics.selectionAsync();
                  }}
                  className={`w-12 h-6 rounded-full justify-center px-1 ${isBootleg ? 'bg-red-600' : 'bg-neutral-700'}`}
                >
                  <View className={`w-4 h-4 rounded-full bg-white transition-all ${isBootleg ? 'translate-x-6' : 'translate-x-0'}`} />
                </Pressable>
              </View>

              {/* ADD Button */}
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

            {/* CHOOSE DIFFERENT Button */}
            <Pressable
              onPress={() => {
                setSelectedItem(null);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="bg-red-700 py-3 rounded-lg items-center active:opacity-90"
              style={{ minHeight: 48 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-white font-mono font-semibold">CHOOSE DIFFERENT</Text>
            </Pressable>
          </View>
        ) : (
          /* Search Results */
          <View className="flex-1 px-4">
            {searchQuery.isFetching && debouncedQuery.length >= 2 ? (
              <View className="py-12 items-center">
                <ActivityIndicator color="#f59e0b" />
                <Text className="text-neutral-500 font-mono mt-2">Searching...</Text>
              </View>
            ) : results.length > 0 ? (
              <View>
                {results.map((item: any) => {
                  const posterUrl = getPosterUrl(item.poster_path, 'w154');
                  const year = (item.release_date ?? item.first_air_date)?.slice(0, 4) ?? '—';
                  return (
                    <Pressable
                      key={`${item.media_type}-${item.id}`}
                      onPress={() => handleSelectItem(item)}
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
                        <Text className="text-white font-medium" numberOfLines={2}>{item.title ?? item.name}</Text>
                        <Text className="text-neutral-500 text-sm mt-0.5">
                          {year} {item.media_type === 'tv' ? '• TV' : '• Movie'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                <View className="h-8" />
              </View>
            ) : debouncedQuery.trim().length > 0 && !searchQuery.isFetching ? (
              <View className="py-12 items-center">
                <Text className="text-neutral-500 font-mono">No results</Text>
              </View>
            ) : (
              <View className="py-12 items-center">
                <Text className="text-neutral-600 font-mono text-center">
                  Type at least 1 character to search
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
