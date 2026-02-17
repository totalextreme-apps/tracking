import { useRef } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import * as Haptics from 'expo-haptics';
import type { CollectionItemWithMovie } from '@/types/database';

type AcquiredModalProps = {
  visible: boolean;
  item: CollectionItemWithMovie | null;
  onClose: () => void;
  onAcquired: () => void | Promise<void>;
  isPending?: boolean;
};

export function AcquiredModal({
  visible,
  item,
  onClose,
  onAcquired,
  isPending = false,
}: AcquiredModalProps) {
  const confettiRef = useRef<ConfettiCannon>(null);

  const handleAcquired = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    confettiRef.current?.start();
    await onAcquired();
    onClose();
  };

  if (!item) return null;

  const movie = item.movies;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/70 justify-center items-center"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-neutral-900 rounded-2xl p-6 mx-6 w-full max-w-sm"
        >
          <ConfettiCannon
            ref={confettiRef}
            count={80}
            origin={{ x: -10, y: 0 }}
            fadeOut
            autoStart={false}
          />
          <Text className="text-white text-xl font-semibold text-center mb-2">
            {movie?.title}
          </Text>
          <Text className="text-neutral-500 text-sm text-center mb-6">
            {item.format}
          </Text>
          <Pressable
            onPress={handleAcquired}
            disabled={isPending}
            className="bg-amber-500 py-4 rounded-xl items-center active:opacity-90"
          >
            <Text className="text-black font-mono font-bold text-lg">
              {isPending ? '...' : 'ACQUIRED'}
            </Text>
          </Pressable>
          <Pressable onPress={onClose} className="mt-4 py-2">
            <Text className="text-neutral-500 font-mono text-center text-sm">
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
