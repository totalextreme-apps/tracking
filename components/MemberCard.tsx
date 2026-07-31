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
            <View className="w-full aspect-[1.586] rounded-xl overflow-hidden relative shadow-2xl bg-[#1a1412] border border-[#f59e0b]/20">
                
                {/* Amber/Brown Stripe */}
                <View className="absolute top-[60%] left-0 right-0 h-10 bg-[#8a7060]/20 border-y border-[#f59e0b]/30 flex-row items-center overflow-hidden">
                     <Text className="text-[#f59e0b] font-black text-xl italic tracking-widest opacity-[0.03] ml-2">TRACKING APP MEMBER</Text>
                     <Text className="text-[#f59e0b] font-black text-xl italic tracking-widest opacity-[0.03] ml-4">TRACKING APP MEMBER</Text>
                </View>

                {/* Subtle Sheen */}
                <View className="absolute top-0 left-0 right-0 h-[40%] bg-[#f59e0b]/5" pointerEvents="none" />

                {/* Content Container */}
                <View className="flex-1 flex-row px-5 py-4">

                    {/* LEFT COLUMN */}
                    <View className="flex-1 pr-4 justify-between relative z-10">
                        {/* Header Logo Area */}
                        <View className="mb-2">
                            <View className="bg-black/40 rounded border border-[#f59e0b]/10 p-1.5 self-start shadow-sm">
                                <Image
                                    source={require('@/assets/images/logo_tracking.png')}
                                    style={{ width: 85, height: 28 }}
                                    contentFit="contain"
                                />
                            </View>
                        </View>

                        {/* Member Details */}
                        <View className="mt-auto mb-2">
                            <Text className="text-[#a89880] font-bold text-[9px] uppercase tracking-widest mb-1">MEMBER HANDLE</Text>
                            <View className="bg-black/60 px-2.5 py-1.5 rounded-sm border border-[#f59e0b]/20 self-start">
                                <Text className="text-[#f59e0b] font-mono font-bold tracking-widest text-sm" numberOfLines={1}>
                                    {profile?.username ? '@' + profile.username.toUpperCase() : 'UNKNOWN'}
                                </Text>
                            </View>
                        </View>

                        {/* Barcode */}
                        <View className="bg-[#f59e0b]/10 p-1.5 rounded-sm flex-row items-end h-8 border border-[#f59e0b]/20 self-start mt-1">
                            {barcodeLines.map((line: { width: number; margin: number }, i: number) => (
                                <View key={i} style={{ width: line.width, height: '100%', backgroundColor: '#f59e0b', opacity: 0.6, marginRight: line.margin }} />
                            ))}
                        </View>
                    </View>

                    {/* RIGHT COLUMN: Photo */}
                    <View className="w-[32%] items-center justify-center py-1 relative z-10">
                        {/* Embedded Photo */}
                        <View className="w-full aspect-[3/4] relative">
                            <Pressable onPress={onAvatarPress} disabled={!onAvatarPress} className="w-full h-full bg-[#111] rounded-md border border-[#f59e0b]/30 shadow-lg overflow-hidden relative">
                                {profile?.avatar_url ? (
                                    <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%', opacity: 0.85 }} contentFit="cover" transition={400} />
                                ) : (
                                    <View className="flex-1 items-center justify-center bg-black">
                                        <FontAwesome name="user" size={40} color="#8a7060" />
                                    </View>
                                )}
                                {/* Vintage photo filter overlay */}
                                <View className="absolute inset-0 bg-[#f59e0b]/10 pointer-events-none" />
                            </Pressable>

                            {/* Editable Badge */}
                            {!isReadOnly && onEditPress && (
                                <Pressable
                                    onPress={onEditPress}
                                    className="absolute -bottom-2 -right-2 bg-[#2d2016] p-1.5 rounded-full border border-[#f59e0b]/50 shadow-md"
                                >
                                    <FontAwesome name="camera" size={10} color="#f59e0b" />
                                </Pressable>
                            )}
                        </View>
                        
                        <View className="mt-4 bg-black/40 px-2 py-0.5 rounded border border-[#f59e0b]/10">
                            <Text className="text-[#8a7060] font-mono text-[8px] tracking-widest uppercase">ID: {displayId}</Text>
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
