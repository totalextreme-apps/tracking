import { cropToRatio } from '@/lib/image-utils';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Dimensions, Image, Modal, Platform, Pressable, Text, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 400);
const PREVIEW_HEIGHT = PREVIEW_WIDTH * 1.5; // 2:3 ratio

interface ImageCropModalProps {
    visible: boolean;
    imageUri: string;
    onClose: () => void;
    onSave: (croppedDataUrl: string) => void;
    targetRatio?: number; // width / height
}

export function ImageCropModal({ visible, imageUri, onClose, onSave, targetRatio = 2 / 3 }: ImageCropModalProps) {
    const [loading, setLoading] = useState(false);
    const previewHeight = PREVIEW_WIDTH / targetRatio;

    const handleSave = async () => {
        if (Platform.OS !== 'web') {
            // For native, we'd use expo-image-manipulator here
            // For now, just pass through the original
            onSave(imageUri);
            return;
        }

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const croppedUri = await cropToRatio(imageUri, targetRatio);
            await onSave(croppedUri);
        } catch (e) {
            console.error('Failed to crop image:', e);
            await onSave(imageUri); // Fall back to original
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/90 items-center justify-center p-4">
                <View className="bg-neutral-900 rounded-xl p-6 w-full max-w-md border border-neutral-800">
                    <Text className="text-white font-mono text-lg mb-4 text-center">
                        CROP COVER ART
                    </Text>

                    <View
                        className="bg-neutral-800 rounded-lg overflow-hidden mb-4 self-center"
                        style={{ width: PREVIEW_WIDTH, height: previewHeight }}
                    >
                        <Image
                            source={{ uri: imageUri }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                    </View>

                    <Text className="text-neutral-500 font-mono text-xs text-center mb-4">
                        Image will be cropped to match active format ratio
                    </Text>

                    <View className="flex-row gap-3">
                        <Pressable
                            onPress={onClose}
                            className="flex-1 bg-neutral-800 py-3 rounded-lg items-center"
                        >
                            <Text className="text-neutral-400 font-mono text-sm">CANCEL</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSave}
                            disabled={loading}
                            className="flex-1 bg-amber-600 py-3 rounded-lg items-center"
                        >
                            {loading ? (
                                <FontAwesome name="spinner" size={16} color="white" />
                            ) : (
                                <Text className="text-white font-mono text-sm font-bold">SAVE</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
