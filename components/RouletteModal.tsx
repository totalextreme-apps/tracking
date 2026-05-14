import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Animated, Easing, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useSound } from '@/context/SoundContext';
import { router } from 'expo-router';

interface RouletteModalProps {
  visible: boolean;
  onClose: () => void;
  collection: any[];
  genres: string[];
}

export const RouletteModal: React.FC<RouletteModalProps> = ({
  visible,
  onClose,
  collection,
  genres
}) => {
  const { playSound } = useSound();
  const [step, setStep] = useState<'setup' | 'rolling' | 'result'>('setup');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<'movie' | 'tv' | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  
  const [result, setResult] = useState<any | null>(null);
  
  const spinValue = useRef(new Animated.Value(0)).current;

  // Reset state when opened
  useEffect(() => {
    if (visible) {
      setStep('setup');
      setSelectedGenres([]);
      setSelectedType(null);
      setSelectedFormats([]);
      setResult(null);
    }
  }, [visible]);

  const handleRoll = () => {
    playSound('rewind');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep('rolling');

    // Filter collection
    let pool = collection.filter(item => item.status === 'owned');
    
    if (selectedType) {
      pool = pool.filter(item => item.media_type === selectedType);
    }
    
    if (selectedFormats.length > 0) {
      pool = pool.filter(item => selectedFormats.includes(item.format));
    }
    
    if (selectedGenres.length > 0) {
      pool = pool.filter(item => {
        const m = item.movies || item.shows;
        return m?.genres?.some((g: any) => selectedGenres.includes(g?.name));
      });
    }

    // Group into unique titles to avoid over-weighting formats
    const uniqueMap = new Map();
    pool.forEach(item => {
      const key = item.media_type === 'movie' ? `m_${item.movie_id}` : `t_${item.show_id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    const uniqueItems = Array.from(uniqueMap.values());

    if (uniqueItems.length === 0) {
      // No match, just pick anything if nothing matches? No, show an error state
      setTimeout(() => {
        setResult(null);
        setStep('result');
      }, 1000);
      return;
    }

    // Animation
    spinValue.setValue(0);
    Animated.timing(spinValue, {
      toValue: 1,
      duration: 2000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      const winner = uniqueItems[Math.floor(Math.random() * uniqueItems.length)];
      setResult(winner);
      setStep('result');
      playSound('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1080deg']
  });

  const navigateToDetail = () => {
    if (!result) return;
    onClose();
    if (result.media_type === 'tv') {
      const showId = result.show_id || result.shows?.id;
      if (showId) router.push({ pathname: "/show/[id]", params: { id: showId, season: result.season_number || 1 } } as any);
    } else {
      const movieId = result.movie_id || result.movies?.id;
      if (movieId) router.push({ pathname: "/movie/[id]", params: { id: movieId } } as any);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 bg-black/90 justify-center p-6">
        <View className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <View className="bg-amber-500 py-4 px-6 flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Ionicons name="dice" size={20} color="black" style={{ marginRight: 8 }} />
              <Text className="text-black font-mono font-bold text-base tracking-widest uppercase">
                Collection Roulette
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color="black" />
            </Pressable>
          </View>

          <View className="p-6">
            {step === 'setup' && (
              <View>
                <Text className="text-white font-bold text-xl mb-2">What are you in the mood for?</Text>
                <Text className="text-neutral-400 font-mono text-xs mb-6">Leave blank for completely random.</Text>
                
                <Text className="text-neutral-500 font-mono text-[10px] uppercase tracking-tighter mb-2">TYPE</Text>
                <View className="flex-row gap-2 mb-6">
                  {['movie', 'tv'].map(t => (
                    <Pressable 
                      key={t}
                      onPress={() => {
                        setSelectedType(selectedType === t ? null : t as any);
                        playSound('click');
                      }}
                      className={`flex-1 py-3 items-center rounded-lg border ${selectedType === t ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-900 border-neutral-800'}`}
                    >
                      <Text className={`font-mono font-bold text-xs ${selectedType === t ? 'text-amber-500' : 'text-neutral-400'}`}>
                        {t === 'movie' ? 'FILM' : 'TV SHOW'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text className="text-neutral-500 font-mono text-[10px] uppercase tracking-tighter mb-2">FORMAT (OPTIONAL, SELECT MULTIPLE)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                  <View className="flex-row gap-2 pb-2 px-1">
                    {['VHS', 'DVD', 'BluRay', '4K', 'Digital'].map(f => {
                      const isActive = selectedFormats.includes(f);
                      return (
                        <Pressable 
                          key={f}
                          onPress={() => {
                            setSelectedFormats(prev => prev.includes(f) ? prev.filter(item => item !== f) : [...prev, f]);
                            playSound('click');
                          }}
                          className={`px-4 py-2 rounded-full border ${isActive ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-800 border-neutral-700'}`}
                        >
                          <Text className={`font-mono text-xs font-bold ${isActive ? 'text-amber-500' : 'text-neutral-400'}`}>
                            {f === 'BluRay' ? 'Blu-ray' : f}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>

                <Text className="text-neutral-500 font-mono text-[10px] uppercase tracking-tighter mb-2">GENRE (OPTIONAL, SELECT MULTIPLE)</Text>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled className="mb-6 bg-neutral-900 rounded-lg border border-neutral-800">
                  <View className="flex-row flex-wrap p-3 gap-2">
                    {genres.map(g => {
                      const isSelected = selectedGenres.includes(g);
                      return (
                        <Pressable 
                          key={g}
                          onPress={() => {
                            setSelectedGenres(prev => prev.includes(g) ? prev.filter(item => item !== g) : [...prev, g]);
                            playSound('click');
                          }}
                          className={`px-3 py-1.5 rounded-full border ${isSelected ? 'bg-amber-500/20 border-amber-500/50' : 'bg-neutral-800 border-neutral-700'}`}
                        >
                          <Text className={`font-mono text-[10px] uppercase font-bold ${isSelected ? 'text-amber-500' : 'text-neutral-400'}`}>{g}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>

                <Pressable 
                  onPress={handleRoll}
                  className="bg-amber-500 py-4 rounded-xl items-center flex-row justify-center mt-2"
                >
                  <Ionicons name="dice" size={20} color="black" style={{ marginRight: 8 }} />
                  <Text className="text-black font-mono font-bold uppercase tracking-widest text-lg">ROLL THE DICE</Text>
                </Pressable>
              </View>
            )}

            {step === 'rolling' && (
              <View className="items-center justify-center py-12">
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="dice" size={80} color="#f59e0b" />
                </Animated.View>
                <Text className="text-amber-500 font-mono text-base mt-8 tracking-widest uppercase">
                  Rifling through the stacks...
                </Text>
              </View>
            )}

            {step === 'result' && (
              <View className="items-center">
                {!result ? (
                  <View className="items-center py-10">
                    <Ionicons name="sad-outline" size={64} color="#666" />
                    <Text className="text-white font-bold text-xl mt-4 mb-2">No Matches Found</Text>
                    <Text className="text-neutral-400 font-mono text-center">
                      Try loosening your filters.
                    </Text>
                    <Pressable 
                      onPress={() => setStep('setup')}
                      className="mt-8 bg-neutral-800 py-3 px-8 rounded-xl border border-neutral-700"
                    >
                      <Text className="text-white font-mono font-bold uppercase">Try Again</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View className="w-full">
                    <Text className="text-neutral-400 font-mono text-center mb-2 tracking-widest text-xs uppercase">
                      THE DICE HAVE SPOKEN:
                    </Text>

                    {(selectedGenres.length > 0 || selectedType || selectedFormats.length > 0) && (
                      <View className="flex-row justify-center mb-4 flex-wrap gap-2">
                        {selectedType && (
                           <Text className="font-mono text-[10px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">{selectedType === 'movie' ? 'FILM' : 'TV SHOW'}</Text>
                        )}
                        {selectedFormats.map(f => (
                           <Text key={f} className="font-mono text-[10px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">{f === 'BluRay' ? 'Blu-ray' : f}</Text>
                        ))}
                        {selectedGenres.map(g => (
                           <Text key={g} className="font-mono text-[10px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">{g}</Text>
                        ))}
                      </View>
                    )}
                    
                    <View className="bg-neutral-900 rounded-xl overflow-hidden border border-amber-500/30 mb-6">
                      <Image 
                        source={{ uri: `https://image.tmdb.org/t/p/w500${(result.movies || result.shows)?.poster_path}` }}
                        style={{ width: '100%', aspectRatio: 2/3 }}
                        contentFit="cover"
                      />
                      <View className="p-4 bg-neutral-900 border-t border-neutral-800">
                        <Text className="text-white font-bold text-xl mb-1 text-center" numberOfLines={2}>
                          {(result.movies || result.shows)?.title || (result.movies || result.shows)?.name}
                        </Text>
                        <Text className="text-amber-500 font-mono text-xs text-center">
                          {(result.movies || result.shows)?.release_date?.substring(0, 4) || (result.movies || result.shows)?.first_air_date?.substring(0, 4)} • {result.format}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row gap-3">
                      <Pressable 
                        onPress={handleRoll}
                        className="flex-1 bg-neutral-800 py-4 rounded-xl items-center justify-center border border-neutral-700"
                      >
                        <Text className="text-neutral-300 font-mono font-bold uppercase">Reroll</Text>
                      </Pressable>
                      <Pressable 
                        onPress={navigateToDetail}
                        className="flex-2 bg-amber-500 py-4 rounded-xl items-center justify-center pl-8 pr-8"
                      >
                        <Text className="text-black font-mono font-bold uppercase tracking-widest">Go to Item</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};
