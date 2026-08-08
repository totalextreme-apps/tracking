import React, { useState, useEffect } from 'react';
import { Modal, Pressable, Text, View, Platform, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  messageLink: string;
  messageText: string;
}

export function ShareModal({ visible, onClose, title, messageLink, messageText }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCopied(false);
    }
  }, [visible]);

  const handleShare = async (message: string) => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      try {
        await Share.share({ message });
        onClose();
      } catch (err) {
        console.error('Failed to share native:', err);
      }
    } else {
      // Web sharing logic
      try {
        if (navigator.share) {
          await navigator.share({
            title: title,
            text: message,
          });
          onClose();
        } else {
          await navigator.clipboard.writeText(message);
          setCopied(true);
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      } catch (err) {
        // If it's abort error (user cancelled share sheet), do not show error
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Web share/copy failed:', err);
        }
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/80 items-center justify-center px-6">
        <View className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl shadow-black relative overflow-hidden">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-amber-500 font-bold text-base tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>
              {title}
            </Text>
            <Pressable onPress={onClose} className="p-1 -mr-2 bg-neutral-900 border border-neutral-800 rounded-full active:bg-neutral-800">
              <Ionicons name="close" size={16} color="#737373" />
            </Pressable>
          </View>

          {copied ? (
            <View className="py-8 items-center justify-center gap-3">
              <View className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/50 items-center justify-center">
                <Ionicons name="checkmark" size={24} color="#10b981" />
              </View>
              <Text className="text-emerald-400 font-mono text-xs font-bold uppercase tracking-widest mt-1">
                COPIED TO CLIPBOARD!
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              <Pressable
                onPress={() => handleShare(messageLink)}
                className="flex-row items-center bg-neutral-900 border border-neutral-800 rounded-xl p-4 active:border-amber-500/40 active:bg-neutral-900/80 gap-3"
              >
                <View className="p-2 bg-amber-500/10 rounded-lg">
                  <Ionicons name="link-outline" size={18} color="#f59e0b" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-mono text-xs font-bold">SHARE LINK</Text>
                  <Text className="text-neutral-500 font-mono text-[9px] mt-0.5">OPEN IN APP LAYOUT</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => handleShare(messageText)}
                className="flex-row items-center bg-neutral-900 border border-neutral-800 rounded-xl p-4 active:border-amber-500/40 active:bg-neutral-900/80 gap-3"
              >
                <View className="p-2 bg-amber-500/10 rounded-lg">
                  <Ionicons name="document-text-outline" size={18} color="#f59e0b" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-mono text-xs font-bold">SHARE PLAIN TEXT</Text>
                  <Text className="text-neutral-500 font-mono text-[9px] mt-0.5">LIST + PROFILE LINK</Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* Footer */}
          {!copied && (
            <View className="mt-6 pt-4 border-t border-neutral-900 flex-row justify-end">
              <Pressable
                onPress={onClose}
                className="px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 active:bg-neutral-800"
              >
                <Text className="text-neutral-400 font-mono text-[10px] font-bold uppercase tracking-wider">CANCEL</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
