import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';

type MemberCardProps = {
    userId: string | null;
    profile: any;
    onEditPress?: () => void;
    onAvatarPress?: () => void;
    isReadOnly?: boolean;
    onDisplayItems?: any[];
};

export function MemberCard({ userId, profile, onEditPress, onAvatarPress, isReadOnly = false, onDisplayItems = [] }: MemberCardProps) {
    const { width } = useWindowDimensions();
    const isDesktop = Platform.OS === 'web' && width >= 768;

    // Deterministic pseudo-random barcode seeded from userId
    const barcodeLines = useMemo(() => {
        let seed = (userId || 'guest').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
        return Array.from({ length: 38 }).map(() => ({
            width: rand() > 0.5 ? 4 : 2,
            margin: rand() > 0.5 ? 2 : 1,
        }));
    }, [userId]);

    const displayId = userId ? userId.substring(0, 8).toUpperCase() : 'UNKNOWN';

    return (
        <View style={[{ width: '100%', alignItems: 'center' }, isDesktop && { maxWidth: 520, alignSelf: 'center' }]}>
            {/* Clear Lamination Sleeve Effect */}
            <View 
                className="rounded-xl bg-white/10 p-1.5 border border-white/20 shadow-2xl"
                style={[{ width: '100%', aspectRatio: 1.586 }, isDesktop && { maxWidth: 520, alignSelf: 'center' }]}
            >
                
                {/* Actual Plastic Card */}
                <View className="flex-1 rounded-lg bg-[#140e0b] overflow-hidden relative border border-[#2d2016]">
                    
                    {/* Retro Texture Background */}
                    <Image 
                        source={require('@/assets/images/card-bg-1.png')}
                        contentFit="cover"
                        style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.9 }}
                    />

                    {/* Top Branding */}
                    <View className="h-[45%] flex-row items-center px-4 justify-between relative overflow-hidden">
                        <View className="flex-col relative z-10">
                            <Text className="text-[#f59e0b] font-black text-3xl italic tracking-tighter" style={{ textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 2, height: 2}, textShadowRadius: 3 }}>TRACKING</Text>
                            <Text className="text-[#f59e0b]/80 font-bold text-[8px] uppercase tracking-widest -mt-1 ml-1" style={{ textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 1 }}>HOME VIDEO EXCELLENCE</Text>
                        </View>
                    </View>

                    {/* Bottom Card Info */}
                    <View className="flex-1 flex-row px-4 py-2 justify-between">
                        
                        {/* Left Side: Details & Barcode */}
                        <View className="flex-1 justify-between py-1 bg-black/40 rounded px-2 -ml-2 border border-white/5">
                            <View>
                                <Text className="text-[#f59e0b] font-black text-[13px] tracking-widest uppercase" style={{ textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 1 }}>MEMBERSHIP CARD</Text>
                                <View className="flex-row items-center mt-1">
                                    <Text className="text-[#a89880] font-mono text-[9px] mr-2">MEMBER:</Text>
                                    <Text className="text-white font-mono font-bold text-[10px]" numberOfLines={1}>
                                        {profile?.username ? '@' + profile.username.toUpperCase() : 'UNKNOWN'}
                                    </Text>
                                </View>
                                <Text className="text-[#888] font-mono text-[7px] mt-0.5">
                                    AUTH ID: {displayId}
                                    {profile?.created_at && ` • SINCE: ${new Date(profile.created_at).toLocaleDateString()}`}
                                </Text>
                            </View>

                            {/* White Barcode Sticker */}
                            <View className="bg-[#e5e5e5] p-1.5 rounded-sm self-start mt-2 border border-white shadow-sm transform -rotate-1">
                                <View className="flex-row items-end h-5">
                                    {barcodeLines.map((line: { width: number; margin: number }, i: number) => (
                                        <View key={i} style={{ width: line.width, height: '100%', backgroundColor: '#111', marginRight: line.margin }} />
                                    ))}
                                </View>
                                <Text className="text-center text-black font-mono text-[5px] mt-0.5 tracking-widest">{userId ? userId.substring(0,16).toUpperCase() : '0000000000'}</Text>
                            </View>
                        </View>

                        {/* Right Side: Polaroid-style Photo */}
                        <View className="w-[35%] aspect-[3/4] bg-[#f5f5f5] p-1.5 pb-5 rounded-sm shadow-md border border-neutral-300 transform rotate-2 relative mt-[-20px] z-20">
                            <Pressable onPress={onAvatarPress} disabled={!onAvatarPress} className="flex-1 bg-[#111] overflow-hidden relative border border-[#ddd]">
                                {profile?.avatar_url ? (
                                    <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%', opacity: 0.9 }} contentFit="cover" transition={400} />
                                ) : (
                                    <View className="flex-1 items-center justify-center">
                                        <FontAwesome name="user" size={40} color="#8a7060" />
                                    </View>
                                )}
                                {/* Faded vintage photo filter */}
                                <View className="absolute inset-0 bg-yellow-900/10 pointer-events-none" />
                            </Pressable>
                            
                            {/* Editable Badge */}
                            {!isReadOnly && onEditPress && (
                                <Pressable
                                    onPress={onEditPress}
                                    className="absolute -bottom-2 -right-2 bg-[#f59e0b] p-2 rounded-full border border-black shadow-md z-30"
                                >
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
