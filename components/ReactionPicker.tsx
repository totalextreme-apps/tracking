import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ZoomIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  currentReaction?: string;
}

const EMOJIS = ['👍', '👎', '😂', '❤️', '🔥', '😮'];

export function ReactionPicker({ visible, onClose, onSelect, currentReaction }: ReactionPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Blur background for premium glassmorphic vibe */}
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFillObject} />

        <Animated.View 
          entering={FadeInDown.springify().damping(15)}
          exiting={FadeOutDown.duration(150)}
          style={styles.dockContainer}
        >
          <View style={styles.dock}>
            {EMOJIS.map((emoji, index) => {
              const isSelected = currentReaction === emoji;
              return (
                <Animated.View
                  entering={ZoomIn.delay(index * 40).springify().damping(12)}
                  key={emoji}
                >
                  <Pressable
                    onPress={() => {
                      onSelect(emoji);
                      onClose();
                    }}
                    style={[
                      styles.emojiButton,
                      isSelected && styles.selectedEmojiButton
                    ]}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  dockContainer: {
    backgroundColor: 'rgba(23, 23, 23, 0.95)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emojiButton: {
    padding: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  selectedEmojiButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)', // Amber transparent highlight
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  emojiText: {
    fontSize: 22,
  },
});
