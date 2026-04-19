import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSound } from '@/context/SoundContext';

interface PreferenceQuizModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (moviePrefs: string[], formatPrefs: string[]) => Promise<void>;
  initialMoviePrefs?: string[];
  initialFormatPrefs?: string[];
}

const GENRES = [
  'Horror', 'Sci-Fi', 'Action', 'Drama', 'Comedy', 
  'Thriller', 'Animation', 'Documentary', 'Fantasy', 
  'Martial Arts', 'Cult Classics', 'Western', 'Noir'
];

const FORMATS = [
  '4K Ultra HD', 'Blu-ray', 'DVD', 'VHS', 'LaserDisc', 'Digital'
];

export const PreferenceQuizModal: React.FC<PreferenceQuizModalProps> = ({
  visible,
  onClose,
  onSave,
  initialMoviePrefs = [],
  initialFormatPrefs = []
}) => {
  const { playSound } = useSound();
  const [step, setStep] = useState(1);
  const [selectedMovies, setSelectedMovies] = useState<string[]>(initialMoviePrefs);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(initialFormatPrefs);
  const [isSaving, setIsSaving] = useState(false);

  const toggleMovie = (genre: string) => {
    playSound('click');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMovies(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const toggleFormat = (format: string) => {
    playSound('click');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFormats(prev => 
      prev.includes(format) ? prev.filter(f => f !== format) : [...prev, format]
    );
  };

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      await onSave(selectedMovies, selectedFormats);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/90 justify-center p-6">
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          {/* Header */}
          <View className="bg-amber-500 py-4 px-6 flex-row justify-between items-center">
            <Text className="text-black font-mono font-bold text-base tracking-widest uppercase">
              Collector Profile Quiz
            </Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color="black" />
            </Pressable>
          </View>

          <View className="p-6">
            {step === 1 ? (
              <View>
                <Text className="text-white font-bold text-xl mb-2">What do you track?</Text>
                <Text className="text-neutral-400 font-mono text-xs mb-6">Select your favorite movie genres.</Text>
                
                <View className="flex-row flex-wrap gap-3">
                  {GENRES.map(genre => {
                    const isSelected = selectedMovies.includes(genre);
                    return (
                      <Pressable 
                        key={genre}
                        onPress={() => toggleMovie(genre)}
                        className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-amber-500 border-amber-500' : 'bg-neutral-800 border-neutral-700'}`}
                      >
                        <Text className={`font-mono text-xs font-bold ${isSelected ? 'text-black' : 'text-neutral-400'}`}>
                          {genre}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable 
                  onPress={() => setStep(2)}
                  className="mt-10 bg-white py-4 rounded-xl items-center"
                >
                  <Text className="text-black font-mono font-bold uppercase tracking-widest">Next Step</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text className="text-white font-bold text-xl mb-2">Physical or Digital?</Text>
                <Text className="text-neutral-400 font-mono text-xs mb-6">Which formats do you primarily collect?</Text>
                
                <View className="flex-row flex-wrap gap-3">
                  {FORMATS.map(f => {
                    const isSelected = selectedFormats.includes(f);
                    return (
                      <Pressable 
                        key={f}
                        onPress={() => toggleFormat(f)}
                        className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-white border-white' : 'bg-neutral-800 border-neutral-700'}`}
                      >
                        <Text className={`font-mono text-xs font-bold ${isSelected ? 'text-black' : 'text-neutral-400'}`}>
                          {f}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View className="flex-row gap-4 mt-10">
                  <Pressable 
                    onPress={() => setStep(1)}
                    className="flex-1 bg-neutral-800 py-4 rounded-xl items-center border border-neutral-700"
                  >
                    <Text className="text-neutral-400 font-mono font-bold uppercase">Back</Text>
                  </Pressable>
                  <Pressable 
                    onPress={handleFinish}
                    className="flex-2 bg-amber-500 py-4 rounded-xl items-center px-8"
                  >
                    {isSaving ? <ActivityIndicator color="black" /> : <Text className="text-black font-mono font-bold uppercase tracking-widest">Finish Quiz</Text>}
                  </Pressable>
                </View>
              </View>
            )}

            <View className="flex-row justify-center mt-8 gap-2">
              <View className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-amber-500' : 'bg-neutral-700'}`} />
              <View className={`w-2 h-2 rounded-full ${step === 2 ? 'bg-amber-500' : 'bg-neutral-700'}`} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};
