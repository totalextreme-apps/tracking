import React, { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

type ConfirmModalProps = {
    visible: boolean;
    title: string;
    message?: string;
    /** If set, shows a text input pre-filled with this value */
    promptValue?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: (value?: string) => void;
    onCancel: () => void;
};

export function ConfirmModal({
    visible,
    title,
    message,
    promptValue,
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    destructive = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    const [inputValue, setInputValue] = useState(promptValue ?? '');

    // Sync when promptValue changes (e.g. different list selected)
    React.useEffect(() => {
        setInputValue(promptValue ?? '');
    }, [promptValue, visible]);

    const isPrompt = promptValue !== undefined;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View className="flex-1 bg-black/70 items-center justify-center px-6">
                <View className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-sm p-6">
                    <Text className="text-white font-mono font-bold text-base mb-2">{title}</Text>

                    {message ? (
                        <Text className="text-neutral-400 font-mono text-sm mb-4">{message}</Text>
                    ) : null}

                    {isPrompt && (
                        <TextInput
                            value={inputValue}
                            onChangeText={setInputValue}
                            className="bg-neutral-800 border border-neutral-700 text-white font-mono rounded-lg px-4 py-2.5 mb-4 text-sm"
                            placeholderTextColor="#525252"
                            autoFocus
                            selectTextOnFocus
                        />
                    )}

                    <View className="flex-row gap-3 justify-end">
                        <Pressable
                            onPress={onCancel}
                            className="px-4 py-2 rounded-lg bg-neutral-800 active:opacity-70"
                        >
                            <Text className="text-neutral-300 font-mono text-sm">{cancelLabel}</Text>
                        </Pressable>

                        <Pressable
                            onPress={() => onConfirm(isPrompt ? inputValue : undefined)}
                            className={`px-4 py-2 rounded-lg active:opacity-70 ${destructive ? 'bg-red-700' : 'bg-amber-600'}`}
                        >
                            <Text className="text-white font-mono font-bold text-sm">{confirmLabel}</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
