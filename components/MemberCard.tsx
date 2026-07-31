import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

type MemberCardProps = {
    userId: string | null;
    profile: any;
    onEditPress?: () => void;
    onAvatarPress?: () => void;
    isReadOnly?: boolean;
    onDisplayItems?: any[];
};

export function MemberCard({ userId, profile, onEditPress, onAvatarPress, isReadOnly = false, onDisplayItems = [] }: MemberCardProps) {
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
        <View className="w-full">
            <View className="w-full aspect-[1.586] rounded-xl overflow-hidden relative shadow-2xl bg-[#0b2447] border border-white/20">
                
                {/* Retro Yellow Banner */}
                <View className="absolute top-[60%] left-0 right-0 h-10 bg-[#fbbf24] border-y-2 border-black/50 flex-row items-center overflow-hidden">
                    {/* Repeating faint background text for the stripe */}
                     <Text className="text-black font-black text-xl italic tracking-tighter opacity-10 ml-2">VIDEO RENTAL</Text>
                     <Text className="text-black font-black text-xl italic tracking-tighter opacity-10 ml-4">VIDEO RENTAL</Text>
                     <Text className="text-black font-black text-xl italic tracking-tighter opacity-10 ml-4">VIDEO RENTAL</Text>
                </View>

                {/* Glossy Sheen Overlay (Top half) */}
                <View className="absolute top-0 left-0 right-0 h-[45%] bg-white/5" pointerEvents="none" />

                {/* Content Container */}
                <View className="flex-1 flex-row px-5 py-4">

                    {/* LEFT COLUMN */}
                    <View className="flex-1 pr-4 justify-between relative z-10">
                        {/* Header Logo Area */}
                        <View className="mb-2">
                            <View className="bg-black/90 rounded border border-white/10 p-1.5 self-start shadow-sm">
                                <Image
                                    source={require('@/assets/images/logo_tracking.png')}
                                    style={{ width: 85, height: 28 }}
                                    contentFit="contain"
                                />
                            </View>
                        </View>

                        {/* Member Details */}
                        <View className="mt-auto mb-2">
                            <Text className="text-[#93c5fd] font-bold text-[9px] uppercase tracking-widest mb-1 shadow-black">MEMBER HANDLE</Text>
                            <View className="bg-black/50 px-2.5 py-1.5 rounded-sm border border-white/10 self-start">
                                <Text className="text-white font-mono font-bold tracking-widest text-sm" numberOfLines={1}>
                                    {profile?.username ? '@' + profile.username.toUpperCase() : 'UNKNOWN'}
                                </Text>
                            </View>
                        </View>

                        {/* Barcode (Sticker Look) */}
                        <View className="bg-white p-1.5 rounded-sm shadow-md flex-row items-end h-8 border border-neutral-300 self-start mt-1">
                            {barcodeLines.map((line: { width: number; margin: number }, i: number) => (
                                <View key={i} style={{ width: line.width, height: '100%', backgroundColor: 'black', marginRight: line.margin }} />
                            ))}
                        </View>
                    </View>

                    {/* RIGHT COLUMN: Photo & Chip */}
                    <View className="w-[32%] items-center justify-between py-1 relative z-10">
                        
                        {/* Faux Smart Chip */}
                        <View className="w-9 h-7 rounded-md bg-[#d4af37] border-2 border-[#b8860b] shadow-sm mb-2 opacity-90 overflow-hidden flex-row">
                             <View className="flex-1 border-r border-[#b8860b]/50" />
                             <View className="flex-1 border-r border-[#b8860b]/50" />
                             <View className="flex-1" />
                             <View className="absolute top-1/2 left-0 right-0 h-px bg-[#b8860b]/50" />
                        </View>

                        {/* Embedded Photo */}
                        <View className="w-full aspect-[3/4] relative">
                            <Pressable onPress={onAvatarPress} disabled={!onAvatarPress} className="w-full h-full bg-neutral-900 rounded-md border border-black shadow-lg overflow-hidden relative">
                                {profile?.avatar_url ? (
                                    <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%', opacity: 0.9 }} contentFit="cover" transition={400} />
                                ) : (
                                    <View className="flex-1 items-center justify-center bg-neutral-800">
                                        <FontAwesome name="user" size={40} color="#525252" />
                                    </View>
                                )}
                                {/* Vintage photo filter overlay */}
                                <View className="absolute inset-0 bg-blue-900/10 pointer-events-none" />
                            </Pressable>
                            {/* Edit Icon Badge */}
                            {!isReadOnly && onEditPress && (
                                <Pressable onPress={onEditPress} className="absolute -bottom-2 -right-2 bg-[#fbbf24] p-2 rounded-full border-2 border-[#0b2447] shadow-sm z-30">
                                    <FontAwesome name="camera" size={12} color="black" />
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>
            </View>

        {/* 3 Most Recent On Display Items */}
        {onDisplayItems && onDisplayItems.length > 0 && (
            <View className="mt-3 flex-row gap-2 justify-center">
                {onDisplayItems.slice(0, 3).map((item, i) => {
                    const posterPath = item.movies?.poster_path || item.shows?.poster_path;
                    const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w200${posterPath}` : null;
                    return (
                        <View key={item.id || i} className="w-20 aspect-[2/3] bg-neutral-800 rounded border border-neutral-700 overflow-hidden shadow">
                            {posterUrl ? (
                                <Image source={{ uri: posterUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                            ) : (
                                <View className="flex-1 items-center justify-center">
                                    <FontAwesome name="film" size={20} color="#525252" />
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        )}
        </View>
    );
}
