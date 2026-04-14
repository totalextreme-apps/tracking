import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

type MemberCardProps = {
    userId: string | null;
    profile: any;
    onEditPress: () => void;
    onAvatarPress: () => void;
};

export function MemberCard({ userId, profile, onEditPress, onAvatarPress }: MemberCardProps) {
    // Deterministic pseudo-random barcode seeded from userId
    const barcodeLines = useMemo(() => {
        let seed = (userId || 'guest').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
        return Array.from({ length: 48 }).map(() => ({
            width: rand() > 0.5 ? 4 : 2,
            margin: rand() > 0.5 ? 2 : 1,
        }));
    }, [userId]);

    const displayId = userId ? userId.substring(0, 8).toUpperCase() : 'UNKNOWN';

    return (
        <View className="w-full aspect-[1.586] rounded-xl overflow-hidden relative shadow-xl bg-[#262626]">
            {/* Top Orange Stripe */}
            <View className="absolute top-4 left-0 right-0 h-1 bg-amber-600" />
            <View className="absolute top-[18px] left-0 right-0 h-0.5 bg-black/50" />

            {/* Bottom Orange Stripe */}
            <View className="absolute bottom-4 left-0 right-0 h-1 bg-amber-600/50" />
            <View className="absolute bottom-[18px] left-0 right-0 h-0.5 bg-black/50" />

            {/* Content Container */}
            <View className="flex-1 flex-row px-5 py-4 pt-8">

                {/* LEFT COLUMN */}
                <View className="flex-1 pr-4 justify-between">
                    {/* Header Logo Area */}
                    <View className="mb-2 relative">
                        <View className="bg-black border-2 border-amber-600 p-1 self-start shadow-sm">
                            <Image
                                source={require('@/assets/images/logo_tracking.png')}
                                style={{ width: 91, height: 30 }}
                                contentFit="contain"
                            />
                        </View>
                    </View>

                    {/* Member Details */}
                    <View className="gap-3 mt-4">
                        <View className="border-b-2 border-amber-600 pb-1 mr-4">
                            <Text className="text-white font-bold text-lg tracking-widest uppercase italic">MEMBERSHIP CARD</Text>
                        </View>

                        <View>
                            <Text className="text-amber-600 font-bold text-[10px] uppercase">ID #</Text>
                            <View className="flex-row items-baseline border-b border-neutral-600 pb-0.5 border-dashed mr-4">
                                <Text className="text-amber-500 font-mono font-bold text-lg tracking-widest">{displayId}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Barcode */}
                    <View style={{ flexDirection: 'row', height: 32, alignItems: 'flex-end', overflow: 'hidden', marginTop: 'auto', backgroundColor: 'white', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 2, marginRight: 16 }}>
                        {barcodeLines.map((line: { width: number; margin: number }, i: number) => (
                            <View key={i} style={{ width: line.width, height: '100%', backgroundColor: 'black', marginRight: line.margin }} />
                        ))}
                    </View>

                </View>

                {/* RIGHT COLUMN: Photo */}
                <View className="w-[35%] justify-center items-center pb-2">
                    <Pressable onPress={onAvatarPress} className="w-full aspect-[3/4] bg-neutral-200 p-1 shadow-lg">
                        <View className="w-full h-full bg-neutral-800 border-2 border-white overflow-hidden relative">
                            {profile?.avatar_url ? (
                                <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={400} />
                            ) : (
                                <View className="flex-1 items-center justify-center bg-neutral-800">
                                    <FontAwesome name="user" size={40} color="#525252" />
                                </View>
                            )}
                        </View>
                        {/* Edit Icon Badge */}
                        <View className="absolute -bottom-3 -right-3 bg-amber-600 p-2 rounded-full border-2 border-white shadow-sm z-10">
                            <FontAwesome name="camera" size={14} color="white" />
                        </View>
                    </Pressable>
                </View>
            </View>

        </View>
    );
}
